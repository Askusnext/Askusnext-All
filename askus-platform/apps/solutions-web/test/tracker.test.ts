import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PresenceTracker } from '../src/presence/tracker';

type Listener = { target: string; type: string; fn: () => void };

function setup(opts: { inView?: boolean } = {}) {
  let visible = opts.inView ?? true;
  let focused = opts.inView ?? true;
  const listeners: Listener[] = [];
  const ended: string[] = [];
  const api = {
    startSession: vi.fn(async (_inView: boolean) => ({ sessionId: 'S'.repeat(24), heartbeatSeconds: 30 })),
    heartbeat: vi.fn(async (_id: string, _inView: boolean, _seq: number) => ({ ok: true, ignored: false })),
  };
  const statuses: string[] = [];
  const env = {
    visibilityState: () => (visible ? 'visible' : 'hidden'),
    hasFocus: () => focused,
    listen: (events: Listener[]) => {
      listeners.push(...events);
      return () => listeners.splice(0, listeners.length);
    },
    endSession: (id: string) => ended.push(id),
  };
  const tracker = new PresenceTracker(30, api, env, (s) => statuses.push(s));
  const fire = (type: string) => listeners.filter((l) => l.type === type).forEach((l) => l.fn());
  return { tracker, api, ended, statuses, listeners, fire, set: (v: boolean, f: boolean) => { visible = v; focused = f; } };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('presence tracker', () => {
  it('starts nothing until start() is called, then reports whether the tab is in view', async () => {
    const t = setup();
    expect(t.api.startSession).not.toHaveBeenCalled();
    await t.tracker.start();
    expect(t.api.startSession).toHaveBeenCalledWith(true);
    expect(t.tracker.status).toBe('running');
  });

  it('sends heartbeats on the configured interval with increasing sequence numbers', async () => {
    const t = setup();
    await t.tracker.start();
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(30_000);
    const seqs = t.api.heartbeat.mock.calls.map((c) => c[2]);
    expect(seqs).toEqual([1, 2]);
  });

  it('visibility and focus changes report immediately, without waiting for the interval', async () => {
    const t = setup();
    await t.tracker.start();
    t.set(false, false);
    t.fire('visibilitychange');
    await vi.advanceTimersByTimeAsync(0);
    expect(t.api.heartbeat).toHaveBeenLastCalledWith('S'.repeat(24), false, 1);
    t.set(true, true);
    t.fire('focus');
    await vi.advanceTimersByTimeAsync(0);
    expect(t.api.heartbeat).toHaveBeenLastCalledWith('S'.repeat(24), true, 2);
  });

  it('visible but unfocused counts as not in view', async () => {
    const t = setup();
    await t.tracker.start();
    t.set(true, false);
    t.fire('blur');
    await vi.advanceTimersByTimeAsync(0);
    expect(t.api.heartbeat).toHaveBeenLastCalledWith('S'.repeat(24), false, 1);
  });

  it('stop() ends heartbeats, removes listeners and tells the server (logout)', async () => {
    const t = setup();
    await t.tracker.start();
    t.tracker.stop(true);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(t.api.heartbeat).not.toHaveBeenCalled();
    expect(t.ended).toEqual(['S'.repeat(24)]);
    expect(t.listeners).toHaveLength(0);
    expect(t.tracker.status).toBe('idle');
  });

  it('stops at once when the server says presence is no longer enabled (withdrawn elsewhere)', async () => {
    const t = setup();
    await t.tracker.start();
    t.api.heartbeat.mockRejectedValueOnce(new Error('Browser presence is not enabled'));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(t.tracker.status).toBe('revoked');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(t.api.heartbeat).toHaveBeenCalledTimes(1); // nothing more is sent
  });

  it('starts a fresh session when the server dropped this one (for example after the device slept)', async () => {
    const t = setup();
    await t.tracker.start();
    t.api.heartbeat.mockRejectedValueOnce(new Error('Session ended'));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(t.api.startSession).toHaveBeenCalledTimes(2);
    expect(t.tracker.status).toBe('running');
  });

  it('a failed start leaves nothing running and never claims to be running', async () => {
    const t = setup();
    t.api.startSession.mockRejectedValueOnce(new Error('Browser presence is not enabled'));
    await t.tracker.start();
    expect(t.tracker.status).toBe('idle');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.api.heartbeat).not.toHaveBeenCalled();
  });

  it('start() twice does not create two sessions', async () => {
    const t = setup();
    await Promise.all([t.tracker.start(), t.tracker.start()]);
    await t.tracker.start();
    expect(t.api.startSession).toHaveBeenCalledTimes(1);
  });

  it('a transient network error keeps trying instead of dropping the session', async () => {
    const t = setup();
    await t.tracker.start();
    t.api.heartbeat.mockRejectedValueOnce(new Error('Failed to fetch'));
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(t.api.heartbeat).toHaveBeenCalledTimes(2);
    expect(t.tracker.status).toBe('running');
  });
});
