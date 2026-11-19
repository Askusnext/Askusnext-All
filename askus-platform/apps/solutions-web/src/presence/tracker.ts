import { endSessionBestEffort, presenceApi } from '../api/presence';
import type { PresenceLink } from './link';

type Api = Pick<typeof presenceApi, 'startSession' | 'heartbeat'>;
interface Env {
  visibilityState: () => string;
  hasFocus: () => boolean;
  listen: (events: { target: 'document' | 'window'; type: string; fn: () => void }[]) => () => void;
  endSession: (id: string) => void;
}

export type TrackerStatus = 'idle' | 'running' | 'revoked';

const browserEnv = (): Env => ({
  visibilityState: () => document.visibilityState,
  hasFocus: () => document.hasFocus(),
  listen: (events) => {
    events.forEach((e) => (e.target === 'document' ? document : window).addEventListener(e.type, e.fn));
    return () => events.forEach((e) => (e.target === 'document' ? document : window).removeEventListener(e.type, e.fn));
  },
  endSession: endSessionBestEffort,
});

/**
 * Reports only whether THIS Solutions tab is visible and focused. It never looks at other tabs, other sites,
 * desktop apps or input. Browsers throttle timers in background tabs, so a delayed heartbeat can make a
 * reachable person look offline for a moment; that is a known limitation, not a bug.
 */
export class PresenceTracker {
  private sessionId: string | null = null;
  private seq = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unlisten: (() => void) | null = null;
  private lastInView: boolean | null = null;
  private starting = false;
  status: TrackerStatus = 'idle';

  constructor(
    private readonly heartbeatSeconds: number,
    private readonly api: Api = presenceApi,
    private readonly env: Env = browserEnv(),
    private readonly onStatus: (s: TrackerStatus) => void = () => undefined,
    /** Optional live link (employee-side WebSocket). Absent in tests and when WebSockets are unavailable. */
    private readonly link: Pick<PresenceLink, 'start' | 'stop'> | null = null,
  ) {}

  private inView() {
    return this.env.visibilityState() === 'visible' && this.env.hasFocus();
  }

  private set(s: TrackerStatus) {
    this.status = s;
    this.onStatus(s);
  }

  /** Starts a session. Call only after the server has confirmed consent. Safe to call twice. */
  async start() {
    if (this.timer || this.starting) return;
    this.starting = true;
    try {
      const inView = this.inView();
      const res = await this.api.startSession(inView);
      this.sessionId = res.sessionId;
      this.seq = 0;
      this.lastInView = inView;
      const every = Math.max(10, res.heartbeatSeconds || this.heartbeatSeconds) * 1000;
      this.timer = setInterval(() => void this.beat(), every);
      const onChange = () => void this.beat();
      this.unlisten = this.env.listen([
        { target: 'document', type: 'visibilitychange', fn: onChange },
        { target: 'window', type: 'focus', fn: onChange },
        { target: 'window', type: 'blur', fn: onChange },
        { target: 'window', type: 'pagehide', fn: () => { if (this.sessionId) this.env.endSession(this.sessionId); this.link?.stop(true); } },
      ]);
      this.link?.start(res.sessionId);
      this.set('running');
    } catch {
      this.set('idle'); // not enabled or the request failed: nothing is running
    } finally {
      this.starting = false;
    }
  }

  private async beat() {
    if (!this.sessionId) return;
    const inView = this.inView();
    try {
      await this.api.heartbeat(this.sessionId, inView, ++this.seq);
      this.lastInView = inView;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (/not enabled/i.test(msg)) {
        this.stop(false);
        this.set('revoked'); // consent withdrawn elsewhere: stop at once
      } else if (/ended/i.test(msg)) {
        // The server dropped this session (for example it expired while the device slept): start a fresh one.
        this.clear();
        await this.start();
      }
      // Any other error: keep trying on the next beat; the server's timeout covers a long outage honestly.
    }
  }

  private clear() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.unlisten?.();
    this.unlisten = null;
  }

  /** Stops sending heartbeats. `endRemote` tells the server too (logout, withdrawal). */
  stop(endRemote = true) {
    const id = this.sessionId;
    this.clear();
    this.sessionId = null;
    this.link?.stop(endRemote);
    if (id && endRemote) this.env.endSession(id);
    if (this.status !== 'revoked') this.set('idle');
  }
}
