import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PresenceLink } from '../src/presence/link';
import { STATE_LABEL, stateDetail } from '../src/presence/logic';

class FakeSocket {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: any[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeSocket.all.push(this); }
  send(d: string) { this.sent.push(JSON.parse(d)); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(); }
  say(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }); }
  drop(code = 1006) { this.readyState = 3; this.onclose?.({ code }); }
}

const make = () => new PresenceLink({ makeSocket: (u) => new FakeSocket(u) as unknown as WebSocket, getToken: async () => 'TOKEN', backoffMs: () => 1000 });
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => { vi.useFakeTimers(); FakeSocket.all = []; });
afterEach(() => vi.useRealTimers());

describe('presence live link', () => {
  it('sends the token as the first message (never in the URL), then binds to the session', async () => {
    const link = make();
    link.start('S'.repeat(24));
    await flush();
    const ws = FakeSocket.all[0];
    expect(ws.url).toMatch(/\/ws\/presence\/self$/);
    expect(ws.url).not.toContain('TOKEN');
    ws.open();
    expect(ws.sent).toEqual([{ type: 'auth', token: 'TOKEN' }]);
    ws.say({ type: 'ready' });
    expect(ws.sent[1]).toEqual({ type: 'bind', sessionId: 'S'.repeat(24) });
  });

  it('reconnects after an unexpected drop and binds again', async () => {
    const link = make();
    link.start('S'.repeat(24));
    await flush();
    FakeSocket.all[0].open();
    FakeSocket.all[0].drop();
    await vi.advanceTimersByTimeAsync(1100);
    expect(FakeSocket.all).toHaveLength(2);
  });

  it('does not retry when the server says not allowed or the session is over', async () => {
    for (const code of [4403, 4404]) {
      FakeSocket.all = [];
      const link = make();
      link.start('S'.repeat(24));
      await flush();
      FakeSocket.all[0].open();
      FakeSocket.all[0].drop(code);
      await vi.advanceTimersByTimeAsync(5000);
      expect(FakeSocket.all).toHaveLength(1);
    }
  });

  it('says goodbye on purpose when stopped, and never reconnects afterwards', async () => {
    const link = make();
    link.start('S'.repeat(24));
    await flush();
    const ws = FakeSocket.all[0];
    ws.open();
    link.stop(true);
    expect(ws.sent.at(-1)).toEqual({ type: 'bye' });
    ws.drop(1006);
    await vi.advanceTimersByTimeAsync(5000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('does nothing without a token', async () => {
    const link = new PresenceLink({ makeSocket: (u) => new FakeSocket(u) as unknown as WebSocket, getToken: async () => null });
    link.start('S'.repeat(24));
    await flush();
    expect(FakeSocket.all).toHaveLength(0);
  });

  it('starting again for a new session replaces the old connection', async () => {
    const link = make();
    link.start('A'.repeat(24));
    await flush();
    FakeSocket.all[0].open();
    link.start('B'.repeat(24));
    await flush();
    expect(FakeSocket.all).toHaveLength(2);
    FakeSocket.all[1].open();
    FakeSocket.all[1].say({ type: 'ready' });
    expect(FakeSocket.all[1].sent.at(-1)).toEqual({ type: 'bind', sessionId: 'B'.repeat(24) });
  });
});

describe('Teams-style names', () => {
  it('uses chat-app names for each state', () => {
    expect(STATE_LABEL.active).toBe('Available');
    expect(STATE_LABEL.background).toBe('On another tab');
    expect(STATE_LABEL.away).toBe('Away');
    expect(STATE_LABEL.offline).toBe('Went away');
  });

  it('says why someone went away', () => {
    expect(stateDetail({ state: 'offline', offlineReason: 'closed' })).toMatch(/Closed the browser or tab/);
    expect(stateDetail({ state: 'offline', offlineReason: 'lost' })).toMatch(/asleep or connection lost/);
    expect(stateDetail({ state: 'offline' })).toMatch(/asleep or connection lost/);
    expect(stateDetail({ state: 'background' })).toMatch(/another tab/);
  });
});
