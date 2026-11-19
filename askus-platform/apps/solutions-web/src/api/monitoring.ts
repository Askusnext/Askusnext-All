import { BASE, STAFF_KEYS, authFetch } from './session';

/** Automatic work-hour monitoring: desktop agent pairing, live status, daily totals and targets. */

export type LiveState = 'working' | 'idle' | 'offline';
export type TrackingMethod = 'agent' | 'manual';

export interface MyMonitoring {
  method: TrackingMethod;
  targetMinutesPerDay: number;
  running: boolean;
  startedAt: string | null;
  todayMinutes: number;
  consent: { accepted: boolean; acceptedAt: string | null; policyVersion: string | null; currentVersion: string };
  policy: { version: string; text: string };
  devices: { id: string; deviceName: string; platform: string; pairedAt: string; lastSeenAt: string | null; revoked: boolean }[];
}

export interface LiveRow {
  userId: string; employeeName: string; role: string; method: TrackingMethod; status: LiveState;
  activeApp: string | null; lastSeen: string | null; todayActiveMinutes: number; targetMinutesPerDay: number; consented: boolean; devices: number;
}

export interface WeekRow { weekStart: string; activeMinutes: number; targetMinutes: number; targetToDateMinutes: number; workingDays: number; metTarget: boolean }
export interface SummaryRow {
  userId: string; employeeName: string; role: string; method: TrackingMethod; targetMinutesPerDay: number; totalActiveMinutes: number;
  days: { date: string; totalActiveMinutes: number; totalIdleMinutes: number; firstActivity: string | null; lastActivity: string | null }[];
  weeks: WeekRow[];
}

export interface SettingsView {
  defaultTargetMinutesPerDay: number;
  rules: { id: string; scope: 'user' | 'role'; target: string; label: string; targetMinutesPerDay: number | null; trackingMethod: TrackingMethod | null }[];
}

const call = <T,>(path: string, method = 'GET', body?: unknown) => authFetch<T>(STAFF_KEYS, path, { method, body });

export const monitoringApi = {
  my: () => call<MyMonitoring>('/time/my'),
  consent: (policyVersion: string) => call<MyMonitoring['consent']>('/time/consent', 'POST', { policyVersion }),
  manual: (action: 'start' | 'stop') => call<Omit<MyMonitoring, 'policy' | 'devices'>>('/time/manual-entry', 'POST', { action }),
  pairingCode: () => call<{ code: string; expiresAt: string }>('/agent/pairing-code', 'POST'),
  removeDevice: (id: string) => call<MyMonitoring['devices']>(`/agent/devices/${id}`, 'DELETE'),
  live: () => call<LiveRow[]>('/time/active-status'),
  summary: (from: string, to: string, userId?: string) => call<SummaryRow[]>(`/time/daily-summary?from=${from}&to=${to}${userId ? `&userId=${userId}` : ''}`),
  settings: () => call<SettingsView>('/time/settings'),
  saveSetting: (b: { scope: 'user' | 'role'; target: string; targetMinutesPerDay?: number | null; trackingMethod?: TrackingMethod | null }) => call<SettingsView>('/time/settings', 'PUT', b),
  removeSetting: (id: string) => call<SettingsView>(`/time/settings/${id}`, 'DELETE'),
};

/** Downloads the work-hour report as Excel or PDF. */
export async function downloadHours(from: string, to: string, format: 'xlsx' | 'pdf') {
  const res = await fetch(`${BASE}/reports/export?from=${from}&to=${to}&format=${format}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem(STAFF_KEYS.access) ?? ''}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((Array.isArray(err.message) ? err.message.join(', ') : err.message) || 'Export failed');
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `work-hours-${from}_${to}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export const hoursLabel = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
