import { freshAccessToken, wsUrl, type PresenceRow } from '../api/presence';
import type { FeedEvent } from './logic';

export type Connection = 'connecting' | 'live' | 'reconnecting' | 'disconnected';

interface Options {
  onEvent: (e: FeedEvent) => void;
  onConnection: (c: Connection) => void;
  /** Called after every (re)connect once the socket is authorized, so the caller can refetch a fresh REST snapshot. */
  onReady?: () => void;
  makeSocket?: (url: string) => WebSocket;
  getToken?: () => Promise<string | null>;
  backoffMs?: (attempt: number) => number;
}

/**
 * Authenticated, scoped live updates. The access token is sent as the first message (never in the URL).
 * There is no team or user id to send: the server decides what this viewer may see.
 * The server closes with 4401 when the token expires and 4403 when authorization is lost.
 */
export class LiveFeed {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private stopped = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private pinger: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly o: Options) {}

  start() {
    this.stopped = false;
    void this.connect();
  }

  private async connect() {
    if (this.stopped) return;
    this.o.onConnection(this.attempt === 0 ? 'connecting' : 'reconnecting');
    const token = await (this.o.getToken ?? freshAccessToken)();
    if (this.stopped) return;
    if (!token) return this.o.onConnection('disconnected');
    const ws = (this.o.makeSocket ?? ((u) => new WebSocket(u)))(wsUrl());
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
    ws.onmessage = (m) => {
      let msg: { type: string; row?: PresenceRow; rows?: PresenceRow[]; userId?: string };
      try { msg = JSON.parse(String(m.data)); } catch { return; }
      if (msg.type === 'ready') {
        ws.send(JSON.stringify({ type: 'subscribe' }));
        this.o.onReady?.();
      } else if (msg.type === 'snapshot' && msg.rows) {
        this.attempt = 0; // a fresh authorized snapshot: the connection is trustworthy again
        this.o.onConnection('live');
        this.o.onEvent({ type: 'snapshot', rows: msg.rows });
      } else if (msg.type === 'upsert' && msg.row) this.o.onEvent({ type: 'upsert', row: msg.row });
      else if (msg.type === 'removed' && msg.userId) this.o.onEvent({ type: 'removed', userId: msg.userId });
    };
    ws.onclose = (ev) => {
      if (this.pinger) clearInterval(this.pinger);
      this.ws = null;
      if (this.stopped) return;
      if (ev.code === 4403) return this.o.onConnection('disconnected'); // authorization lost: do not hammer the server
      this.o.onConnection('reconnecting');
      const wait = (this.o.backoffMs ?? ((n) => Math.min(30_000, 1000 * 2 ** n)))(this.attempt++);
      this.retry = setTimeout(() => void this.connect(), wait);
    };
    ws.onerror = () => undefined; // onclose follows and handles the retry
    this.pinger = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'ping' })), 25_000);
  }

  stop() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.pinger) clearInterval(this.pinger);
    this.ws?.close();
    this.ws = null;
  }
}
