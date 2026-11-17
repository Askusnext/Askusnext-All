import type { Permission, UserRole } from './types';

type Session = { role?: UserRole; permissions?: string[] } | null | undefined;

export const isAdminRole = (role?: UserRole) => role === 'SuperAdmin' || role === 'Admin';

// Super Admin and Admin are never restricted; Employees/Agents need the permission granted.
export const hasPermission = (user: Session, permission?: Permission) =>
  !permission || isAdminRole(user?.role) || Boolean(user?.permissions?.includes(permission));

export const NAV_ITEMS: { to: string; label: string; permission?: Permission; adminOnly?: boolean }[] = [
  { to: '/dashboard', label: 'Dashboard', permission: 'reports' },
  { to: '/board', label: 'Board', permission: 'tickets' },
  { to: '/tickets', label: 'Tickets', permission: 'tickets' },
  { to: '/analytics', label: 'Analytics', permission: 'reports' },
  { to: '/calendar', label: 'Calendar', permission: 'tickets' },
  { to: '/timesheet', label: 'Timesheet', permission: 'timesheet' },
  { to: '/attendance', label: 'Attendance', permission: 'timesheet' },
  { to: '/insurance-requests', label: 'Insurance Requests', permission: 'insurance' },
  { to: '/loans', label: 'Askus Loans', permission: 'loans' },
  { to: '/activity', label: 'Activity' },
  { to: '/renewals', label: 'Renewals', adminOnly: true },
  { to: '/users', label: 'User Management', adminOnly: true },
];

export const canOpen = (user: Session, item: (typeof NAV_ITEMS)[number]) =>
  item.adminOnly ? isAdminRole(user?.role) : hasPermission(user, item.permission);

// First page the user is allowed to see; null when nothing has been granted yet.
export const homePath = (user: Session) => NAV_ITEMS.find((i) => canOpen(user, i))?.to ?? null;
