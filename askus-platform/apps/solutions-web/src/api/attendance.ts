import { STAFF_KEYS, authFetch } from './session';

/** Work sessions and location tracking, stored in the central AskUs API (PostgreSQL). */
export const TRACKING_LIVE = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);

const call = <T,>(path: string, method = 'GET', body?: unknown) => authFetch<T>(STAFF_KEYS, `/attendance${path}`, { method, body });

export interface Fix { lat?: number; lng?: number; accuracy?: number }

export interface WorkSession {
  id: string;
  day: string;
  startedAt: string;
  endedAt: string | null;
  endReason: 'manual' | 'auto' | null;
  live: boolean;
  minutes: number;
  start: { lat: number; lng: number } | null;
  end: { lat: number; lng: number } | null;
  last: { lat: number; lng: number; accuracy: number | null } | null;
  lastPingAt: string | null;
  lastState: 'active' | 'idle';
}

export interface MyAttendance {
  consentVersion: string;
  consented: boolean;
  today: string;
  active: WorkSession | null;
  sessions: WorkSession[];
  todayMinutes: number;
}

export type LiveStatus = 'working' | 'idle' | 'signal_lost' | 'ended' | 'not_started';

export interface LiveRow {
  userId: string;
  employeeName: string;
  employeeId: string;
  role: 'Admin' | 'Employee' | 'Agent';
  consented: boolean;
  status: LiveStatus;
  firstStartedAt: string | null;
  minutes: number;
  sessions: number;
  lastSeen: string | null;
  lastLocation: { lat: number; lng: number; accuracy: number | null } | null;
}

export interface Trail {
  userId: string;
  employeeName: string;
  day: string;
  totalMinutes: number;
  sessions: WorkSession[];
  pings: { at: string; lat: number | null; lng: number | null; accuracy: number | null; state: 'active' | 'idle'; sessionId: string }[];
}

export const attendanceApi = {
  me: () => call<MyAttendance>('/me'),
  consent: (version: string) => call<{ consented: boolean }>('/consent', 'POST', { version }),
  start: (fix: Fix) => call<WorkSession>('/start', 'POST', fix),
  ping: (fix: Fix, state: 'active' | 'idle') => call<WorkSession>('/ping', 'POST', { ...fix, state }),
  stop: (fix: Fix) => call<MyAttendance>('/stop', 'POST', fix),
  live: (date?: string) => call<LiveRow[]>(`/live${date ? `?date=${date}` : ''}`),
  trail: (userId: string, date: string) => call<Trail>(`/trail?userId=${userId}&date=${date}`),
};

export const minutesLabel = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`);

export const mapLink = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
