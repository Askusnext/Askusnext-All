import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, canOpen } from '../src/access';

const open = (role: string) => NAV_ITEMS.filter((i) => canOpen({ role: role as never, permissions: ['timesheet', 'users', 'reports', 'tickets'] }, i)).map((i) => i.to);

describe('who gets the Team Presence page', () => {
  it('only Admin and Super Admin; never Employee, Agent or a Customer-shaped session', () => {
    expect(open('SuperAdmin')).toContain('/presence');
    expect(open('Admin')).toContain('/presence');
    expect(open('Employee')).not.toContain('/presence');
    expect(open('Agent')).not.toContain('/presence');
    expect(open('Customer')).not.toContain('/presence');
  });

  it('holding every permission does not unlock it for Employees or Agents', () => {
    const everything = ['tickets', 'payments', 'timesheet', 'kb', 'users', 'reports', 'loans', 'insurance'];
    const item = NAV_ITEMS.find((i) => i.to === '/presence')!;
    expect(canOpen({ role: 'Employee', permissions: everything }, item)).toBe(false);
    expect(canOpen({ role: 'Agent', permissions: everything }, item)).toBe(false);
  });
});
