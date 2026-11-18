import type { PresenceRow, PresenceState } from '../api/presence';

export const STATE_LABEL: Record<PresenceState, string> = {
  active: 'Active in Solutions',
  background: 'In background',
  away: 'Away (10+ min)',
  offline: 'Offline / disconnected',
  not_enabled: 'Not enabled',
};

export const STATE_COLOR: Record<PresenceState, string> = {
  active: 'green',
  background: 'gold',
  away: 'orange',
  offline: 'default',
  not_enabled: 'blue',
};

/** Plain-language meaning of each state, including what it does NOT prove. */
export const LEGEND: { state: PresenceState; meaning: string }[] = [
  { state: 'active', meaning: 'A Solutions tab is visible and focused. This does not prove typing, productivity or working time.' },
  { state: 'background', meaning: 'No Solutions tab is in view, but the browser has recently checked in.' },
  { state: 'away', meaning: 'Out of view continuously for the away threshold while still reachable.' },
  { state: 'offline', meaning: 'No recent check-in. The cause is unknown: the tab may be closed, the device asleep, the browser suspended or the network lost.' },
  { state: 'not_enabled', meaning: 'This person has not allowed browser presence. It is different from Offline.' },
];

export const DISCLAIMER = 'Presence shows whether the workspace is in view. It is not proof of work or productivity, it is not verified working time, and it is not used for attendance or payroll.';

export type FeedEvent =
  | { type: 'snapshot'; rows: PresenceRow[] }
  | { type: 'upsert'; row: PresenceRow }
  | { type: 'removed'; userId: string };

/**
 * Apply one server message to the local rows without ever letting older data replace newer data.
 * A snapshot is authoritative for who is visible; an update with a lower version than what is held is dropped.
 */
export function applyFeedEvent(current: Map<string, PresenceRow>, evt: FeedEvent): Map<string, PresenceRow> {
  const next = new Map(current);
  if (evt.type === 'snapshot') {
    next.clear();
    for (const row of evt.rows) {
      const held = current.get(row.userId);
      next.set(row.userId, held && held.version > row.version ? held : row);
    }
    return next;
  }
  if (evt.type === 'removed') {
    next.delete(evt.userId);
    return next;
  }
  const held = current.get(evt.row.userId);
  if (held && held.version > evt.row.version) return current; // stale: ignore
  next.set(evt.row.userId, evt.row);
  return next;
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** Time in the current state, measured against server time so a wrong local clock cannot distort it. */
export function timeInState(row: PresenceRow, serverOffsetMs: number, nowMs = Date.now()): string | null {
  if (!row.stateSince || row.state === 'not_enabled') return null;
  return formatDuration(nowMs + serverOffsetMs - new Date(row.stateSince).getTime());
}
