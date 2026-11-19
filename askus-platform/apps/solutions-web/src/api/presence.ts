import { BASE, STAFF_KEYS, authFetch } from './session';

/** Browser presence and the staff hierarchy. Always separate from desktop monitoring (api/monitoring.ts). */

export type PresenceState = 'active' | 'background' | 'away' | 'offline' | 'not_enabled';

export interface Notice {
  version: string;
  title: string;
  summary: string;
  collected: string;
  audience: string;
  notCollected: string;
  meaning: string;
  stop: string;
}

export interface MyPresence {
  role: string;
  trackable: boolean;
  needsDecision: boolean;
  notice: Notice;
  config: { heartbeatSeconds: number };
  consent: { decision: 'accepted' | 'deferred' | 'withdrawn'; noticeVersion: string; decidedAt: string; current: boolean } | null;
  state: PresenceState;
  stateSince: string | null;
  lastSeenAt: string | null;
}

export interface PresenceRow {
  userId: string;
  name: string;
  role: 'Admin' | 'Employee' | 'Agent';
  reportingAdminId: string | null;
  reportingAdminName: string | null;
  state: PresenceState;
  stateSince: string | null;
  lastSeenAt: string | null;
  version: number;
}

export interface TeamResponse {
  serverNow: string;
  total: number;
  page: number;
  pageSize: number;
  rows: PresenceRow[];
  canAssign: boolean;
  thresholds: { offlineSeconds: number; awayMinutes: number };
}

export interface HistoryResponse {
  userId: string;
  name: string;
  retentionDays: number;
  transitions: { from: PresenceState | null; to: PresenceState; at: string }[];
}

export interface TeamFilter { role?: string; state?: string; adminId?: string; sort?: string; dir?: 'asc' | 'desc'; page?: number; pageSize?: number }

const call = <T,>(path: string, method = 'GET', body?: unknown) => authFetch<T>(STAFF_KEYS, path, { method, body });

const qs = (f: TeamFilter) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const presenceApi = {
  me: () => call<MyPresence>('/presence/me'),
  accept: (noticeVersion: string) => call<MyPresence>('/presence/consent/accept', 'POST', { noticeVersion }),
  defer: (noticeVersion: string) => call<MyPresence>('/presence/consent/defer', 'POST', { noticeVersion }),
  withdraw: () => call<MyPresence>('/presence/consent/withdraw', 'POST'),
  startSession: (inView: boolean) => call<{ sessionId: string; heartbeatSeconds: number }>('/presence/sessions', 'POST', { inView }),
  heartbeat: (sessionId: string, inView: boolean, seq: number) => call<{ ok: boolean; ignored: boolean }>('/presence/heartbeat', 'POST', { sessionId, inView, seq }),
  endSession: (sessionId: string) => call<{ ok: boolean }>('/presence/sessions/end', 'POST', { sessionId }),
  team: (f: TeamFilter = {}) => call<TeamResponse>(`/presence/team${qs(f)}`),
  history: (userId: string, limit = 50) => call<HistoryResponse>(`/presence/team/${userId}/history?limit=${limit}`),
  admins: () => call<{ id: string; name: string }[]>('/presence/admins'),
  assign: (userId: string, adminId: string | null, reason?: string) =>
    call<{ userId: string; reportingAdminId: string | null }>(`/presence/assignments/${userId}`, 'PUT', { adminId, reason: reason || undefined }),
  audit: (userId?: string) => call<{ id: string; at: string; actor: string; subject: string; oldAdmin: string | null; newAdmin: string | null; reason: string | null }[]>(`/presence/assignments/audit${userId ? `?userId=${userId}` : ''}`),
};

/** The session ending is only a hint (the heartbeat timeout is the real fallback), so a failure is ignored. */
export function endSessionBestEffort(sessionId: string) {
  try {
    void fetch(`${BASE}/presence/sessions/end`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(STAFF_KEYS.access) ?? ''}` },
      body: JSON.stringify({ sessionId }),
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

export const wsUrl = () => `${BASE.replace(/^http/, 'ws').replace(/\/api\/?$/, '')}/ws/presence`;

/** Makes sure the stored access token is fresh (refreshing it if needed) and returns it. */
export async function freshAccessToken(): Promise<string | null> {
  try {
    await authFetch(STAFF_KEYS, '/users/me');
  } catch {
    /* a 401 here means the session is gone; the caller sees no token */
  }
  return localStorage.getItem(STAFF_KEYS.access);
}
