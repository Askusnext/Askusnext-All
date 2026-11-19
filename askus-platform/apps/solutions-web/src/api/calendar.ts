import { STAFF_KEYS, authFetch } from './session';

/** Unified calendar: synced + manual meetings, leave and status, scoped by role on the server. */

export type CalendarProvider = 'google' | 'microsoft';
export const TEAM_NAMES = ['AskUs Taxi', 'Alphaa Insurance', 'Alphaa Loans', 'Organic Port', 'Software team'] as const;

// Team values are persisted identifiers; rebranding only changes their UI labels.
export function teamLabel(team: string): string {
  switch (team) {
    case 'Alphaa Insurance': return 'Askus Insurance';
    case 'Alphaa Loans': return 'Askus Financial Services';
    default: return team;
  }
}

export interface MeetingItem {
  id: string;
  title: string;
  start: string;
  end: string;
  source: 'synced' | 'manual';
  private: boolean;
  ownerId: string;
  attendees: { name: string | null; email: string | null }[];
  editable: boolean;
}

export interface DayCell {
  status: { status: string; late: number } | null;
  leave: { id: string; leaveType: string; state: 'approved' | 'pending'; from: string; to: string } | null;
  meetings: MeetingItem[];
}

export interface ConnectionInfo {
  id: string;
  provider: CalendarProvider;
  accountEmail: string | null;
  status: 'active' | 'error' | 'revoked';
  lastSyncAt: string | null;
  lastError: string | null;
  connectedAt: string;
}

export interface ConnectionsView {
  providers: Record<CalendarProvider, { configured: boolean }>;
  connections: ConnectionInfo[];
}

export interface MyEvents extends ConnectionsView {
  from: string;
  to: string;
  days: string[];
  cells: Record<string, DayCell>;
}

export type NowState = 'in_meeting' | 'on_leave' | 'working' | 'idle' | 'offline';

export interface GridRow {
  userId: string;
  employeeName: string;
  role: string;
  teams: string[];
  now: NowState;
  cells: Record<string, DayCell>;
}

export interface Grid {
  from: string;
  to: string;
  days: string[];
  team: string | null;
  teams: string[];
  rows: GridRow[];
}

export interface TeamsView {
  allTeams: string[];
  teams: { team: string; members: { userId: string; name: string; role: string }[] }[];
  staff: { userId: string; name: string; role: string }[];
}

const call = <T,>(path: string, method = 'GET', body?: unknown) => authFetch<T>(STAFF_KEYS, path, { method, body });
const range = (from: string, to: string, team?: string) => `from=${from}&to=${to}${team ? `&team=${encodeURIComponent(team)}` : ''}`;

export const calendarApi = {
  myEvents: (from: string, to: string) => call<MyEvents>(`/calendar/my-events?${range(from, to)}`),
  teamView: (from: string, to: string, team?: string) => call<Grid>(`/calendar/team-view?${range(from, to, team)}`),
  orgView: (from: string, to: string, team?: string) => call<Grid>(`/calendar/org-view?${range(from, to, team)}`),
  connect: (provider: CalendarProvider) => call<{ authUrl: string }>('/calendar/connect', 'POST', { provider }),
  disconnect: (id: string) => call<ConnectionsView>(`/calendar/connections/${id}`, 'DELETE'),
  sync: () => call<ConnectionsView & { results: { provider: string; imported?: number; error?: string }[] }>('/calendar/sync', 'POST'),
  teams: () => call<TeamsView>('/calendar/teams'),
  setMember: (team: string, userId: string, member: boolean) => call<TeamsView>('/calendar/teams/members', 'PUT', { team, userId, member }),
  addMeeting: (m: { title: string; startTime: string; endTime: string; employeeId?: string; visibilityScope?: 'private' | 'team' }) =>
    call<{ id: string }>('/meetings/manual', 'POST', m),
  updateMeeting: (id: string, m: { title?: string; startTime?: string; endTime?: string; visibilityScope?: 'private' | 'team' }) => call<unknown>(`/meetings/${id}`, 'PUT', m),
  deleteMeeting: (id: string) => call<unknown>(`/meetings/${id}`, 'DELETE'),
};
