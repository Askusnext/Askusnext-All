// Lifecycle of a loan application started from the quotes page.
//
//   in_progress -> submitted -> under_review -> approved -> disbursed -> closed
//                      |             |  ^            \-> closed
//                      |             v  |
//                      +-> documents_required      rejected -> under_review (reopen) | closed
//
// The allowed admin moves below MUST match ADMIN_TRANSITIONS in backend loans-flow.service.ts,
// which is what actually enforces them.

export type QuoteStatus =
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'documents_required'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'closed'

export type StatusTone = 'amber' | 'blue' | 'orange' | 'green' | 'red' | 'teal' | 'slate'

interface StatusInfo {
  /** Short name used in tables and filters. */
  label: string
  /** What the customer is told. */
  customerLabel: string
  customerHelp: string
  tone: StatusTone
}

export const STATUS_INFO: Record<QuoteStatus, StatusInfo> = {
  in_progress: { label: 'In progress', customerLabel: 'In progress', customerHelp: 'Finish the remaining steps to submit your application.', tone: 'amber' },
  submitted: { label: 'Awaiting review', customerLabel: 'Submitted', customerHelp: 'We have your application and it is waiting for review.', tone: 'blue' },
  under_review: { label: 'Under review', customerLabel: 'Under review', customerHelp: 'Our team is reviewing your details and documents.', tone: 'blue' },
  documents_required: { label: 'Waiting on customer', customerLabel: 'Action needed', customerHelp: 'We need you to update some documents before we can continue.', tone: 'orange' },
  approved: { label: 'Approved', customerLabel: 'Approved', customerHelp: 'Your application has been approved. The lender decides the final terms.', tone: 'green' },
  rejected: { label: 'Not approved', customerLabel: 'Not approved', customerHelp: 'We could not take this application forward.', tone: 'red' },
  disbursed: { label: 'Disbursed', customerLabel: 'Disbursed', customerHelp: 'The loan has been disbursed.', tone: 'teal' },
  closed: { label: 'Closed', customerLabel: 'Closed', customerHelp: 'This application is closed.', tone: 'slate' },
}

export const STATUS_ORDER: QuoteStatus[] = ['in_progress', 'submitted', 'under_review', 'documents_required', 'approved', 'disbursed', 'rejected', 'closed']

/** Statuses a customer has submitted (everything after the draft stage). */
export const isSubmittedStatus = (s: QuoteStatus | undefined): boolean => Boolean(s) && s !== 'in_progress'

/** Admin moves, mirrored from the API (loans-flow.service.ts). */
export const ADMIN_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  in_progress: [],
  submitted: ['under_review', 'documents_required', 'rejected'],
  under_review: ['documents_required', 'approved', 'rejected'],
  documents_required: ['under_review', 'rejected'],
  approved: ['disbursed', 'closed'],
  rejected: ['under_review', 'closed'],
  disbursed: ['closed'],
  closed: [],
}

export interface AdminActionDef {
  to: QuoteStatus
  label: string
  /** Visual weight of the button. */
  kind: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
  /** The customer must be given a message for this move. */
  messageRequired: boolean
  /** Default message offered to the admin (editable). */
  defaultMessage: string
  confirmText: string
}

export const ADMIN_ACTIONS: Record<QuoteStatus, AdminActionDef[]> = {
  in_progress: [],
  submitted: [
    { to: 'under_review', label: 'Start review', kind: 'primary', messageRequired: false, defaultMessage: 'We have started reviewing your application.', confirmText: 'Move to under review' },
    { to: 'documents_required', label: 'Request documents', kind: 'warning', messageRequired: true, defaultMessage: '', confirmText: 'Ask the customer to update documents' },
    { to: 'rejected', label: 'Reject', kind: 'danger', messageRequired: true, defaultMessage: '', confirmText: 'Reject this application' },
  ],
  under_review: [
    { to: 'approved', label: 'Approve', kind: 'success', messageRequired: false, defaultMessage: 'Your application has been approved.', confirmText: 'Approve this application' },
    { to: 'documents_required', label: 'Request documents', kind: 'warning', messageRequired: true, defaultMessage: '', confirmText: 'Ask the customer to update documents' },
    { to: 'rejected', label: 'Reject', kind: 'danger', messageRequired: true, defaultMessage: '', confirmText: 'Reject this application' },
  ],
  documents_required: [
    { to: 'under_review', label: 'Resume review', kind: 'primary', messageRequired: false, defaultMessage: 'We are continuing the review of your application.', confirmText: 'Move back to under review' },
    { to: 'rejected', label: 'Reject', kind: 'danger', messageRequired: true, defaultMessage: '', confirmText: 'Reject this application' },
  ],
  approved: [
    { to: 'disbursed', label: 'Mark disbursed', kind: 'success', messageRequired: false, defaultMessage: 'Your loan has been disbursed.', confirmText: 'Mark as disbursed' },
    { to: 'closed', label: 'Close', kind: 'neutral', messageRequired: false, defaultMessage: '', confirmText: 'Close this application' },
  ],
  rejected: [
    { to: 'under_review', label: 'Reopen for review', kind: 'primary', messageRequired: false, defaultMessage: 'We have reopened your application for review.', confirmText: 'Reopen this application' },
    { to: 'closed', label: 'Close', kind: 'neutral', messageRequired: false, defaultMessage: '', confirmText: 'Close this application' },
  ],
  disbursed: [{ to: 'closed', label: 'Close', kind: 'neutral', messageRequired: false, defaultMessage: '', confirmText: 'Close this application' }],
  closed: [],
}

export const TONE_CLASSES: Record<StatusTone, { admin: string; customer: string }> = {
  amber: { admin: 'bg-amber-500/15 text-amber-300', customer: 'bg-amber-50 text-amber-800' },
  blue: { admin: 'bg-blue-500/15 text-blue-300', customer: 'bg-blue-50 text-blue-700' },
  orange: { admin: 'bg-orange-500/15 text-orange-300', customer: 'bg-orange-50 text-orange-800' },
  green: { admin: 'bg-emerald-500/15 text-emerald-300', customer: 'bg-emerald-50 text-emerald-700' },
  red: { admin: 'bg-rose-500/15 text-rose-300', customer: 'bg-rose-50 text-rose-700' },
  teal: { admin: 'bg-teal-500/15 text-teal-300', customer: 'bg-teal-50 text-teal-700' },
  slate: { admin: 'bg-slate-500/20 text-slate-300', customer: 'bg-slate-100 text-slate-600' },
}
