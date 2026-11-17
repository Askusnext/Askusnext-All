import type { QuoteStatus } from '../../constants/quoteStatus'
import type { ApplicationStatus, AuditLog, DocumentStatus, LoanApplication, SupportTicket, UserProfile } from '../../types'
import { ApiError, http, isSelf } from './http'

/**
 * Loan data, stored in PostgreSQL through the AskUs API (`/loans/...`).
 * Function names and shapes match the screens; live "subscriptions" are short polls.
 */

const enc = encodeURIComponent
const ME = '/loans/me'
const ADMIN = '/loans/admin'

/** Customers read their own application; reviewers read anyone's through the admin routes. */
const appBase = (uid: string, appId: string) =>
  !uid || isSelf(uid) ? `${ME}/quote-applications/${enc(appId)}` : `${ADMIN}/users/${enc(uid)}/quote-applications/${enc(appId)}`

/** Calls `load` now and every few seconds until the returned function is called. */
function poll<T>(load: () => Promise<T>, onData: (value: T) => void, onError: () => void, ms = 8000): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const run = async () => {
    try {
      const value = await load()
      if (!stopped) onData(value)
    } catch {
      if (!stopped) onError()
    }
    if (!stopped) timer = setTimeout(run, ms)
  }
  void run()
  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}

export type Unsubscribe = () => void

// ---- Customer profile ----

/** Customer-editable fields of the loan profile. */
export interface CustomerDetails {
  fullName: string
  email: string
  dateOfBirth: string
  address: string
  pinCode: string
  panNumber: string
  employmentType: string
  employerName: string
  monthlyIncome: number | null
  gender: string
  maritalStatus: string
  qualification: string
  salaryBank: string
  addressLine2: string
  city: string
  state: string
}

export const fetchCustomerDetails = (_uid: string) => http<CustomerDetails>(`${ME}/details`)

export async function saveCustomerDetails(_uid: string, details: CustomerDetails): Promise<void> {
  await http(`${ME}/details`, { method: 'PUT', body: { details } })
}

// ---- In-progress applications started from the loan quotes page ----

export type QuoteStep = 'know_you' | 'details_confirmed' | 'personal_details' | 'documents' | 'documents_uploaded' | 'submitted'

export interface QuoteApplication {
  id: string
  loanType: string
  lenderId: string
  amount: number
  tenureMonths: number
  roi: number
  status: QuoteStatus
  step: QuoteStep
  purpose?: string
  documentDraftId?: string
  referenceNumber?: string
  consentVersion?: string
  submittedAt?: string
  /** Latest message from the reviewer, shown to the customer. */
  reviewMessage?: string
  reviewedBy?: string
  reviewedAt?: string
  resubmissions?: number
  resubmittedAt?: string
  createdAt?: string
  updatedAt: string
}

export interface QuoteApplicationInput {
  loanType: string
  lenderId: string
  amount: number
  tenureMonths: number
  roi: number
  step: QuoteStep
  purpose?: string
}

export const quoteApplicationId = (loanType: string, lenderId: string) => `${loanType}__${lenderId}`

export async function saveQuoteApplication(_uid: string, input: QuoteApplicationInput): Promise<void> {
  await http(`${ME}/quote-applications`, { method: 'PUT', body: input })
}

/** Final step: records consent, freezes a copy of the details and submits. Returns the reference number. */
export async function submitQuoteApplication(_uid: string, input: Omit<QuoteApplicationInput, 'step'>, consentVersion: string): Promise<string> {
  const result = await http<{ referenceNumber: string }>(`${ME}/quote-applications/submit`, {
    method: 'POST',
    body: { ...input, consentVersion },
  })
  return result.referenceNumber
}

export async function resubmitQuoteApplication(_uid: string, id: string): Promise<void> {
  await http(`${ME}/quote-applications/${enc(id)}/resubmit`, { method: 'POST' })
}

export async function getQuoteApplication(_uid: string, id: string): Promise<QuoteApplication | null> {
  return (await http<QuoteApplication | undefined>(`${ME}/quote-applications/${enc(id)}`)) ?? null
}

/** Returns the id that names this application's uploaded files, creating it once. */
export async function ensureDocumentDraftId(_uid: string, id: string): Promise<string> {
  const result = await http<{ draftId: string }>(`${ME}/quote-applications/${enc(id)}/draft-id`, { method: 'POST' })
  return result.draftId
}

export async function deleteQuoteApplication(_uid: string, id: string): Promise<void> {
  await http(`${ME}/quote-applications/${enc(id)}`, { method: 'DELETE' })
}

/** The customer's applications, newest first, refreshed every few seconds. */
export function subscribeQuoteApplications(_uid: string, onData: (apps: QuoteApplication[]) => void, onError: () => void): Unsubscribe {
  return poll(() => http<QuoteApplication[]>(`${ME}/quote-applications`), onData, onError)
}

/** Live view of a single application (used by the admin detail panel). */
export function subscribeQuoteApplication(uid: string, appId: string, onData: (app: QuoteApplication | null) => void, onError: () => void): Unsubscribe {
  return poll(
    async () => (await http<QuoteApplication | undefined>(appBase(uid, appId))) ?? null,
    onData,
    onError,
  )
}

// ---- Documents ----

export interface QuoteDocument {
  slot: string
  label: string
  fileName: string
  fileSize: number
  mimeType: string
  /** Where the private file is stored on the server. */
  storageKey: string
  fileId: string
  fileFormat: string
  fileVersion: number
  period?: string
  uploadedAt: string
  /** Set by the reviewer; absent until the document has been looked at. */
  reviewStatus?: 'verified' | 'rejected'
  reviewNote?: string
  reviewedAt?: string
  reviewedBy?: string
}

export type QuoteDocumentInput = Omit<QuoteDocument, 'uploadedAt' | 'reviewStatus' | 'reviewNote' | 'reviewedAt' | 'reviewedBy'>

export async function saveQuoteDocument(_uid: string, appId: string, input: QuoteDocumentInput): Promise<void> {
  await http(`${ME}/quote-applications/${enc(appId)}/documents`, { method: 'PUT', body: input })
}

export async function deleteQuoteDocument(_uid: string, appId: string, slot: string): Promise<void> {
  await http(`${ME}/quote-applications/${enc(appId)}/documents/${enc(slot)}`, { method: 'DELETE' })
}

export const fetchQuoteDocuments = (uid: string, appId: string) => http<QuoteDocument[]>(`${appBase(uid, appId)}/documents`)

/** Uploaded document list for one application, refreshed every few seconds. */
export function subscribeQuoteDocuments(uid: string, appId: string, onData: (docs: QuoteDocument[]) => void, onError: () => void): Unsubscribe {
  return poll(() => fetchQuoteDocuments(uid, appId), onData, onError)
}

/** Documents already uploaded for another application, so a new one can reuse them. */
export async function findReusableQuoteDocuments(
  _uid: string,
  excludeAppId: string,
): Promise<{ appId: string; lenderId: string; loanType: string; docs: QuoteDocument[] } | null> {
  return (await http<{ appId: string; lenderId: string; loanType: string; docs: QuoteDocument[] } | undefined>(
    `${ME}/quote-applications/reusable-documents?exclude=${enc(excludeAppId)}`,
  )) ?? null
}

// ---- Timeline, notes, review (reviewer console) ----

export interface AdminQuoteApplication extends QuoteApplication {
  /** Customer this application belongs to. */
  uid: string
}

export const fetchAllQuoteApplications = (_pageSize = 300) => http<AdminQuoteApplication[]>(`${ADMIN}/quote-applications`)

export interface QuoteHistoryEntry {
  id: string
  at: string
  actor: 'admin' | 'customer'
  event: string
  from: string
  to: string
  message?: string
}

export interface QuoteAdminNote {
  id: string
  text: string
  byEmail: string
  at: string
}

/** Status timeline (customer and reviewer), refreshed every few seconds. */
export function subscribeQuoteHistory(uid: string, appId: string, onData: (list: QuoteHistoryEntry[]) => void, onError: () => void): Unsubscribe {
  return poll(() => http<QuoteHistoryEntry[]>(`${appBase(uid, appId)}/history`), onData, onError)
}

export const fetchQuoteAdminNotes = (uid: string, appId: string) =>
  http<QuoteAdminNote[]>(`${ADMIN}/users/${enc(uid)}/quote-applications/${enc(appId)}/notes`)

/** The customer's details as they were when the application was last submitted. */
export async function fetchQuoteSnapshot(uid: string, appId: string): Promise<(Partial<CustomerDetails> & { takenAt?: string }) | null> {
  return (await http<(Partial<CustomerDetails> & { takenAt?: string }) | null | undefined>(
    `${ADMIN}/users/${enc(uid)}/quote-applications/${enc(appId)}/snapshot`,
  )) ?? null
}

interface AdminActor {
  uid: string
  email: string
}

/**
 * Reviewer: move an application to a new status. The server checks the move against the allowed
 * transitions and writes the timeline entry, audit log and (optionally) an internal note together.
 */
export async function adminSetQuoteStatus(input: {
  uid: string
  appId: string
  to: QuoteStatus
  /** Shown to the customer. Required for rejections and document requests. */
  message: string
  internalNote?: string
  admin: AdminActor
}): Promise<void> {
  await http(`${ADMIN}/users/${enc(input.uid)}/quote-applications/${enc(input.appId)}/status`, {
    method: 'POST',
    body: { to: input.to, message: input.message, internalNote: input.internalNote },
  })
}

/** Reviewer: verify a document, or flag it with the reason the customer must fix. */
export async function adminReviewQuoteDocument(input: {
  uid: string
  appId: string
  slot: string
  reviewStatus: 'verified' | 'rejected'
  note?: string
  admin: AdminActor
}): Promise<void> {
  await http(`${ADMIN}/users/${enc(input.uid)}/quote-applications/${enc(input.appId)}/documents/${enc(input.slot)}/review`, {
    method: 'POST',
    body: { reviewStatus: input.reviewStatus, note: input.note },
  })
}

export async function adminAddQuoteNote(uid: string, appId: string, text: string, _admin: AdminActor): Promise<void> {
  await http(`${ADMIN}/users/${enc(uid)}/quote-applications/${enc(appId)}/notes`, { method: 'POST', body: { text } })
}

// ---- Full application form ----

export async function submitLoanApplication(
  data: Omit<LoanApplication, 'id' | 'referenceNumber' | 'createdAt' | 'updatedAt' | 'statusHistory'> & { documentDraftId: string },
): Promise<LoanApplication> {
  const { documents, ...rest } = data
  return http<LoanApplication>(`${ME}/applications`, {
    method: 'POST',
    body: {
      data: rest,
      documents: documents.map((item) => ({
        id: item.id, type: item.type, title: item.title, description: item.description || '', required: item.required,
        ...(item.storageKey
          ? {
              fileName: item.fileName || '', fileSize: item.fileSize || 0, mimeType: item.mimeType || '',
              storageKey: item.storageKey, fileId: item.fileId || '', fileFormat: item.fileFormat || '',
              storageKind: 'raw', fileVersion: item.fileVersion || 0,
            }
          : {}),
      })),
    },
  })
}

export async function fetchUserApplications(userId: string): Promise<LoanApplication[]> {
  if (!userId) return []
  return http<LoanApplication[]>(`${ME}/applications`)
}

export const fetchAllApplications = () => http<LoanApplication[]>(`${ADMIN}/applications`)

export async function fetchApplicationById(id: string): Promise<LoanApplication | null> {
  try {
    return await http<LoanApplication>(`/loans/applications/${enc(id)}`)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null
    throw error
  }
}

export async function updateApplicationStatus(appId: string, newStatus: ApplicationStatus, _adminId: string, note?: string) {
  await http(`${ADMIN}/applications/${enc(appId)}/status`, { method: 'PUT', body: { status: newStatus, note } })
}

export async function updateDocumentVerification(appId: string, docId: string, newStatus: DocumentStatus, _adminId: string, rejectionReason?: string) {
  await http(`${ADMIN}/applications/${enc(appId)}/documents/${enc(docId)}`, { method: 'PUT', body: { status: newStatus, rejectionReason } })
}

// ---- Reviewer console lists, support ----

export const fetchAllUsers = (_pageSize = 100) => http<UserProfile[]>(`${ADMIN}/customers`)

export const fetchAuditLogs = (_pageSize = 100) => http<AuditLog[]>(`${ADMIN}/audit-logs`)

export const fetchSupportTickets = (_userId: string) => http<SupportTicket[]>(`${ME}/support-tickets`)

export async function createSupportTicket(ticket: Record<string, unknown>) {
  return http<SupportTicket>(`${ME}/support-tickets`, {
    method: 'POST',
    body: {
      subject: ticket.subject, message: ticket.message, category: ticket.category,
      userName: ticket.userName, userMobile: ticket.userMobile,
    },
  })
}
