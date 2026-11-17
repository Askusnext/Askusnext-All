import { STAFF_KEYS, authFetch } from './session';

/** Everything staff do, recorded centrally by the AskUs API (PostgreSQL). */
export const ACTIVITY_LIVE = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);

export type ActivityArea = 'loans' | 'insurance' | 'tickets' | 'timesheet' | 'tracking' | 'auth' | 'system';

export const AREA_LABEL: Record<ActivityArea, { label: string; color: string }> = {
  loans: { label: 'Loans', color: 'blue' },
  insurance: { label: 'Insurance', color: 'purple' },
  tickets: { label: 'Tickets', color: 'volcano' },
  timesheet: { label: 'Timesheet', color: 'cyan' },
  tracking: { label: 'Work tracking', color: 'green' },
  auth: { label: 'Sign-in', color: 'default' },
  system: { label: 'System', color: 'default' },
};

export interface ActivityItem {
  id: string;
  at: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  module: ActivityArea;
  action: string;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
}

export interface ActivityFilter {
  userId?: string;
  module?: string;
  entityId?: string;
  q?: string;
  from?: string;
  to?: string;
  before?: string;
  limit?: number;
}

export interface StaffMember { id: string; name: string; role: string }

export interface SummaryRow {
  userId: string;
  name: string;
  role: string;
  total: number;
  views: number;
  byModule: Partial<Record<ActivityArea, number>>;
  first: string;
  last: string;
}

export interface WorkloadRow { userId: string | null; loans: number; insurance: number; tickets: number; total: number }

const qs = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const activityApi = {
  list: (f: ActivityFilter) => authFetch<{ items: ActivityItem[]; nextBefore: string | null }>(STAFF_KEYS, `/activity${qs({ ...f })}`),
  summary: (from: string, to: string) => authFetch<SummaryRow[]>(STAFF_KEYS, `/activity/summary${qs({ from, to })}`),
  staff: () => authFetch<StaffMember[]>(STAFF_KEYS, '/activity/staff'),
  workload: () => authFetch<WorkloadRow[]>(STAFF_KEYS, '/activity/workload'),
  /** Tell the server a customer record was opened (used for the "who looked at this" trail). */
  view: (e: { module: 'loans' | 'insurance' | 'tickets'; entityType: string; entityId: string; entityLabel?: string }) =>
    authFetch<{ recorded: boolean }>(STAFF_KEYS, '/activity/view', { method: 'POST', body: e }).catch(() => undefined),
};

export const whenFull = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
export const timeOnly = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '—');
export const ago = (iso?: string | null) => {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
