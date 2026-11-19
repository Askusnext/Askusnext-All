import { describe, expect, it } from 'vitest';
import { DISCLAIMER, LEGEND, STATE_LABEL, applyFeedEvent, formatDuration, timeInState } from '../src/presence/logic';
import type { PresenceRow } from '../src/api/presence';

const row = (id: string, version: number, over: Partial<PresenceRow> = {}): PresenceRow => ({
  userId: id, name: id, role: 'Employee', reportingAdminId: 'A', reportingAdminName: 'Alice', state: 'active',
  stateSince: '2026-11-18T10:00:00Z', lastSeenAt: '2026-11-18T10:00:30Z', version, ...over,
});
const map = (...rows: PresenceRow[]) => new Map(rows.map((r) => [r.userId, r]));

describe('live event ordering', () => {
  it('a snapshot replaces the visible set (people no longer authorized disappear)', () => {
    const next = applyFeedEvent(map(row('a', 1), row('b', 1)), { type: 'snapshot', rows: [row('a', 2)] });
    expect([...next.keys()]).toEqual(['a']);
  });

  it('an older update never replaces a newer one', () => {
    const held = map(row('a', 5, { state: 'away' }));
    const next = applyFeedEvent(held, { type: 'upsert', row: row('a', 4, { state: 'active' }) });
    expect(next.get('a')!.state).toBe('away');
    expect(next).toBe(held); // unchanged object: no needless re-render
  });

  it('a newer or equal-version update is applied (equal covers reassignment, which keeps the version)', () => {
    const held = map(row('a', 5));
    expect(applyFeedEvent(held, { type: 'upsert', row: row('a', 6, { state: 'offline' }) }).get('a')!.state).toBe('offline');
    expect(applyFeedEvent(held, { type: 'upsert', row: row('a', 5, { reportingAdminName: 'Bob' }) }).get('a')!.reportingAdminName).toBe('Bob');
  });

  it('a snapshot never downgrades a row we already hold at a higher version', () => {
    const next = applyFeedEvent(map(row('a', 9, { state: 'away' })), { type: 'snapshot', rows: [row('a', 8, { state: 'active' })] });
    expect(next.get('a')!.state).toBe('away');
  });

  it('removal drops the person immediately', () => {
    expect(applyFeedEvent(map(row('a', 1), row('b', 1)), { type: 'removed', userId: 'a' }).has('a')).toBe(false);
  });

  it('does not mutate its input', () => {
    const held = map(row('a', 1));
    applyFeedEvent(held, { type: 'removed', userId: 'a' });
    expect(held.has('a')).toBe(true);
  });
});

describe('labels and honesty', () => {
  it('Not enabled and Offline are different, separately labelled states', () => {
    expect(STATE_LABEL.not_enabled).not.toBe(STATE_LABEL.offline);
    expect(LEGEND.map((l) => l.state).sort()).toEqual(['active', 'away', 'background', 'not_enabled', 'offline']);
  });

  it('never claims why someone is offline, and says Active is not proof of work', () => {
    const offline = LEGEND.find((l) => l.state === 'offline')!.meaning;
    expect(offline).toMatch(/cause is unknown/i);
    expect(LEGEND.find((l) => l.state === 'active')!.meaning).toMatch(/does not prove/i);
    expect(DISCLAIMER).toMatch(/not proof of work/i);
    expect(DISCLAIMER).toMatch(/not used for attendance or payroll/i);
  });

  it('formats durations and uses server time, not the local clock', () => {
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(5 * 60_000)).toBe('5m');
    expect(formatDuration(3 * 3_600_000 + 7 * 60_000)).toBe('3h 7m');
    const r = row('a', 1, { stateSince: '2026-11-18T10:00:00Z' });
    const localNow = Date.parse('2026-11-18T09:00:00Z'); // a local clock one hour behind
    expect(timeInState(r, 3_600_000 + 5 * 60_000, localNow)).toBe('5m'); // server offset corrects it
    expect(timeInState(row('b', 1, { state: 'not_enabled', stateSince: null }), 0)).toBeNull();
  });
});
