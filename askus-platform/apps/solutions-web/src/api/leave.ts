import { BASE, STAFF_KEYS, authFetch } from './session';

/** Office attendance, leave and holidays, stored in the central AskUs API (PostgreSQL). */

export type AttendanceStatus = 'Present' | 'Absent' | 'HalfDay' | 'OnLeave' | 'Holiday' | 'WeekOff';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export const STATUS_LABEL: Record<AttendanceStatus, { label: string; code: string; color: string }> = {
  Present: { label: 'Present', code: 'P', color: 'green' },
  Absent: { label: 'Absent', code: 'A', color: 'red' },
  HalfDay: { label: 'Half-day', code: 'HD', color: 'orange' },
  OnLeave: { label: 'On leave', code: 'L', color: 'blue' },
  Holiday: { label: 'Holiday', code: 'H', color: 'purple' },
  WeekOff: { label: 'Week-off', code: 'WO', color: 'default' },
};

export interface TodayStatus {
  date: string;
  status: AttendanceStatus | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  lateByMinutes: number;
  workedMinutes: number;
  canCheckIn: boolean;
  canCheckOut: boolean;
  shiftStart: string;
  graceMinutes: number;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  lateByMinutes: number;
  missedCheckout: boolean;
  source: 'self' | 'admin' | 'leave' | 'system';
  note: string | null;
}

export interface Summary {
  present: number; halfDay: number; absent: number; onLeave: number; holiday: number; weekOff: number;
  lateCount: number; lateMinutes: number; missedCheckouts: number;
}

export interface LeaveType { id: string; name: string; defaultDaysPerYear: number; isPaid: boolean; isActive: boolean }

export interface LeaveBalance {
  leaveTypeId: string; leaveType: string; isPaid: boolean; year: number;
  totalAllotted: number | null; used: number; pending: number; remaining: number | null;
}

export interface LeaveRequest {
  id: string; userId: string; employeeName: string; leaveTypeId: string; leaveType: string;
  fromDate: string; toDate: string; days: number; reason: string; status: LeaveStatus;
  approvedBy: string | null; decidedAt: string | null; decisionNote: string | null; createdAt: string;
}

export interface Holiday { id: string; date: string; name: string; applicableTo: string }

export interface RegisterCell { s: AttendanceStatus | null; late: number; miss: boolean }
export interface RegisterRow { userId: string; employeeName: string; role: string; cells: RegisterCell[]; summary: Summary }
export interface Register { month: string; days: string[]; holidays: Record<string, string>; rows: RegisterRow[]; today: string }

export interface LateReport {
  month: string; graceMinutes: number;
  people: { userId: string; employeeName: string; count: number; totalMinutes: number; days: { date: string; minutes: number }[] }[];
}

export interface MissedCheckout extends AttendanceRecord { userId: string; employeeName: string }

export interface AttendanceConfig {
  shiftStart: string; graceMinutes: number; halfDayMinutes: number; weekOffDays: number[];
  rules: { id: string; scope: 'user' | 'role'; target: string; days: number[] }[];
}

export interface BalanceSummary {
  year: number; types: string[];
  rows: { userId: string; employeeName: string; role: string; balances: LeaveBalance[] }[];
}

const call = <T,>(path: string, method = 'GET', body?: unknown) => authFetch<T>(STAFF_KEYS, path, { method, body });

export const leaveApi = {
  // Attendance
  today: () => call<TodayStatus>('/attendance/today'),
  checkIn: () => call<AttendanceRecord>('/attendance/check-in', 'POST'),
  checkOut: () => call<AttendanceRecord>('/attendance/check-out', 'POST'),
  myRecord: (from: string, to: string) => call<{ from: string; to: string; records: AttendanceRecord[]; summary: Summary }>(`/attendance/my-record?from=${from}&to=${to}`),
  register: (month: string) => call<Register>(`/attendance/register?month=${month}`),
  lateReport: (month: string) => call<LateReport>(`/attendance/late-report?month=${month}`),
  missedCheckouts: () => call<MissedCheckout[]>('/attendance/missed-checkouts'),
  manual: (b: { userId: string; date: string; status: AttendanceStatus; checkIn?: string; checkOut?: string; note?: string }) => call<AttendanceRecord>('/attendance/manual', 'PUT', b),
  config: () => call<AttendanceConfig>('/attendance/config'),
  saveConfig: (b: { shiftStart?: string; graceMinutes?: number; halfDayMinutes?: number; weekOffDays?: number[] }) => call<AttendanceConfig>('/attendance/config', 'PUT', b),
  setWeekOff: (b: { scope: 'user' | 'role'; target: string; days: number[] }) => call<AttendanceConfig>('/attendance/week-off', 'PUT', b),
  removeWeekOff: (id: string) => call<AttendanceConfig>(`/attendance/week-off/${id}`, 'DELETE'),

  // Leave
  types: () => call<LeaveType[]>('/leave/types'),
  balance: (year?: number) => call<LeaveBalance[]>(`/leave/balance${year ? `?year=${year}` : ''}`),
  balanceSummary: (year?: number) => call<BalanceSummary>(`/leave/balance-summary${year ? `?year=${year}` : ''}`),
  my: () => call<LeaveRequest[]>('/leave/my'),
  request: (b: { leaveTypeId: string; fromDate: string; toDate: string; reason: string }) => call<LeaveRequest>('/leave/request', 'POST', b),
  cancel: (id: string) => call<LeaveRequest>(`/leave/${id}/cancel`, 'POST'),
  requests: (status?: LeaveStatus) => call<LeaveRequest[]>(`/leave/requests${status ? `?status=${status}` : ''}`),
  decide: (b: { id: string; decision: 'approved' | 'rejected'; note?: string }) => call<LeaveRequest>('/leave/approve', 'POST', b),

  // Holidays
  holidays: (year?: number) => call<Holiday[]>(`/holidays${year ? `?year=${year}` : ''}`),
  addHoliday: (b: { date: string; name: string }) => call<Holiday>('/holidays', 'POST', b),
  removeHoliday: (id: string) => call<{ message: string }>(`/holidays/${id}`, 'DELETE'),
};

/** Downloads the month's register as Excel or PDF for payroll. */
export async function downloadRegister(month: string, format: 'xlsx' | 'pdf') {
  const res = await fetch(`${BASE}/attendance/export?month=${month}&format=${format}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem(STAFF_KEYS.access) ?? ''}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((Array.isArray(err.message) ? err.message.join(', ') : err.message) || 'Export failed');
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance-${month}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export const hm = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '-';

export const duration = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`);

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
