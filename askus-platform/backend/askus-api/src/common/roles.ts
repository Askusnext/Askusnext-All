export enum Role {
  SuperAdmin = 'SUPER_ADMIN',
  TaxiAdmin = 'TAXI_ADMIN',
  InsuranceAdmin = 'INSURANCE_ADMIN',
  LoansAdmin = 'LOANS_ADMIN',
  OrganicAdmin = 'ORGANIC_ADMIN',
  Employee = 'EMPLOYEE',
  Agent = 'AGENT',
  Customer = 'CUSTOMER',
}

export type Product = 'taxi' | 'insurance' | 'loans' | 'organic';

export const ADMIN_ROLE_PRODUCT: Partial<Record<Role, Product>> = {
  [Role.TaxiAdmin]: 'taxi',
  [Role.InsuranceAdmin]: 'insurance',
  [Role.LoansAdmin]: 'loans',
  [Role.OrganicAdmin]: 'organic',
};
