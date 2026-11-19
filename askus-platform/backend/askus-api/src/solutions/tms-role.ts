import { Role } from '../common/roles';

// Role names as the Solutions app uses them. Kept in its own file so services can share it without import cycles.
export type TmsRole = 'SuperAdmin' | 'Admin' | 'Employee' | 'Agent' | 'Customer';
export type StaffRole = Exclude<TmsRole, 'SuperAdmin' | 'Customer'>;

const TO_TMS: Partial<Record<Role, TmsRole>> = {
  [Role.SuperAdmin]: 'SuperAdmin',
  [Role.Admin]: 'Admin',
  [Role.Employee]: 'Employee',
  [Role.Agent]: 'Agent',
};

/** The highest Solutions role a user holds; product admins (Taxi, Loans...) and Customers map to 'Customer'. */
export const toTmsRole = (roles: Role[]): TmsRole =>
  (['SuperAdmin', 'Admin', 'Employee', 'Agent'] as const).find((r) => roles.some((x) => TO_TMS[x] === r)) ?? 'Customer';
