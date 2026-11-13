export const PRODUCTS = ['taxi', 'insurance', 'loans', 'organic'] as const;
export type Product = (typeof PRODUCTS)[number];

export const ROLES = [
  'SUPER_ADMIN',
  'TAXI_ADMIN',
  'INSURANCE_ADMIN',
  'LOANS_ADMIN',
  'ORGANIC_ADMIN',
  'EMPLOYEE',
  'AGENT',
  'CUSTOMER',
] as const;
export type Role = (typeof ROLES)[number];

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserDto {
  id: string;
  mobile: string | null;
  email: string | null;
  fullName: string | null;
  roles: Role[];
  isActive: boolean;
  createdAt: string;
}

export interface CustomerProfileDto {
  userId: string;
  displayName: string | null;
  city: string | null;
  address: string | null;
  pincode: string | null;
  contactEmail: string | null;
  mobile: string | null;
  loginEmail: string | null;
  products: Product[];
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

export const REQUEST_STATUSES = ['new', 'contacted', 'quoted', 'issued', 'closed'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface DocRef {
  name: string;
  size: number;
  mimeType: string;
  key: string;
  format: string;
  kind?: 'rc' | 'policy';
}

// Offline quote requests and document submissions share one shape.
export interface InsuranceRequestDto {
  id: string;
  kind: 'offline' | 'upload';
  uid: string;
  createdAt: string;
  updatedAt: string;
  status: RequestStatus;
  adminNote?: string;
  updatedBy?: string;
  vehicleType?: 'car' | 'bike';
  cashbackUpTo?: number;
  applicant?: Record<string, string>;
  vehicle?: Record<string, string | boolean>;
  policy?: Record<string, string>;
  plan?: { insurers?: string[]; addons?: string[]; preferredIdv?: string; ayushPay?: boolean; [k: string]: unknown };
  name?: string;
  mobile?: string;
  type?: string;
  documents: DocRef[];
}

export interface BusinessSummaryDto {
  product: Product;
  totalRecords: number;
  totalAmount: string;
  updatedAt: string;
}
