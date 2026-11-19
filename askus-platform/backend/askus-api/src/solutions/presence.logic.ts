import type { PresenceState } from './presence.entities';

/** Version of the notice text staff accept. Bump it to force everyone to decide again. */
export const NOTICE_VERSION = '1';

export const NOTICE = {
  version: NOTICE_VERSION,
  title: 'Share your workspace presence?',
  summary:
    'Askus Solutions records whether this workspace is in view, in the background, or no longer reachable. Authorized managers can see that status. Other tabs and apps are not monitored.',
  collected: 'Your signed-in staff identity, an opaque session identifier, a presence state and the times it changed.',
  audience: 'Only your current reporting Admin and authorized Super Admins.',
  notCollected:
    'No other tab URLs, other website titles, desktop applications, keystrokes, screenshots, recordings, microphone, camera or off-site browsing.',
  meaning:
    '"Active" only means a Solutions tab is visible and focused. It does not prove typing, productivity or working time, and it is not used for attendance or payroll.',
  stop: 'Withdraw permission any time from the presence indicator in the header. Signing out or an expired session also stops it.',
};

export interface PresenceConfig {
  heartbeatSeconds: number;
  offlineAfterMs: number;
  awayAfterMs: number;
  historyRetentionDays: number;
  maxSessionsPerUser: number;
  /** How long "Not now" stays quiet before the prompt may be offered again. */
  deferDays: number;
}

const num = (v: string | undefined, d: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : d;
};

export function loadPresenceConfig(env: NodeJS.ProcessEnv = process.env): PresenceConfig {
  return {
    heartbeatSeconds: num(env.PRESENCE_HEARTBEAT_SECONDS, 30, 10, 120),
    offlineAfterMs: num(env.PRESENCE_OFFLINE_SECONDS, 120, 30, 3600) * 1000,
    awayAfterMs: num(env.PRESENCE_AWAY_MINUTES, 10, 1, 240) * 60_000,
    historyRetentionDays: num(env.PRESENCE_HISTORY_RETENTION_DAYS, 30, 1, 365),
    maxSessionsPerUser: num(env.PRESENCE_MAX_SESSIONS, 8, 1, 50),
    deferDays: num(env.PRESENCE_DEFER_DAYS, 1, 0, 30),
  };
}

export interface SessionView {
  inView: boolean;
  lastSeenAt: Date;
  endedAt: Date | null;
}

export interface PriorState {
  state: PresenceState;
  backgroundSince: Date | null;
}

export interface Computed {
  state: PresenceState;
  backgroundSince: Date | null;
  lastSeenAt: Date | null;
}

/**
 * Aggregate every session of one person into a single state, using server time only.
 *  - any fresh session that is visible and focused -> active
 *  - else any fresh session -> background, or away once continuously out of view for the threshold
 *  - else -> offline (cause unknown: closed tab, sleep, suspension and network loss look the same)
 * An expired or ended session can never override a fresh one.
 */
export function computeState(sessions: SessionView[], prior: PriorState | null, now: Date, cfg: Pick<PresenceConfig, 'offlineAfterMs' | 'awayAfterMs'>): Computed {
  const fresh = sessions.filter((s) => !s.endedAt && now.getTime() - s.lastSeenAt.getTime() < cfg.offlineAfterMs);
  const lastSeenAt = sessions.reduce<Date | null>((m, s) => (!m || s.lastSeenAt > m ? s.lastSeenAt : m), null);
  if (!fresh.length) return { state: 'offline', backgroundSince: null, lastSeenAt };
  if (fresh.some((s) => s.inView)) return { state: 'active', backgroundSince: null, lastSeenAt };

  // Out of view. Keep the original start of the background period so Away is measured continuously.
  const since = prior && (prior.state === 'background' || prior.state === 'away') && prior.backgroundSince ? prior.backgroundSince : now;
  const state: PresenceState = now.getTime() - since.getTime() >= cfg.awayAfterMs ? 'away' : 'background';
  return { state, backgroundSince: since, lastSeenAt };
}

/** Whether a stored decision is still in force for the current notice. */
export function consentInForce(c: { noticeVersion: string; decision: string } | null): boolean {
  return !!c && c.noticeVersion === NOTICE_VERSION && c.decision === 'accepted';
}

/** Whether the prompt should be shown: no decision for this notice version, or a deferral that has lapsed. */
export function needsDecision(c: { noticeVersion: string; decision: string; decidedAt: Date } | null, now: Date, deferDays: number): boolean {
  if (!c || c.noticeVersion !== NOTICE_VERSION) return true;
  if (c.decision === 'deferred') return now.getTime() - c.decidedAt.getTime() >= deferDays * 86_400_000;
  return false; // accepted or withdrawn for this version: respected until the notice changes
}
