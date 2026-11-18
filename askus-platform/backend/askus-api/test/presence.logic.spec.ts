import { computeState, consentInForce, loadPresenceConfig, needsDecision, NOTICE_VERSION, SessionView } from '../src/solutions/presence.logic';

// Deterministic server clock: every test passes `now` explicitly.
const T0 = new Date('2026-11-18T10:00:00Z');
const at = (s: number) => new Date(T0.getTime() + s * 1000);
const cfg = { offlineAfterMs: 120_000, awayAfterMs: 600_000 };
const sess = (inView: boolean, lastSeenSec: number, ended = false): SessionView => ({ inView, lastSeenAt: at(lastSeenSec), endedAt: ended ? at(lastSeenSec) : null });

describe('presence aggregation (fake clock)', () => {
  it('Active when any fresh session is visible and focused', () => {
    expect(computeState([sess(true, 0)], null, at(10), cfg).state).toBe('active');
  });

  it('Active -> Background when the only tab leaves view, and the background clock starts', () => {
    const r = computeState([sess(false, 20)], { state: 'active', backgroundSince: null }, at(30), cfg);
    expect(r.state).toBe('background');
    expect(r.backgroundSince).toEqual(at(30));
  });

  it('Background -> Away exactly at the configured threshold, measured continuously', () => {
    let prior = { state: 'background' as const, backgroundSince: at(0) as Date | null };
    expect(computeState([sess(false, 599)], prior, at(599), cfg).state).toBe('background');
    expect(computeState([sess(false, 600)], prior, at(600), cfg).state).toBe('away');
    prior = { state: 'away', backgroundSince: at(0) };
    expect(computeState([sess(false, 900)], prior, at(900), cfg).state).toBe('away');
  });

  it('Away -> Active as soon as a tab is in view, and clears the background clock', () => {
    const r = computeState([sess(true, 1000)], { state: 'away', backgroundSince: at(0) }, at(1000), cfg);
    expect(r).toMatchObject({ state: 'active', backgroundSince: null });
  });

  it('missed heartbeats -> Offline once the offline timeout passes, without any client event', () => {
    const s = [sess(true, 0)];
    expect(computeState(s, null, at(119), cfg).state).toBe('active');
    expect(computeState(s, null, at(120), cfg).state).toBe('offline');
  });

  it('Offline -> reconnect starts a fresh background clock (not the stale one)', () => {
    const r = computeState([sess(false, 5000)], { state: 'offline', backgroundSince: at(0) }, at(5000), cfg);
    expect(r.state).toBe('background');
    expect(r.backgroundSince).toEqual(at(5000));
  });

  it('multiple tabs: one visible tab wins over background tabs', () => {
    expect(computeState([sess(false, 10), sess(true, 10)], null, at(20), cfg).state).toBe('active');
  });

  it('an expired visible tab never overrides a fresh background tab', () => {
    const r = computeState([sess(true, 0), sess(false, 200)], { state: 'active', backgroundSince: null }, at(210), cfg);
    expect(r.state).toBe('background');
  });

  it('closing one tab keeps the user Active while another tab is visible', () => {
    expect(computeState([sess(true, 50, true), sess(true, 50)], null, at(60), cfg).state).toBe('active');
  });

  it('all sessions ended or expired -> Offline, and lastSeen is the newest heartbeat', () => {
    const r = computeState([sess(true, 40, true), sess(false, 70)], null, at(1000), cfg);
    expect(r.state).toBe('offline');
    expect(r.lastSeenAt).toEqual(at(70));
  });

  it('no sessions at all -> Offline with no last seen', () => {
    expect(computeState([], null, at(1), cfg)).toEqual({ state: 'offline', backgroundSince: null, lastSeenAt: null });
  });
});

describe('consent and notice versioning', () => {
  const now = new Date('2026-11-18T10:00:00Z');
  it('accepts only the current version', () => {
    expect(consentInForce({ noticeVersion: NOTICE_VERSION, decision: 'accepted' })).toBe(true);
    expect(consentInForce({ noticeVersion: '0', decision: 'accepted' })).toBe(false);
    expect(consentInForce({ noticeVersion: NOTICE_VERSION, decision: 'withdrawn' })).toBe(false);
    expect(consentInForce(null)).toBe(false);
  });
  it('prompts when nothing is decided or the notice changed (never silently migrates)', () => {
    expect(needsDecision(null, now, 1)).toBe(true);
    expect(needsDecision({ noticeVersion: '0', decision: 'accepted', decidedAt: now }, now, 1)).toBe(true);
  });
  it('does not nag after Not now until the deferral lapses', () => {
    const d = { noticeVersion: NOTICE_VERSION, decision: 'deferred', decidedAt: now };
    expect(needsDecision(d, new Date(now.getTime() + 3_600_000), 1)).toBe(false);
    expect(needsDecision(d, new Date(now.getTime() + 86_400_000), 1)).toBe(true);
  });
  it('respects an explicit withdrawal until the notice changes', () => {
    expect(needsDecision({ noticeVersion: NOTICE_VERSION, decision: 'withdrawn', decidedAt: now }, now, 1)).toBe(false);
  });
});

describe('configuration', () => {
  it('uses documented defaults and rejects out-of-range values', () => {
    const d = loadPresenceConfig({});
    expect(d).toMatchObject({ heartbeatSeconds: 30, offlineAfterMs: 120_000, awayAfterMs: 600_000 });
    expect(loadPresenceConfig({ PRESENCE_HEARTBEAT_SECONDS: '1' }).heartbeatSeconds).toBe(30);
    expect(loadPresenceConfig({ PRESENCE_AWAY_MINUTES: '15' }).awayAfterMs).toBe(900_000);
  });
});
