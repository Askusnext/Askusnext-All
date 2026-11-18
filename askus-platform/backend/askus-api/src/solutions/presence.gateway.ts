import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { Client as PgClient } from 'pg';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { PresenceRow, PresenceService } from './presence.service';
import { PresenceBus, StaffHierarchyService, Viewer } from './staff-hierarchy.service';

export const WS_PATH = '/ws/presence';
const MAX_PER_IP = 20;
const MAX_MSGS_PER_10S = 30;
const AUTH_TIMEOUT_MS = 5000;
const REVALIDATE_MS = 5000;
const LOCK_KEY = 727001; // pg advisory lock: only one API process runs live presence

interface Conn {
  ws: WebSocket;
  ip: string;
  viewer: Viewer | null;
  subscribed: boolean;
  tokenExpiresAt: number;
  checkedAt: number;
  stamps: number[];
  timers: NodeJS.Timeout[];
}

/**
 * Live presence for managers. Security properties:
 *  - Credential is sent as the FIRST MESSAGE, never in the URL; the access token is short-lived (15 min)
 *    and the socket is closed when it expires, so the client reconnects with a refreshed token.
 *  - Origin must be in CORS_ORIGINS.
 *  - There is no client-selected team or user: the server derives scope from the database, so guessed IDs
 *    have nothing to attach to.
 *  - Every delivery re-checks the viewer and the subject's CURRENT assignment.
 *  - Single instance: a Postgres advisory lock stops a second process from serving live updates.
 */
@Injectable()
export class PresenceGateway implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('PresenceGateway');
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
  private readonly conns = new Set<Conn>();
  private readonly perIp = new Map<string, number>();
  private leader = false;
  private lock: PgClient | null = null;
  private lockTimer: NodeJS.Timeout | null = null;
  private readonly onPresence = (row: PresenceRow) => void this.deliver(row);
  private readonly onAssignment = (e: { userId: string; oldAdminId: string | null; newAdminId: string | null }) => void this.deliverAssignment(e);

  constructor(
    private readonly adapter: HttpAdapterHost,
    private readonly jwt: JwtService,
    private readonly hierarchy: StaffHierarchyService,
    private readonly presence: PresenceService,
    private readonly bus: PresenceBus,
  ) {}

  async onApplicationBootstrap() {
    const server = this.adapter.httpAdapter?.getHttpServer();
    if (!server) return;
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => this.upgrade(req, socket, head));
    this.bus.on('presence', this.onPresence);
    this.bus.on('assignment', this.onAssignment);
    await this.acquireLeadership();
    if (!this.leader && process.env.PRESENCE_SINGLE_INSTANCE_GUARD !== 'false') {
      this.lockTimer = setInterval(() => void this.acquireLeadership(), 15_000);
      this.lockTimer.unref();
    }
  }

  async onModuleDestroy() {
    this.bus.off('presence', this.onPresence);
    this.bus.off('assignment', this.onAssignment);
    if (this.lockTimer) clearInterval(this.lockTimer);
    for (const c of [...this.conns]) this.close(c, 1001, 'server shutting down');
    this.wss.close();
    await this.lock?.end().catch(() => undefined);
  }

  /** True when this process may serve live updates. */
  get isLeader() {
    return this.leader;
  }

  private async acquireLeadership() {
    if (this.leader) return;
    if (process.env.PRESENCE_SINGLE_INSTANCE_GUARD === 'false') {
      this.leader = true;
      return;
    }
    try {
      if (!this.lock) {
        const client = new PgClient({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false });
        client.on('error', () => {
          this.leader = false;
          this.lock = null;
        });
        await client.connect();
        this.lock = client;
      }
      const r = await this.lock.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY]);
      this.leader = r.rows[0]?.ok === true;
      if (this.leader) this.log.log('Live presence is active on this API instance');
      else this.log.error('Another API instance already serves live presence. This instance refuses WebSocket connections; run a single API instance (see docs).');
    } catch (e) {
      this.lock = null;
      this.log.error(`Could not check the single-instance lock: ${(e as Error).message}`);
    }
  }

  // ───────────────────────── connection handling ─────────────────────────

  private allowedOrigin(origin: string | undefined) {
    const list = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return !!origin && list.includes(origin);
  }

  private upgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const path = (req.url ?? '').split('?')[0];
    if (path !== WS_PATH) return; // not ours
    const reject = (code: number, text: string) => {
      socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    if (!this.allowedOrigin(req.headers.origin)) return reject(403, 'Forbidden');
    if (!this.leader) return reject(503, 'Service Unavailable');
    const ip = req.socket.remoteAddress ?? 'unknown';
    if ((this.perIp.get(ip) ?? 0) >= MAX_PER_IP) return reject(429, 'Too Many Requests');
    this.wss.handleUpgrade(req, socket, head, (ws) => this.accept(ws, ip));
  }

  private accept(ws: WebSocket, ip: string) {
    const c: Conn = { ws, ip, viewer: null, subscribed: false, tokenExpiresAt: 0, checkedAt: 0, stamps: [], timers: [] };
    this.conns.add(c);
    this.perIp.set(ip, (this.perIp.get(ip) ?? 0) + 1);
    c.timers.push(setTimeout(() => !c.viewer && this.close(c, 4401, 'unauthenticated'), AUTH_TIMEOUT_MS));
    ws.on('message', (data) => void this.onMessage(c, data).catch(() => this.close(c, 1011, 'error')));
    ws.on('close', () => this.cleanup(c));
    ws.on('error', () => this.cleanup(c));
  }

  private cleanup(c: Conn) {
    if (!this.conns.delete(c)) return;
    c.timers.forEach(clearTimeout);
    const n = (this.perIp.get(c.ip) ?? 1) - 1;
    if (n <= 0) this.perIp.delete(c.ip);
    else this.perIp.set(c.ip, n);
  }

  private close(c: Conn, code: number, reason: string) {
    try {
      c.ws.close(code, reason);
    } catch {
      /* already closed */
    }
    this.cleanup(c);
  }

  private send(c: Conn, msg: unknown) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(msg));
  }

  private async onMessage(c: Conn, data: RawData) {
    const now = Date.now();
    c.stamps = c.stamps.filter((t) => now - t < 10_000);
    c.stamps.push(now);
    if (c.stamps.length > MAX_MSGS_PER_10S) return this.close(c, 4429, 'rate limited');

    let msg: { type?: unknown; token?: unknown };
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return this.close(c, 4400, 'bad message');
    }
    if (typeof msg !== 'object' || msg === null || typeof msg.type !== 'string') return this.close(c, 4400, 'bad message');

    if (msg.type === 'auth') {
      if (c.viewer || typeof msg.token !== 'string' || msg.token.length > 4096) return this.close(c, 4400, 'bad message');
      try {
        const p = await this.jwt.verifyAsync<{ sub: string; exp: number }>(msg.token);
        c.viewer = await this.hierarchy.manager({ id: p.sub }); // Employees, Agents and Customers fail here
        c.tokenExpiresAt = p.exp * 1000;
        c.checkedAt = Date.now();
      } catch {
        return this.close(c, 4403, 'forbidden'); // same answer whatever the cause
      }
      c.timers.push(setTimeout(() => this.close(c, 4401, 'token expired'), Math.max(c.tokenExpiresAt - Date.now(), 1)));
      return this.send(c, { type: 'ready', role: c.viewer.role });
    }
    if (!c.viewer) return this.close(c, 4401, 'unauthenticated');

    switch (msg.type) {
      case 'subscribe': {
        // Revalidate now: the snapshot is built from this viewer's CURRENT scope.
        c.viewer = await this.hierarchy.manager({ id: c.viewer.id }).catch(() => null);
        if (!c.viewer) return this.close(c, 4403, 'forbidden');
        c.subscribed = true;
        c.checkedAt = Date.now();
        return this.send(c, { type: 'snapshot', serverNow: this.presence.now().toISOString(), rows: await this.presence.visibleRows(c.viewer) });
      }
      case 'unsubscribe':
        c.subscribed = false;
        return;
      case 'ping':
        return this.send(c, { type: 'pong' });
      default:
        return this.close(c, 4400, 'bad message');
    }
  }

  // ───────────────────────── delivery ─────────────────────────

  /** Re-validate the viewer at delivery time (at most once per few seconds per socket). */
  private async stillManager(c: Conn): Promise<boolean> {
    if (Date.now() - c.checkedAt < REVALIDATE_MS) return !!c.viewer;
    const v = await this.hierarchy.manager({ id: c.viewer!.id }).catch(() => null);
    if (!v) {
      this.close(c, 4403, 'forbidden');
      return false;
    }
    c.viewer = v;
    c.checkedAt = Date.now();
    return true;
  }

  private inScope(v: Viewer, row: PresenceRow) {
    if (row.role !== 'Admin' && row.role !== 'Employee' && row.role !== 'Agent') return false;
    if (v.role === 'SuperAdmin') return true;
    return v.role === 'Admin' && (row.role === 'Employee' || row.role === 'Agent') && row.reportingAdminId === v.id;
  }

  private async deliver(row: PresenceRow) {
    for (const c of [...this.conns]) {
      if (!c.viewer || !c.subscribed || !(await this.stillManager(c)) || !this.inScope(c.viewer, row)) continue;
      this.send(c, { type: 'upsert', row });
    }
  }

  private async deliverAssignment(e: { userId: string; oldAdminId: string | null; newAdminId: string | null }) {
    const row = await this.presence.rowFor(e.userId);
    for (const c of [...this.conns]) {
      if (!c.viewer || !c.subscribed) continue;
      // The former Admin loses the person immediately and permanently for this connection.
      if (c.viewer.id === e.oldAdminId && c.viewer.role === 'Admin') {
        this.send(c, { type: 'removed', userId: e.userId });
        continue;
      }
      if (!row || !(await this.stillManager(c)) || !this.inScope(c.viewer, row)) continue;
      this.send(c, { type: 'upsert', row });
    }
  }
}
