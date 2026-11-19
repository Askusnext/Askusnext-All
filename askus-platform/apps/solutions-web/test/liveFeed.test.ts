import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveFeed, type Connection } from '../src/presence/liveFeed';

class FakeSocket {
  static all: FakeSocket[] = [];
  readyState = 1;
  sent: any[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeSocket.all.push(this); }
  send(d: string) { this.sent.push(JSON.parse(d)); }
  close() { this.onclose?.({ code: 1000 }); }
  open() { this.onopen?.(); }
  receive(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }); }
  drop(code = 1006) { this.onclose?.({ code }); }
}

const row = (id: string, version = 1) => ({ userId: id, name: id, role: 'Employee' as const, reportingAdminId: 'A', reportingAdminName: 'A', state: 'active' as const, stateSince: null, lastSeenAt: null, version });

function make() {
  const events: any[] = [];
  const conns: Connection[] = [];
  const ready = vi.fn();
  const feed = new LiveFeed({
    onEvent: (e) => events.push(e),
    onConnection: (c) => conns.push(c),
    onReady: ready,
    makeSocket: (u) => new FakeSocket(u) as unknown as WebSocket,
    getToken: async () => 'ACCESS.TOKEN.VALUE',
    backoffMs: () => 1000,
  });
  return { feed, events, conns, ready };
}
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => { vi.useFakeTimers(); FakeSocket.all = []; });
afterEach(() => vi.useRealTimers());

describe('live feed', () => {
  it('authenticates with the first message and never puts the token in the URL', async () => {
    const t = make();
    t.feed.start();
    await flush();
    const s = FakeSocket.all[0];
    expect(s.url).not.toContain('ACCESS');
    expect(s.url).toMatch(/\/ws\/presence$/);
    s.open();
    expect(s.sent[0]).toEqual({ type: 'auth', token: 'ACCESS.TOKEN.VALUE' });
    t.feed.stop();
  });

  it('subscribes only after ready and sends no team or user id (the server decides the scope)', async () => {
    const t = make();
    t.feed.start();
    await flush();
    const s = FakeSocket.all[0];
    s.open();
    s.receive({ type: 'ready', role: 'Admin' });
    expect(s.sent[1]).toEqual({ type: 'subscribe' });
    expect(t.ready).toHaveBeenCalledTimes(1);
    t.feed.stop();
  });

  it('is only "live" once an authorized snapshot arrives; updates are passed on', async () => {
    const t = make();
    t.feed.start();
    await flush();
    const s = FakeSocket.all[0];
    s.open();
    s.receive({ type: 'ready' });
    expect(t.conns).not.toContain('live');
    s.receive({ type: 'snapshot', rows: [row('a')] });
    expect(t.conns.at(-1)).toBe('live');
    s.receive({ type: 'upsert', row: row('a', 2) });
    s.receive({ type: 'removed', userId: 'a' });
    expect(t.events.map((e) => e.type)).toEqual(['snapshot', 'upsert', 'removed']);
    t.feed.stop();
  });

  it('shows reconnecting on a drop, then reconnects and asks for a fresh snapshot before trusting events', async () => {
    const t = make();
    t.feed.start();
    await flush();
    FakeSocket.all[0].open();
    FakeSocket.all[0].receive({ type: 'ready' });
    FakeSocket.all[0].receive({ type: 'snapshot', rows: [row('a')] });
    FakeSocket.all[0].drop();
    expect(t.conns.at(-1)).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.all).toHaveLength(2);
    const s2 = FakeSocket.all[1];
    s2.open();
    expect(s2.sent[0].type).toBe('auth'); // re-authenticates from scratch
    s2.receive({ type: 'ready' });
    expect(t.ready).toHaveBeenCalledTimes(2); // caller refetches a REST snapshot
    expect(t.conns.at(-1)).toBe('reconnecting'); // still not live until the new snapshot lands
    s2.receive({ type: 'snapshot', rows: [row('a', 3)] });
    expect(t.conns.at(-1)).toBe('live');
    t.feed.stop();
  });

  it('does not retry when authorization is lost (4403)', async () => {
    const t = make();
    t.feed.start();
    await flush();
    FakeSocket.all[0].open();
    FakeSocket.all[0].drop(4403);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.all).toHaveLength(1);
    expect(t.conns.at(-1)).toBe('disconnected');
  });

  it('stop() (logout/unmount) closes the socket and cancels any retry', async () => {
    const t = make();
    t.feed.start();
    await flush();
    FakeSocket.all[0].open();
    FakeSocket.all[0].drop();
    t.feed.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('with no token (session gone) it stays disconnected and opens no socket', async () => {
    const events: Connection[] = [];
    const feed = new LiveFeed({ onEvent: () => undefined, onConnection: (c) => events.push(c), getToken: async () => null, makeSocket: (u) => new FakeSocket(u) as unknown as WebSocket });
    feed.start();
    await flush();
    expect(FakeSocket.all).toHaveLength(0);
    expect(events.at(-1)).toBe('disconnected');
  });
});
