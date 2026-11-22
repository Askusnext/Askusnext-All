/**
 * Pure HR rules used by the leave, Timesheet LOP and payroll screens.
 * Kept free of React and storage so they can be unit tested.
 */
export interface LeaveType { name: string; annualQuota: number; paid: 'Paid' | 'Unpaid' | string; maxConsecutive?: number }
export interface LeaveReq { employee: string; leaveType: string; fromDate: string; toDate: string; status: string; id?: string }
export interface AttendanceRow { employee: string; date: string; status: string; lateMinutes?: number }
export interface PermissionReq { employee: string; date: string; hours: number; status: string }
export interface LeaveSettings { monthlyPaidLeave: number; weekOff?: string }
export interface PermissionSettings { monthlyCount: number; maxHoursPerDay: number; excessToLop?: string; hoursPerLopDay: number }
export interface AttendanceRules { lateMarksPerHalfDay: number }

const DAY = 86400000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const parse = (d: string) => new Date(`${d}T00:00:00`);
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Each calendar date from `from` to `to` inclusive. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const a = parse(from);
  const b = parse(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return out;
  for (let t = a.getTime(); t <= b.getTime(); t += DAY) out.push(fmt(new Date(t)));
  return out;
}

/** Working dates (excluding the weekly off day and holidays). */
export function workingDates(from: string, to: string, weekOff = 'Sunday', holidays: string[] = []): string[] {
  const off = WEEKDAYS.indexOf(weekOff);
  const hol = new Set(holidays);
  return datesBetween(from, to).filter((d) => parse(d).getDay() !== off && !hol.has(d));
}

export const leaveDays = (r: Pick<LeaveReq, 'fromDate' | 'toDate'>, weekOff?: string, holidays?: string[]) =>
  workingDates(r.fromDate, r.toDate, weekOff, holidays).length;

/** Remaining annual balance for one employee and leave type, counting approved and pending requests. */
export function leaveBalance(employee: string, type: LeaveType, requests: LeaveReq[], year: number, weekOff?: string, holidays?: string[]) {
  const mine = requests.filter((r) => r.employee === employee && r.leaveType === type.name && r.fromDate.startsWith(String(year)));
  const used = mine.filter((r) => r.status === 'Approved').reduce((s, r) => s + leaveDays(r, weekOff, holidays), 0);
  const pending = mine.filter((r) => r.status === 'Pending').reduce((s, r) => s + leaveDays(r, weekOff, holidays), 0);
  const quota = Number(type.annualQuota) || 0;
  return { quota, used, pending, available: Math.max(0, quota - used - pending) };
}

/** Returns a reason the request cannot be submitted, or null when it is valid. */
export function validateLeave(req: LeaveReq, types: LeaveType[], all: LeaveReq[], weekOff?: string, holidays?: string[]): string | null {
  const type = types.find((t) => t.name === req.leaveType);
  if (!type) return 'Choose a leave type.';
  if (!req.fromDate || !req.toDate || req.toDate < req.fromDate) return 'The end date must be on or after the start date.';
  const days = leaveDays(req, weekOff, holidays);
  if (days === 0) return 'The selected dates fall on week-offs or holidays.';
  if (type.maxConsecutive && days > Number(type.maxConsecutive)) return `${type.name} allows at most ${type.maxConsecutive} consecutive working days.`;
  const overlap = all.some((r) => r.id !== req.id && r.employee === req.employee && ['Pending', 'Approved'].includes(r.status)
    && r.fromDate <= req.toDate && req.fromDate <= r.toDate);
  if (overlap) return 'This employee already has leave on some of these dates.';
  if (type.paid === 'Paid' && Number(type.annualQuota) > 0) {
    const others = all.filter((r) => r.id !== req.id);
    const bal = leaveBalance(req.employee, type, others, Number(req.fromDate.slice(0, 4)), weekOff, holidays);
    if (days > bal.available) return `Only ${bal.available} day(s) of ${type.name} available. Apply the rest as Loss of Pay.`;
  }
  return null;
}

export interface LopBreakdown {
  workingDays: number; present: number; halfDays: number; absent: number; lateMarks: number;
  paidLeave: number; unpaidLeave: number; excessPaidLeave: number; permissionHours: number; excessPermissionHours: number;
  lopDays: number; payableDays: number;
}

/**
 * Loss-of-pay days for one employee in a month (YYYY-MM), up to `until` (inclusive).
 * LOP = absent + ½·half-days + unpaid leave + paid leave above the monthly allowance
 *     + ½ day per N late marks + excess permission hours ÷ hours-per-day.
 */
export function lopFor(
  employee: string, month: string, data: {
    attendance: AttendanceRow[]; leaves: LeaveReq[]; types: LeaveType[]; permissions: PermissionReq[];
    leaveSettings: LeaveSettings; permissionSettings: PermissionSettings; rules: AttendanceRules; holidays: string[]; until?: string;
  },
): LopBreakdown {
  const [y, m] = month.split('-').map(Number);
  const last = fmt(new Date(y, m, 0));
  const end = data.until && data.until < last ? data.until : last;
  const start = `${month}-01`;
  const weekOff = data.leaveSettings.weekOff ?? 'Sunday';
  const work = end < start ? [] : workingDates(start, end, weekOff, data.holidays);
  const workSet = new Set(work);

  const leaveDates = new Map<string, 'Paid' | 'Unpaid'>();
  data.leaves.filter((l) => l.employee === employee && l.status === 'Approved').forEach((l) => {
    const t = data.types.find((x) => x.name === l.leaveType);
    datesBetween(l.fromDate, l.toDate).filter((d) => workSet.has(d)).forEach((d) => leaveDates.set(d, t?.paid === 'Paid' ? 'Paid' : 'Unpaid'));
  });

  const att = new Map(data.attendance.filter((a) => a.employee === employee && workSet.has(a.date)).map((a) => [a.date, a]));
  let present = 0; let halfDays = 0; let absent = 0; let lateMarks = 0;
  work.forEach((d) => {
    if (leaveDates.has(d)) return;
    const a = att.get(d);
    if (!a || a.status === 'Absent') absent += 1;
    else if (a.status === 'Half Day') halfDays += 1;
    else if (a.status === 'Present') { present += 1; if (Number(a.lateMinutes) > 0) lateMarks += 1; }
    else if (a.status === 'Holiday') { /* counted as working holiday */ }
  });

  const paidLeave = [...leaveDates.values()].filter((v) => v === 'Paid').length;
  const unpaidLeave = [...leaveDates.values()].filter((v) => v === 'Unpaid').length;
  const excessPaidLeave = Math.max(0, paidLeave - (Number(data.leaveSettings.monthlyPaidLeave) || 0));

  const perms = data.permissions.filter((p) => p.employee === employee && p.status === 'Approved' && p.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
  const permissionHours = perms.reduce((s, p) => s + Number(p.hours || 0), 0);
  const allowedCount = Number(data.permissionSettings.monthlyCount) || 0;
  const maxPerDay = Number(data.permissionSettings.maxHoursPerDay) || 0;
  const excessPermissionHours = data.permissionSettings.excessToLop === 'No' ? 0 : perms.reduce((s, p, i) => {
    const hours = Number(p.hours || 0);
    return s + (i < allowedCount ? Math.max(0, hours - maxPerDay) : hours);
  }, 0);

  const latePer = Number(data.rules.lateMarksPerHalfDay) || 0;
  const lateLop = latePer ? Math.floor(lateMarks / latePer) * 0.5 : 0;
  const permLop = excessPermissionHours / (Number(data.permissionSettings.hoursPerLopDay) || 8);
  const lopDays = Math.round((absent + halfDays * 0.5 + unpaidLeave + excessPaidLeave + lateLop + permLop) * 100) / 100;
  return {
    workingDays: work.length, present, halfDays, absent, lateMarks, paidLeave, unpaidLeave, excessPaidLeave,
    permissionHours, excessPermissionHours, lopDays, payableDays: Math.max(0, work.length - lopDays),
  };
}

export interface Payslip { gross: number; perDay: number; lopDeduction: number; earned: number; pf: number; esi: number; pt: number; net: number }

/** Illustrative salary computation: replace the statutory rates with your payroll provider's figures. */
export function computePayslip(gross: number, lopDays: number, daysInMonth: number, intern = false): Payslip {
  const perDay = gross / daysInMonth;
  const lopDeduction = Math.round(perDay * lopDays);
  const earned = Math.max(0, gross - lopDeduction);
  const basic = earned * 0.5;
  const pf = intern ? 0 : Math.min(1800, Math.round(basic * 0.12));
  const esi = intern || gross > 21000 ? 0 : Math.round(earned * 0.0075);
  const pt = intern || earned < 21000 ? 0 : 208;
  return { gross, perDay: Math.round(perDay), lopDeduction, earned, pf, esi, pt, net: earned - pf - esi - pt };
}
