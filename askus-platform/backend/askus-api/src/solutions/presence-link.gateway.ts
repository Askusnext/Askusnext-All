import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { PresenceGateway } from './presence.gateway';
import { PresenceService } from './presence.service';

/** The employee-side live link. Separate from /ws/presence, which only managers may use. */
export const LINK_PATH = '/ws/presence/self';

const MAX_PER_IP = 200; // an office can sit behind one address
const MAX_MSGS_PER_10S = 20;
const AUTH_TIMEOUT_MS = 5000;
/** Protocol-level ping every 10 s. Browsers answer these on their own, even in a throttled background tab. */
const PING_MS = 10_000;
/** No answer for this long and the connection is dead (lid closed, asleep, network gone). */
const DEAD_MS = 25_000;
/** After an unexpected drop, wait this long for the browser to reconnect before calling the session lost. */
const DEFAULT_GRACE_MS = 8_000;
const graceMs = () => Number(process.env.PRESENCE_LINK_GRACE_MS) || DEFAULT_GRACE_MS;
const TOUCH_MS = 10_000;

interface Conn {
  ws: WebSocket;
  ip: string;
  userId: string | null;
  sessionId: string | null;
  said: boolean; // the browser said goodbye on purpose
  lastPong: number;
  lastTouch: number;
  stamps: number[];
  timers: NodeJS.Timeout[];
}

/**
 * A small WebSocket each signed-in staff member keeps open while Solutions is open. It does one thing: tell the
 * server the browser is still reachable. Closing a laptop, sleeping, losing the network or closing the browser
 * all break it, so the person shows as "went away" within about half a minute instead of after the slower
 * heartbeat timeout. It carries no page, tab or app information.
 *
 *  - Credential is the FIRST MESSAGE (never in the URL); the socket closes when the access token expires.
 *  - Origin must be listed in CORS_ORIGINS. Only the leader API instance serves it.
 *  - A client can only bind to an OPEN session that belongs to its own authenticated user.
 */
@Injectable()
export class PresenceLinkGateway implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('PresenceLink');
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  private readonly conns = new Set<Conn>();
  private readonly perIp = new Map<string, number>();
  private sweep: NodeJS.Timeout | null = null;
  private readonly onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => this.upgrade(req, socket, head);
  private server: { off: (e: string, fn: (...a: never[]) => void) => unknown } | null = null;

  constructor(
    private readonly adapter: HttpAdapterHost,
    private readonly jwt: JwtService,
    private readonly presence: PresenceService,
    private readonly managers: PresenceGateway,
  ) {}

  onApplicationBootstrap() {
    const server = this.adapter.httpAdapter?.getHttpServer();
    if (!server) return;
    server.on('upgrade', this.onUpgrade);
    this.server = server;
    this.sweep = setInterval(() => this.sweepConnections(), 5000);
    this.sweep.unref();
  }

  onModuleDestroy() {
    this.server?.off('upgrade', this.onUpgrade as never);
    if (this.sweep) clearInterval(this.sweep);
    for (const c of [...this.conns]) {
      c.said = true; // shutting down: do not turn this into "lost"
      this.close(c, 1001, 'server shutting down');
    }
    this.wss.close();
  }

  /** How many live connections are bound to a session (used by tests). */
  boundCount(sessionId: string) {
    let n = 0;
    for (const c of this.conns) if (c.sessionId === sessionId && c.ws.readyState === WebSocket.OPEN) n++;
    return n;
  }

  private allowedOrigin(origin: string | undefined) {
    const list = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return !!origin && list.includes(origin);
  }

  private upgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const path = (req.url ?? '').split('?')[0];
    if (path !== LINK_PATH) return;
    const reject = (code: number, text: string) => {
      socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    if (!this.allowedOrigin(req.headers.origin)) return reject(403, 'Forbidden');
    if (!this.managers.isLeader) return reject(503, 'Service Unavailable');
    const ip = req.socket.remoteAddress ?? 'unknown';
    if ((this.perIp.get(ip) ?? 0) >= MAX_PER_IP) return reject(429, 'Too Many Requests');
    this.wss.handleUpgrade(req, socket, head, (ws) => this.accept(ws, ip));
  }

  private accept(ws: WebSocket, ip: string) {
    const now = Date.now();
    const c: Conn = { ws, ip, userId: null, sessionId: null, said: false, lastPong: now, lastTouch: 0, stamps: [], timers: [] };
    this.conns.add(c);
    this.perIp.set(ip, (this.perIp.get(ip) ?? 0) + 1);
    c.timers.push(setTimeout(() => !c.userId && this.close(c, 4401, 'unauthenticated'), AUTH_TIMEOUT_MS));
    ws.on('message', (data) => void this.onMessage(c, data).catch(() => this.close(c, 1011, 'error')));
    ws.on('pong', () => void this.onPong(c));
    ws.on('close', () => this.cleanup(c));
    ws.on('error', () => this.cleanup(c));
  }

  private send(c: Conn, msg: unknown) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(msg));
  }

  private close(c: Conn, code: number, reason: string) {
    try {
      c.ws.close(code, reason);
    } catch {
      /* already closed */
    }
    this.cleanup(c);
  }

  /** Removes the connection. An unexpected drop of a bound session starts the grace period before "lost". */
  private cleanup(c: Conn) {
    if (!this.conns.delete(c)) return;
    c.timers.forEach(clearTimeout);
    const n = (this.perIp.get(c.ip) ?? 1) - 1;
    if (n <= 0) this.perIp.delete(c.ip);
    else this.perIp.set(c.ip, n);

    if (c.userId && c.sessionId && !c.said) {
      const { userId, sessionId } = { userId: c.userId, sessionId: c.sessionId };
      const closedAt = this.presence.now();
      const t = setTimeout(() => {
        if (this.boundCount(sessionId) > 0) return; // the browser reconnected
        void this.presence.expireIfSilent(userId, sessionId, closedAt).catch((e) => this.log.error(`expire failed: ${(e as Error).message}`));
      }, graceMs());
      t.unref();
    }
  }

  private async onPong(c: Conn) {
    c.lastPong = Date.now();
    if (!c.userId || !c.sessionId || Date.now() - c.lastTouch < TOUCH_MS) return;
    c.lastTouch = Date.now();
    await this.presence.touch(c.userId, c.sessionId).catch(() => undefined);
  }

  /** Every few seconds: ping the live ones and drop the ones that stopped answering. */
  private sweepConnections() {
    const now = Date.now();
    for (const c of [...this.conns]) {
      if (c.ws.readyState !== WebSocket.OPEN) continue;
      if (now - c.lastPong > DEAD_MS) {
        c.ws.terminate(); // fires 'close', which starts the grace period
        this.cleanup(c);
        continue;
      }
      try {
        c.ws.ping();
      } catch {
        /* closing */
      }
    }
  }

  private async onMessage(c: Conn, data: RawData) {
    const now = Date.now();
    c.stamps = c.stamps.filter((t) => now - t < 10_000);
    c.stamps.push(now);
    if (c.stamps.length > MAX_MSGS_PER_10S) return this.close(c, 4429, 'rate limited');

    let msg: { type?: unknown; token?: unknown; sessionId?: unknown };
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return this.close(c, 4400, 'bad message');
    }
    if (typeof msg !== 'object' || msg === null || typeof msg.type !== 'string') return this.close(c, 4400, 'bad message');

    if (msg.type === 'auth') {
      if (c.userId || typeof msg.token !== 'string' || msg.token.length > 4096) return this.close(c, 4400, 'bad message');
      try {
        const p = await this.jwt.verifyAsync<{ sub: string; exp: number }>(msg.token);
        if (!(await this.presence.canTrack(p.sub))) return this.close(c, 4403, 'forbidden');
        c.userId = p.sub;
        c.timers.push(setTimeout(() => this.close(c, 4401, 'token expired'), Math.max(p.exp * 1000 - Date.now(), 1)));
      } catch {
        return this.close(c, 4403, 'forbidden'); // same answer whatever the cause
      }
      return this.send(c, { type: 'ready' });
    }
    if (!c.userId) return this.close(c, 4401, 'unauthenticated');

    switch (msg.type) {
      case 'bind': {
        if (typeof msg.sessionId !== 'string' || !(await this.presence.ownsOpenSession(c.userId, msg.sessionId))) {
          return this.close(c, 4404, 'no such session'); // someone else's or an ended session behaves the same
        }
        c.sessionId = msg.sessionId;
        c.lastPong = Date.now();
        return this.send(c, { type: 'bound' });
      }
      case 'bye': {
        // The browser is closing on purpose: end the session now so the person shows as closed, not lost.
        c.said = true;
        if (c.sessionId) await this.presence.endSession({ id: c.userId }, c.sessionId).catch(() => undefined);
        return this.close(c, 1000, 'bye');
      }
      case 'ping':
        return this.send(c, { type: 'pong' });
      default:
        return this.close(c, 4400, 'bad message');
    }
  }
}
