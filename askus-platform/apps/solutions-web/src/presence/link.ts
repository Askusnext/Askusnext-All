import { freshAccessToken, linkUrl } from '../api/presence';

interface Options {
  makeSocket?: (url: string) => WebSocket;
  getToken?: () => Promise<string | null>;
  backoffMs?: (attempt: number) => number;
}

/**
 * Keeps one small WebSocket open while Solutions is open, bound to this tab's presence session. It sends nothing
 * about pages, tabs or apps. Its only job is to break when the browser can no longer be reached (laptop closed,
 * asleep, network gone, browser closed) so the manager sees "went away" within about half a minute, and to keep a
 * throttled background tab from looking gone, because the server pings it at protocol level and the browser
 * answers on its own.
 *
 * The token goes in the first message, never the URL. If the socket is blocked by a proxy the link just stays
 * down and the ordinary heartbeat keeps working, only more slowly to notice a closed laptop.
 */
export class PresenceLink {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private sessionId: string | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  constructor(private readonly o: Options = {}) {}

  /** Bind to a session. Safe to call again with a new session id (for example after the old one ended). */
  start(sessionId: string) {
    this.teardown();
    this.sessionId = sessionId;
    this.attempt = 0;
    void this.connect(++this.generation);
  }

  private teardown() {
    this.generation++;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    try { this.ws?.close(); } catch { /* already closed */ }
    this.ws = null;
  }

  private async connect(gen: number) {
    if (gen !== this.generation || !this.sessionId) return;
    if (!this.o.makeSocket && typeof WebSocket === 'undefined') return; // nothing to open (server-side render)
    const token = await (this.o.getToken ?? freshAccessToken)().catch(() => null);
    if (gen !== this.generation || !token) return;
    let ws: WebSocket;
    try {
      ws = (this.o.makeSocket ?? ((u) => new WebSocket(u)))(linkUrl());
    } catch {
      return;
    }
    this.ws = ws;
    const sessionId = this.sessionId;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
    ws.onmessage = (m) => {
      let msg: { type?: string };
      try { msg = JSON.parse(String(m.data)); } catch { return; }
      if (msg.type === 'ready') ws.send(JSON.stringify({ type: 'bind', sessionId }));
      else if (msg.type === 'bound') this.attempt = 0;
    };
    ws.onclose = (ev) => {
      if (gen !== this.generation) return;
      this.ws = null;
      // 4403: not allowed. 4404: that session is over (the tracker starts a new one and calls start() again).
      if (ev.code === 4403 || ev.code === 4404 || ev.code === 1000) return;
      const wait = (this.o.backoffMs ?? ((n) => Math.min(10_000, 1000 * 2 ** n)))(this.attempt++);
      this.retry = setTimeout(() => void this.connect(gen), wait);
    };
    ws.onerror = () => undefined; // onclose follows and handles the retry
  }

  /** Stop for good. With `sayBye` the server is told this was on purpose, so it shows "closed", not "lost". */
  stop(sayBye = true) {
    const ws = this.ws;
    if (sayBye && ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify({ type: 'bye' })); } catch { /* closing anyway */ }
    }
    this.sessionId = null;
    this.teardown();
  }
}
