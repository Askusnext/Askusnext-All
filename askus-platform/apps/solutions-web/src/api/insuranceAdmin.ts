import { STAFF_KEYS, authFetch } from './session';

/** Insurance requests customers submit on the insurance site, read from the central AskUs API (PostgreSQL). */
export const INSURANCE_LIVE = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);

export const REQUEST_STATUSES = ['new', 'contacted', 'quoted', 'issued', 'closed'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface InsuranceDoc { name: string; size: number; mimeType: string; key: string; format: string; kind?: 'rc' | 'policy' }

export interface InsuranceRequestRow {
  id: string;
  kind: 'offline' | 'upload';
  uid: string;
  createdAt: string;
  updatedAt: string;
  status: RequestStatus;
  adminNote?: string;
  updatedBy?: string;
  vehicleType?: 'car' | 'bike' | 'auto' | 'commercial';
  cashbackUpTo?: number;
  applicant?: Record<string, string>;
  vehicle?: Record<string, string | boolean>;
  policy?: Record<string, string>;
  plan?: { insurers?: string[]; addons?: string[]; ayushPay?: boolean; preferredIdv?: string; idvMode?: string; exShowroom?: string; accessoriesValue?: string };
  name?: string;
  mobile?: string;
  type?: string;
  documents: InsuranceDoc[];
  assignedToId?: string;
  assignedToName?: string;
}

export const insuranceAdminApi = {
  list: () => authFetch<InsuranceRequestRow[]>(STAFF_KEYS, '/insurance/admin/requests'),
  review: (id: string, status: RequestStatus, adminNote: string) =>
    authFetch<InsuranceRequestRow>(STAFF_KEYS, `/insurance/admin/requests/${id}`, { method: 'PATCH', body: { status, adminNote } }),
  assign: (id: string, assigneeId: string | null) =>
    authFetch<InsuranceRequestRow>(STAFF_KEYS, `/insurance/admin/requests/${id}/assign`, { method: 'PATCH', body: { assigneeId } }),
  /** Opens a customer's document in a new tab. */
  openDocument: async (key: string) => {
    const { url } = await authFetch<{ url: string }>(STAFF_KEYS, '/insurance/documents/download', { method: 'POST', body: { key } });
    window.open(url, '_blank', 'noopener');
  },
};
