import { describe, expect, it } from 'vitest';
import { computePayslip, leaveBalance, leaveDays, lopFor, validateLeave, workingDates } from '../src/erp/hr-logic';
import { ERP_MODULES, canOpenNav, moduleForPath, moduleHome } from '../src/erp/modules';

const types = [
  { name: 'Casual Leave', annualQuota: 2, paid: 'Paid', maxConsecutive: 3 },
  { name: 'Loss of Pay', annualQuota: 0, paid: 'Unpaid', maxConsecutive: 30 },
];

describe('leave rules', () => {
  it('skips the weekly off and holidays when counting days', () => {
    // 2026-11-01 is a Sunday.
    expect(workingDates('2026-11-01', '2026-11-07')).toHaveLength(6);
    expect(leaveDays({ fromDate: '2026-11-02', toDate: '2026-11-04' }, 'Sunday', ['2026-11-03'])).toBe(2);
  });

  it('counts approved and pending days against the yearly quota', () => {
    const reqs = [
      { employee: 'A', leaveType: 'Casual Leave', fromDate: '2026-03-02', toDate: '2026-03-02', status: 'Approved' },
      { employee: 'A', leaveType: 'Casual Leave', fromDate: '2026-04-06', toDate: '2026-04-06', status: 'Pending' },
      { employee: 'A', leaveType: 'Casual Leave', fromDate: '2026-05-04', toDate: '2026-05-04', status: 'Rejected' },
    ];
    expect(leaveBalance('A', types[0], reqs, 2026)).toEqual({ quota: 2, used: 1, pending: 1, available: 0 });
  });

  it('rejects over-quota, overlapping, reversed and over-long requests', () => {
    const existing = [{ id: '1', employee: 'A', leaveType: 'Casual Leave', fromDate: '2026-03-02', toDate: '2026-03-03', status: 'Approved' }];
    expect(validateLeave({ employee: 'A', leaveType: 'Casual Leave', fromDate: '2026-06-01', toDate: '2026-06-01', status: 'Pending' }, types, existing)).toMatch(/Only 0 day/);
    expect(validateLeave({ employee: 'A', leaveType: 'Loss of Pay', fromDate: '2026-03-03', toDate: '2026-03-04', status: 'Pending' }, types, existing)).toMatch(/already has leave/);
    expect(validateLeave({ employee: 'A', leaveType: 'Loss of Pay', fromDate: '2026-03-10', toDate: '2026-03-09', status: 'Pending' }, types, existing)).toMatch(/end date/);
    expect(validateLeave({ employee: 'B', leaveType: 'Casual Leave', fromDate: '2026-06-01', toDate: '2026-06-05', status: 'Pending' }, types, [])).toMatch(/at most 3/);
    expect(validateLeave({ employee: 'B', leaveType: 'Loss of Pay', fromDate: '2026-06-01', toDate: '2026-06-05', status: 'Pending' }, types, [])).toBeNull();
  });
});

describe('Timesheet LOP and payroll', () => {
  const base = {
    types, holidays: [] as string[], permissions: [] as any[],
    leaveSettings: { monthlyPaidLeave: 1, weekOff: 'Sunday' },
    permissionSettings: { monthlyCount: 1, maxHoursPerDay: 2, excessToLop: 'Yes', hoursPerLopDay: 8 },
    rules: { lateMarksPerHalfDay: 3 },
  };
  // Feb 2026 has 24 working days (4 Sundays).
  const allPresent = workingDates('2026-02-01', '2026-02-28').map((date) => ({ employee: 'A', date, status: 'Present', lateMinutes: 0 }));

  it('is zero for a full month of attendance', () => {
    const r = lopFor('A', '2026-02', { ...base, attendance: allPresent, leaves: [] });
    expect(r.workingDays).toBe(24);
    expect(r.lopDays).toBe(0);
  });

  it('adds absences, half days, unpaid leave, excess paid leave, late marks and excess permission hours', () => {
    const att = allPresent.map((a, i) => (i === 0 ? { ...a, status: 'Absent' } : i === 1 ? { ...a, status: 'Half Day' } : i < 5 ? { ...a, lateMinutes: 20 } : a));
    const leaves = [
      { employee: 'A', leaveType: 'Casual Leave', fromDate: '2026-02-16', toDate: '2026-02-17', status: 'Approved' }, // 2 paid, allowance 1 → 1 LOP
      { employee: 'A', leaveType: 'Loss of Pay', fromDate: '2026-02-18', toDate: '2026-02-18', status: 'Approved' }, // 1 unpaid
    ];
    const permissions = [
      { employee: 'A', date: '2026-02-10', hours: 3, status: 'Approved' }, // 1 hour over the daily max
      { employee: 'A', date: '2026-02-11', hours: 3, status: 'Approved' }, // over the monthly count → all 3 hours
    ];
    const r = lopFor('A', '2026-02', { ...base, attendance: att, leaves, permissions });
    expect(r).toMatchObject({ absent: 1, halfDays: 1, lateMarks: 3, paidLeave: 2, unpaidLeave: 1, excessPaidLeave: 1, excessPermissionHours: 4 });
    // 1 + 0.5 + 1 + 1 + 0.5 (3 late marks) + 0.5 (4h / 8h)
    expect(r.lopDays).toBe(4.5);
  });

  it('deducts LOP pro rata and skips statutory deductions for interns', () => {
    const p = computePayslip(30000, 3, 30);
    expect(p.lopDeduction).toBe(3000);
    expect(p.earned).toBe(27000);
    expect(p.pf).toBe(1620);
    expect(p.net).toBe(27000 - 1620 - 0 - 208);
    expect(computePayslip(8000, 0, 30, true).net).toBe(8000);
  });
});

describe('module access', () => {
  const hrms = ERP_MODULES.find((m) => m.id === 'hrms')!;
  const accounts = ERP_MODULES.find((m) => m.id === 'accounts')!;
  it('keeps HR admin screens and Accounts away from staff without access', () => {
    const payroll = hrms.nav.find((i) => i.path === '/hrms/payroll')!;
    const leave = hrms.nav.find((i) => i.path === '/hrms/leave')!;
    expect(canOpenNav({ role: 'Employee', permissions: [] }, hrms, payroll)).toBe(false);
    expect(canOpenNav({ role: 'Admin' }, hrms, payroll)).toBe(true);
    expect(canOpenNav({ role: 'Employee', permissions: [] }, hrms, leave)).toBe(true);
    expect(moduleHome({ role: 'Employee', permissions: [] }, accounts)).toBeNull();
    expect(moduleHome({ role: 'Agent', permissions: ['payments'] }, accounts)).toBe('/accounts/dashboard');
  });
  it("keeps Owner's Desk and Setup for owners and admins only", () => {
    const owner = ERP_MODULES.find((m) => m.id === 'owner')!;
    const setup = ERP_MODULES.find((m) => m.id === 'setup')!;
    expect(moduleHome({ role: 'Employee', permissions: ['payments', 'tickets'] }, owner)).toBeNull();
    expect(moduleHome({ role: 'Employee', permissions: [] }, setup)).toBeNull();
    expect(moduleHome({ role: 'Admin' }, owner)).toBe('/owner/snapshot');
    expect(moduleHome({ role: 'SuperAdmin' }, setup)).toBe('/setup');
  });
  it('maps URLs to their module, preferring the one already open', () => {
    expect(moduleForPath('/crm/leads/new')?.id).toBe('crm');
    expect(moduleForPath('/accounts/cash-book', null)?.id).toBe('accounts');
    expect(moduleForPath('/setup/leave-types', null)?.id).toBe('setup');
    expect(moduleForPath('/hrms/leave/holidays', 'hrms')?.id).toBe('hrms');
    expect(moduleForPath('/calendar', null)).toBeNull();
  });
});
