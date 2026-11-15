import { STAFF_KEYS, authFetch, authFileUrl } from './session';

/** Askus Loans data for staff, read from and written to the central AskUs API (PostgreSQL). */

/** The loans console needs the real backend; without it the app runs on mock data. */
export const LOANS_LIVE = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);

const enc = encodeURIComponent;
const call = <T,>(path: string, method = 'GET', body?: unknown) => authFetch<T>(STAFF_KEYS, `/loans/admin${path}`, { method, body });

export type JourneyStatus =
  | 'in_progress' | 'submitted' | 'under_review' | 'documents_required' | 'approved' | 'rejected' | 'disbursed' | 'closed';

export interface LoanJourney {
  id: string;
  uid: string;
  loanType: string;
  lenderId: string;
  amount: number;
  tenureMonths: number;
  roi: number;
  status: JourneyStatus;
  step: string;
  purpose?: string;
  referenceNumber?: string;
  submittedAt?: string;
  reviewMessage?: string;
  resubmissions?: number;
  createdAt?: string;
  updatedAt: string;
  customerName: string;
  customerMobile: string;
  assignedToId?: string;
  assignedToName?: string;
}

export interface LoanDocument {
  slot: string;
  label: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  period?: string;
  uploadedAt: string;
  reviewStatus?: 'verified' | 'rejected';
  reviewNote?: string;
}

export interface JourneyHistory { id: string; at: string; actor: 'admin' | 'customer'; event: string; from: string; to: string; message?: string }
export interface JourneyNote { id: string; text: string; byEmail: string; at: string }

export interface FormDocument {
  id: string;
  type: string;
  title: string;
  required: boolean;
  status: 'pending' | 'verified' | 'rejected' | 'reupload_required';
  fileName?: string;
  fileSize?: number;
  storageKey?: string;
  rejectionReason?: string;
}

export interface LoanForm {
  id: string;
  referenceNumber: string;
  userId: string;
  userName?: string;
  userMobile?: string;
  serviceName?: string;
  lenderName?: string;
  loanAmount?: number;
  tenureMonths?: number;
  interestRate?: number;
  calculatedEmi?: number;
  purpose?: string;
  fullName?: string;
  dob?: string;
  panNumber?: string;
  city?: string;
  state?: string;
  pincode?: string;
  currentAddress?: string;
  employmentType?: string;
  employerName?: string;
  designation?: string;
  monthlyIncome?: number;
  status: string;
  statusHistory: { status: string; timestamp: string; note?: string }[];
  documents: FormDocument[];
  adminNotes?: string;
  assignedToId?: string;
  assignedToName?: string;
  createdAt: string;
  updatedAt: string;
}

export const loansAdminApi = {
  journeys: () => call<LoanJourney[]>('/quote-applications'),
  journeyDocs: (j: LoanJourney) => call<LoanDocument[]>(`/users/${enc(j.uid)}/quote-applications/${enc(j.id)}/documents`),
  journeyHistory: (j: LoanJourney) => call<JourneyHistory[]>(`/users/${enc(j.uid)}/quote-applications/${enc(j.id)}/history`),
  journeyNotes: (j: LoanJourney) => call<JourneyNote[]>(`/users/${enc(j.uid)}/quote-applications/${enc(j.id)}/notes`),
  journeySnapshot: (j: LoanJourney) => call<Record<string, unknown> | null>(`/users/${enc(j.uid)}/quote-applications/${enc(j.id)}/snapshot`),
  setJourneyStatus: (j: LoanJourney, to: JourneyStatus, message: string, internalNote?: string) =>
    call<void>(`/users/${enc(j.uid)}/quote-applications/${enc(j.id)}/status`, 'POST', { to, message, internalNote }),
  reviewJourneyDoc: (j: LoanJourney, slot: string, reviewStatus: 'verified' | 'rejected', note?: string) =>
    call<void>(`/users/${enc(j.uid)}/quote-applications/${enc(j.id)}/documents/${enc(slot)}/review`, 'POST', { reviewStatus, note }),
  addJourneyNote: (j: LoanJourney, text: string) =>
    call<void>(`/users/${enc(j.uid)}/quote-applications/${enc(j.id)}/notes`, 'POST', { text }),

  assignJourney: (j: LoanJourney, assigneeId: string | null) =>
    call<LoanJourney>(`/users/${enc(j.uid)}/quote-applications/${enc(j.id)}/assign`, 'POST', { assigneeId }),
  assignForm: (id: string, assigneeId: string | null) => call<LoanForm>(`/applications/${enc(id)}/assign`, 'POST', { assigneeId }),

  forms: () => call<LoanForm[]>('/applications'),
  setFormStatus: (id: string, status: string, note?: string) => call<void>(`/applications/${enc(id)}/status`, 'PUT', { status, note }),
  reviewFormDoc: (id: string, docId: string, status: string, rejectionReason?: string) =>
    call<void>(`/applications/${enc(id)}/documents/${enc(docId)}`, 'PUT', { status, rejectionReason }),

  /** Opens a customer's private file in a new tab. */
  openFile: async (storageKey: string) => {
    const url = await authFileUrl(STAFF_KEYS, `/loans/files?key=${enc(storageKey)}`);
    window.open(url, '_blank', 'noopener');
  },
};

/** Status labels and the moves a reviewer may make (mirrors the API's rules). */
export const JOURNEY_STATUS: Record<JourneyStatus, { label: string; color: string }> = {
  in_progress: { label: 'In progress (draft)', color: 'gold' },
  submitted: { label: 'Awaiting review', color: 'blue' },
  under_review: { label: 'Under review', color: 'geekblue' },
  documents_required: { label: 'Waiting on customer', color: 'orange' },
  approved: { label: 'Approved', color: 'green' },
  rejected: { label: 'Not approved', color: 'red' },
  disbursed: { label: 'Disbursed', color: 'cyan' },
  closed: { label: 'Closed', color: 'default' },
};

export interface JourneyAction {
  to: JourneyStatus;
  label: string;
  danger?: boolean;
  primary?: boolean;
  messageRequired: boolean;
  defaultMessage: string;
}

export const JOURNEY_ACTIONS: Record<JourneyStatus, JourneyAction[]> = {
  in_progress: [],
  submitted: [
    { to: 'under_review', label: 'Start review', primary: true, messageRequired: false, defaultMessage: 'We have started reviewing your application.' },
    { to: 'documents_required', label: 'Request documents', messageRequired: true, defaultMessage: '' },
    { to: 'rejected', label: 'Reject', danger: true, messageRequired: true, defaultMessage: '' },
  ],
  under_review: [
    { to: 'approved', label: 'Approve', primary: true, messageRequired: false, defaultMessage: 'Your application has been approved.' },
    { to: 'documents_required', label: 'Request documents', messageRequired: true, defaultMessage: '' },
    { to: 'rejected', label: 'Reject', danger: true, messageRequired: true, defaultMessage: '' },
  ],
  documents_required: [
    { to: 'under_review', label: 'Resume review', primary: true, messageRequired: false, defaultMessage: 'We are continuing the review of your application.' },
    { to: 'rejected', label: 'Reject', danger: true, messageRequired: true, defaultMessage: '' },
  ],
  approved: [
    { to: 'disbursed', label: 'Mark disbursed', primary: true, messageRequired: false, defaultMessage: 'Your loan has been disbursed.' },
    { to: 'closed', label: 'Close', messageRequired: false, defaultMessage: '' },
  ],
  rejected: [
    { to: 'under_review', label: 'Reopen for review', primary: true, messageRequired: false, defaultMessage: 'We have reopened your application for review.' },
    { to: 'closed', label: 'Close', messageRequired: false, defaultMessage: '' },
  ],
  disbursed: [{ to: 'closed', label: 'Close', messageRequired: false, defaultMessage: '' }],
  closed: [],
};

export const FORM_STATUSES = [
  'submitted', 'under_review', 'documents_required', 'verification_pending', 'approved', 'rejected', 'disbursed', 'closed',
];
