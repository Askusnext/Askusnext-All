import type { OfflineReason, PresenceRow, PresenceState } from '../api/presence';

// Named the way people expect from a chat app: Available, on another tab, Away, Went away.
export const STATE_LABEL: Record<PresenceState, string> = {
  active: 'Available',
  background: 'On another tab',
  away: 'Away',
  offline: 'Went away',
  not_enabled: 'Not enabled',
};

export const STATE_COLOR: Record<PresenceState, string> = {
  active: 'green',
  background: 'gold',
  away: 'orange',
  offline: 'default',
  not_enabled: 'blue',
};

/** One line saying what the state means for THIS person, including why they went away. */
export function stateDetail(row: Pick<PresenceRow, 'state'> & { offlineReason?: OfflineReason | null }): string {
  switch (row.state) {
    case 'active': return 'Using Solutions now';
    case 'background': return 'Browser is open, another tab or window is in front';
    case 'away': return 'Away from Solutions for a while';
    case 'offline': return row.offlineReason === 'closed' ? 'Closed the browser or tab' : 'Device off, asleep or connection lost';
    default: return 'Has not allowed presence';
  }
}

/** Plain-language meaning of each state, including what it does NOT prove. */
export const LEGEND: { state: PresenceState; meaning: string }[] = [
  { state: 'active', meaning: 'A Solutions tab is visible and focused. This does not prove typing, productivity or working time.' },
  { state: 'background', meaning: 'Solutions is open but another tab or window is in front. The browser is still connected.' },
  { state: 'away', meaning: 'Solutions has been out of view for a while (the away threshold) while the browser is still connected.' },
  { state: 'offline', meaning: 'Went away. Either they closed the browser or tab (shown as "Closed the browser or tab"), or the connection stopped: laptop closed, device asleep or off, or the network lost. We cannot tell those last cases apart.' },
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
