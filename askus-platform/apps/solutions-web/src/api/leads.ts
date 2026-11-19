import { STAFF_KEYS, authFetch, authFileUrl } from './session';

/** Insurance and loan leads: the unassigned pool, claim lock, stages, documents, payment, commission and reports. */

export type LeadVertical = 'insurance' | 'loan';
export type LeadStatus = 'New' | 'Assigned' | 'QuoteShared' | 'PaymentPending' | 'PaymentUploaded' | 'Issued' | 'Closed' | 'Rejected';
export type DocKind = 'previous_policy' | 'kyc' | 'income_proof' | 'payment_copy' | 'issued_copy' | 'other';

export const STAGES: { key: LeadStatus; label: string }[] = [
  { key: 'New', label: 'New' }, { key: 'Assigned', label: 'Assigned' }, { key: 'QuoteShared', label: 'Quote shared' },
  { key: 'PaymentPending', label: 'Payment pending' }, { key: 'PaymentUploaded', label: 'Payment link/copy uploaded' },
  { key: 'Issued', label: 'Policy/Loan issued' }, { key: 'Closed', label: 'Closed' },
];
export const STAGE_LABEL: Record<LeadStatus, string> = { ...Object.fromEntries(STAGES.map((s) => [s.key, s.label])), Rejected: 'Rejected' } as Record<LeadStatus, string>;
export const DOC_LABEL: Record<DocKind, string> = {
  previous_policy: 'Previous policy', kyc: 'KYC', income_proof: 'Income proof', payment_copy: 'Payment copy', issued_copy: 'Issued copy', other: 'Other',
};

export interface Lead {
  id: string;
  ticketNumber: string;
  vertical: LeadVertical;
  status: LeadStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  createdById: string;
  createdByName: string;
  vehicleRegNo: string | null; vehicleType: string | null; insurer: string | null; policyType: string | null;
  loanType: string | null; loanAmount: number | null; lender: string | null;
  claimedById: string | null; claimedByName: string | null; claimedAt: string | null; lockExpiresAt: string | null;
  quoteAmount: number | null; paymentLinkUrl: string | null; paymentStatus: 'pending' | 'collected'; paidAmount: number | null;
  issuedAmount: number | null; policyNumber: string | null; policyExpiryDate: string | null;
  rejectedReason: string | null; urgent: boolean; slaDueAt: string; slaBreachedAt: string | null; slaOverdue: boolean;
  commissionAmount: number | null; commissionBasis: string | null;
  createdAt: string;
}

export interface LeadDetail extends Lead {
  canWork: boolean;
  events: { id: string; userName: string; action: string; fromStatus: string | null; toStatus: string | null; note: string | null; createdAt: string }[];
  documents: { id: string; kind: DocKind; fileName: string; sizeBytes: number; uploadedByName: string; createdAt: string }[];
  notifications: { id: string; kind: string; audience: string; channel: string; recipient: string; status: 'sent' | 'skipped' | 'failed'; detail: string | null; createdAt: string }[];
}

export interface NewLead {
  vertical: LeadVertical; customerName: string; customerPhone: string; customerEmail?: string;
  vehicleRegNo?: string; vehicleType?: string; insurer?: string; policyType?: string;
  loanType?: string; loanAmount?: number; lender?: string;
}

export interface StatusChange {
  status: LeadStatus; note?: string; quoteAmount?: number; issuedAmount?: number; policyNumber?: string; policyExpiryDate?: string; rejectedReason?: string;
}

export interface Rule { id: string; vertical: LeadVertical; partner: string; kind: 'percent' | 'flat'; value: number }

export const INSURERS = ['HDFC Ergo', 'ICICI Lombard', 'Bajaj Allianz', 'Tata AIG', 'New India Assurance', 'Digit', 'Other'];
export const LENDERS = ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Bajaj Finserv', 'Tata Capital', 'Other'];
export const LOAN_TYPES = ['Personal', 'Business', 'Vehicle', 'Home', 'Education', 'Other'];

const call = <T,>(path: string, method = 'GET', body?: unknown) => authFetch<T>(STAFF_KEYS, path, { method, body });
const qs = (o: Record<string, string | number | undefined>) => Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');

export const leadsApi = {
  list: (q: { scope: string; vertical?: string; status?: string; search?: string; page?: number }) => call<{ data: Lead[]; total: number; page: number; pageSize: number }>(`/leads?${qs(q)}`),
  get: (id: string) => call<LeadDetail>(`/leads/${id}`),
  create: (d: NewLead) => call<Lead>('/leads', 'POST', d),
  claim: (id: string) => call<LeadDetail>(`/leads/${id}/claim`, 'POST'),
  release: (id: string) => call<LeadDetail>(`/leads/${id}/release`, 'POST'),
  setStatus: (id: string, d: StatusChange) => call<LeadDetail>(`/leads/${id}/status`, 'PUT', d),
  generateLink: (id: string) => call<LeadDetail>(`/leads/${id}/payment-link/generate`, 'POST'),
  setLink: (id: string, url: string) => call<LeadDetail>(`/leads/${id}/payment-link`, 'PUT', { url }),
  upload: (id: string, kind: DocKind, file: File, paidAmount?: number) => {
    const f = new FormData();
    f.append('kind', kind);
    if (paidAmount) f.append('paidAmount', String(paidAmount));
    f.append('file', file);
    return authFetch<LeadDetail>(STAFF_KEYS, `/leads/${id}/documents`, { method: 'POST', body: f, isFormData: true });
  },
  openDocument: (leadId: string, docId: string) => authFileUrl(STAFF_KEYS, `/leads/${leadId}/documents/${docId}`),
  rules: () => call<Rule[]>('/leads/commission-rules'),
  saveRule: (r: Omit<Rule, 'id'>) => call<Rule[]>('/leads/commission-rules', 'PUT', r),
  deleteRule: (id: string) => call<Rule[]>(`/leads/commission-rules/${id}`, 'DELETE'),
  conversion: (q: Record<string, string | undefined>) => call<{ userId: string; name: string; created: number; issued: number; rejected: number; open: number; conversionPct: number }[]>(`/leads/reports/conversion?${qs(q)}`),
  split: (q: Record<string, string | undefined>) => call<{ vertical: string; partner: string; leads: number; issued: number; amount: number }[]>(`/leads/reports/split?${qs(q)}`),
  revenue: (q: Record<string, string | undefined>) => call<{ byMonth: { month: string; collected: number; pending: number }[]; byAgent: { userId: string; name: string; collected: number; pending: number }[]; totals: { collected: number; pending: number } }>(`/leads/reports/revenue?${qs(q)}`),
  sla: (q: Record<string, string | undefined>) => call<{ total: number; resolved: number; breached: number; overdueNow: number; urgentBreached: number; avgHoursToResolve: number }>(`/leads/reports/sla?${qs(q)}`),
  commissions: (q: Record<string, string | undefined>) => call<{ userId: string; name: string; vertical: string; leadsClosed: number; business: number; commission: number }[]>(`/leads/reports/commissions?${qs(q)}`),
};
