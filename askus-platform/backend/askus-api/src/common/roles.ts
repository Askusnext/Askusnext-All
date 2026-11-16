export enum Role {
  SuperAdmin = 'SUPER_ADMIN',
  Admin = 'ADMIN',
  TaxiAdmin = 'TAXI_ADMIN',
  InsuranceAdmin = 'INSURANCE_ADMIN',
  LoansAdmin = 'LOANS_ADMIN',
  OrganicAdmin = 'ORGANIC_ADMIN',
  Employee = 'EMPLOYEE',
  Agent = 'AGENT',
  Customer = 'CUSTOMER',
}

// Granted per Employee/Agent by an Admin; Admin and Super Admin are never restricted by these.
export const PERMISSIONS = ['tickets', 'payments', 'timesheet', 'kb', 'users', 'reports'] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type Product = 'taxi' | 'insurance' | 'loans' | 'organic';

export const ADMIN_ROLE_PRODUCT: Partial<Record<Role, Product>> = {
  [Role.TaxiAdmin]: 'taxi',
  [Role.InsuranceAdmin]: 'insurance',
  [Role.LoansAdmin]: 'loans',
  [Role.OrganicAdmin]: 'organic',
};
