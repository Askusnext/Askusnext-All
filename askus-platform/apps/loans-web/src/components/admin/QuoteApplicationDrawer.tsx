import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, FileText, Loader2, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  adminAddQuoteNote, adminReviewQuoteDocument, adminSetQuoteStatus, fetchCustomerDetails, fetchQuoteAdminNotes, fetchQuoteSnapshot,
  subscribeQuoteApplication, subscribeQuoteDocuments, subscribeQuoteHistory,
  type AdminQuoteApplication, type CustomerDetails, type QuoteAdminNote, type QuoteApplication, type QuoteDocument, type QuoteHistoryEntry,
} from '../../services/api/loansApi'
import { getQuoteDocumentUrl } from '../../services/api/storageService'
import { QUOTE_STEP_ORDER, stepIndex } from '../../constants/quoteSteps'
import { ADMIN_ACTIONS, STATUS_INFO, TONE_CLASSES, type AdminActionDef, type QuoteStatus } from '../../constants/quoteStatus'
import { DOCUMENT_LABELS, missingRequired } from '../../constants/quoteDocuments'
import { findLender } from '../../constants/quotesData'
import { QUOTE_TYPE_NAMES } from '../../constants/quotesTypes'
import { formatAmountLabel } from '../../utils/quotes'
import type { UserProfile } from '../../types'

const when = (iso?: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const FIELD_LABELS: [keyof CustomerDetails, string][] = [
  ['fullName', 'Full name'], ['panNumber', 'PAN'], ['dateOfBirth', 'Date of birth'], ['gender', 'Gender'], ['maritalStatus', 'Marital status'],
  ['qualification', 'Qualification'], ['email', 'Email'], ['address', 'Address line 1'], ['addressLine2', 'Address line 2'], ['city', 'City'],
  ['state', 'State'], ['pinCode', 'Pincode'], ['employmentType', 'Employment'], ['employerName', 'Employer'], ['monthlyIncome', 'Monthly income'], ['salaryBank', 'Salary bank'],
]

const Detail: React.FC<{ label: string; value?: string | number | null; wide?: boolean; changed?: boolean }> = ({ label, value, wide, changed }) => (
  <div className={wide ? 'col-span-2' : ''}>
    <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}{changed && <span className="ml-1.5 rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-300">CHANGED SINCE</span>}</p>
    <p className="mt-0.5 break-words text-[13px] font-medium text-slate-100">{value === undefined || value === null || value === '' ? '-' : value}</p>
  </div>
)

const Section: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, right, children }) => (
  <section className="border-t border-slate-800 px-6 py-5">
    <div className="mb-3 flex items-center justify-between">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h4>
      {right}
    </div>
    {children}
  </section>
)

const buttonKind: Record<AdminActionDef['kind'], string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-500',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500',
  warning: 'bg-orange-500 text-white hover:bg-orange-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
  neutral: 'bg-slate-700 text-white hover:bg-slate-600',
}

interface DialogProps {
  action: AdminActionDef
  docs: QuoteDocument[]
  busy: boolean
  error: string
  onCancel: () => void
  onConfirm: (message: string, internalNote: string) => void
}

/** Confirms a status change: what the customer will be told, and an optional internal note. */
const ActionDialog: React.FC<DialogProps> = ({ action, docs, busy, error, onCancel, onConfirm }) => {
  const flagged = docs.filter((d) => d.reviewStatus === 'rejected')
  const missing = missingRequired(Object.fromEntries(docs.map((d) => [d.slot, d])))
  const isRequest = action.to === 'documents_required'
  const defaultMessage = useMemo(() => {
    if (!isRequest) return action.defaultMessage
    const parts = [
      ...flagged.map((d) => `${DOCUMENT_LABELS[d.slot] ?? d.slot}: ${d.reviewNote || 'please upload a clearer copy'}`),
      ...missing.map((m) => `Upload ${m.label}`),
    ]
    return parts.length ? `Please update the following: ${parts.join('. ')}.` : ''
  }, [isRequest, action.defaultMessage, flagged, missing])
  const [message, setMessage] = useState(defaultMessage)
  const [note, setNote] = useState('')
  const unverified = docs.filter((d) => d.reviewStatus !== 'verified').length
  const nothingToFix = isRequest && flagged.length === 0 && missing.length === 0
  const messageMissing = action.messageRequired && message.trim().length === 0

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div role="dialog" aria-modal="true" aria-label={action.label} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-200 shadow-2xl">
        <h3 className="text-lg font-bold text-white">{action.label}</h3>
        <p className="mt-1 text-xs text-slate-400">{action.confirmText}. The customer sees the status and the message below.</p>

        {isRequest && (
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs">
            <p className="font-semibold text-slate-200">What the customer has to fix</p>
            {flagged.length === 0 && missing.length === 0 ? (
              <p className="mt-1 text-amber-300">Nothing is flagged yet. Close this, use <strong>Flag</strong> next to a document and give a reason, then try again.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-slate-300">
                {flagged.map((d) => <li key={d.slot}>&bull; {DOCUMENT_LABELS[d.slot] ?? d.slot}: <span className="text-slate-400">{d.reviewNote}</span></li>)}
                {missing.map((m) => <li key={m.label}>&bull; Missing: {m.label}</li>)}
              </ul>
            )}
          </div>
        )}

        {action.to === 'approved' && unverified > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {unverified} document{unverified === 1 ? ' has' : 's have'} not been marked verified. You can still approve.
          </p>
        )}

        <label className="mt-4 block text-xs font-semibold text-slate-300">
          Message to the customer{action.messageRequired ? <span className="text-rose-400"> *</span> : ' (optional)'}
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={4} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs font-normal text-white focus:border-blue-500 focus:outline-none" />
          <span className="text-[10px] font-normal text-slate-500">{message.length}/500</span>
        </label>
        <label className="mt-3 block text-xs font-semibold text-slate-300">
          Internal note (only the team sees this)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs font-normal text-white focus:border-blue-500 focus:outline-none" />
        </label>

        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-950/50 p-2.5 text-xs text-rose-300">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy || messageMissing || nothingToFix} onClick={() => onConfirm(message, note)} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${buttonKind[action.kind]}`}>
            {busy && <Loader2 size={14} className="animate-spin" />} {action.label}
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  app: AdminQuoteApplication
  user?: UserProfile
  onClose: () => void
  /** Called after any change so the list behind the panel refreshes. */
  onChanged: () => void
}

/** Review console for one application: journey, details, documents, decisions, notes and timeline. */
export const QuoteApplicationDrawer: React.FC<Props> = ({ app: initial, user, onClose, onChanged }) => {
  const { user: adminUser } = useAuth()
  const admin = useMemo(() => ({ uid: adminUser?.uid ?? '', email: adminUser?.email ?? '' }), [adminUser])
  const [app, setApp] = useState<QuoteApplication>(initial)
  const [docs, setDocs] = useState<QuoteDocument[] | null>(null)
  const [history, setHistory] = useState<QuoteHistoryEntry[]>([])
  const [notes, setNotes] = useState<QuoteAdminNote[]>([])
  const [live, setLive] = useState<CustomerDetails | null>(null)
  const [snapshot, setSnapshot] = useState<(Partial<CustomerDetails> & { takenAt?: string }) | null>(null)
  const [failed, setFailed] = useState(false)

  const [dialog, setDialog] = useState<AdminActionDef | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [flagging, setFlagging] = useState<{ slot: string; note: string } | null>(null)
  const [docBusy, setDocBusy] = useState('')
  const [panelError, setPanelError] = useState('')
  const [noteText, setNoteText] = useState('')

  const uid = initial.uid
  const appId = initial.id

  useEffect(() => {
    let active = true
    const fail = () => active && setFailed(true)
    const unsubs = [
      subscribeQuoteApplication(uid, appId, (a) => a && active && setApp(a), fail),
      subscribeQuoteDocuments(uid, appId, (d) => active && setDocs(d), fail),
      subscribeQuoteHistory(uid, appId, (h) => active && setHistory(h), fail),
    ]
    fetchCustomerDetails(uid).then((p) => active && setLive(p)).catch(fail)
    fetchQuoteSnapshot(uid, appId).then((sn) => active && setSnapshot(sn)).catch(() => undefined)
    fetchQuoteAdminNotes(uid, appId).then((n) => active && setNotes(n)).catch(() => undefined)
    return () => {
      active = false
      unsubs.forEach((u) => u())
    }
  }, [uid, appId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !dialog && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, dialog])

  const status = app.status
  const info = STATUS_INFO[status] ?? STATUS_INFO.in_progress
  const lender = findLender(app.lenderId)
  const reached = stepIndex(app.step)
  const submitted = status !== 'in_progress'
  const canReviewDocs = status === 'submitted' || status === 'under_review' || status === 'documents_required'
  const actions = ADMIN_ACTIONS[status] ?? []
  const docList = docs ?? []

  // Details as submitted, with a note on anything the customer changed afterwards.
  const shown: Partial<CustomerDetails> | null = snapshot ?? live
  const changed = useMemo(() => {
    if (!snapshot || !live) return new Set<string>()
    return new Set(FIELD_LABELS.filter(([k]) => String(snapshot[k] ?? '') !== String(live[k] ?? '')).map(([k]) => k as string))
  }, [snapshot, live])

  const open = async (slot: string) => {
    setDocBusy(slot)
    setPanelError('')
    try {
      window.open(await getQuoteDocumentUrl(app.id, slot, uid), '_blank', 'noopener,noreferrer')
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Could not open the document.')
    } finally {
      setDocBusy('')
    }
  }

  const review = async (slot: string, reviewStatus: 'verified' | 'rejected', note?: string) => {
    setDocBusy(slot)
    setPanelError('')
    try {
      await adminReviewQuoteDocument({ uid, appId, slot, reviewStatus, note, admin })
      setFlagging(null)
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Could not save the review.')
    } finally {
      setDocBusy('')
    }
  }

  const confirmAction = async (message: string, internalNote: string) => {
    if (!dialog) return
    setBusy(true)
    setDialogError('')
    try {
      await adminSetQuoteStatus({ uid, appId, to: dialog.to, message, internalNote, admin })
      setDialog(null)
      onChanged()
      fetchQuoteAdminNotes(uid, appId).then(setNotes).catch(() => undefined)
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : 'Could not update the application.')
    } finally {
      setBusy(false)
    }
  }

  const addNote = async () => {
    setPanelError('')
    try {
      await adminAddQuoteNote(uid, appId, noteText, admin)
      setNoteText('')
      setNotes(await fetchQuoteAdminNotes(uid, appId))
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Could not save the note.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label="Application details" className="flex h-full w-full max-w-[600px] flex-col overflow-y-auto border-l border-slate-800 bg-slate-950 text-slate-200 shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-white">{live?.fullName || user?.displayName || 'Unnamed customer'}</p>
              <p className="text-xs text-slate-400">{user?.mobileNumber || uid}{user?.email ? ` · ${user.email}` : ''}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLASSES[info.tone].admin}`}>{info.label}</span>
                {app.referenceNumber && <span className="text-[11px] text-slate-400">{app.referenceNumber}</span>}
                {(app.resubmissions ?? 0) > 0 && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300">Resubmitted {app.resubmissions}x</span>}
              </div>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {actions.length === 0 ? (
              <p className="text-xs text-slate-500">{submitted ? 'No further actions for this status.' : 'The customer has not submitted yet, so there is nothing to review.'}</p>
            ) : (
              actions.map((a) => (
                <button key={a.to} type="button" onClick={() => { setDialogError(''); setDialog(a) }} className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${buttonKind[a.kind]}`}>{a.label}</button>
              ))
            )}
            {status === 'documents_required' && <span className="text-[11px] text-orange-300">Waiting for the customer to update documents.</span>}
          </div>
        </header>

        {panelError && <p role="alert" className="mx-6 mt-4 rounded-lg bg-rose-950/50 p-2.5 text-xs text-rose-300">{panelError}</p>}

        {app.reviewMessage && submitted && (
          <section className="mx-6 mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Latest message shown to the customer</p>
            <p className="mt-1 text-slate-200">{app.reviewMessage}</p>
          </section>
        )}

        <Section title="Loan">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white p-1.5">
              {lender && <img alt="" className="h-full w-full object-contain" src={`/assets/images/lenders/${lender.logo}.png`} />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{lender?.name ?? app.lenderId} &middot; {QUOTE_TYPE_NAMES[app.loanType] ?? app.loanType}</p>
              <p className="text-xs text-slate-400">{formatAmountLabel(app.amount)} over {app.tenureMonths} months &middot; sample rate {app.roi}% p.a.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Detail label="Purpose" value={app.purpose} />
            <Detail label="Started" value={when(app.createdAt)} />
            <Detail label="Last activity" value={when(app.updatedAt)} />
            {submitted && <Detail label="Submitted" value={when(app.submittedAt)} />}
            {app.reviewedAt && <Detail label="Last reviewed" value={when(app.reviewedAt)} />}
          </div>
        </Section>

        <Section title="Progress">
          <ol>
            {QUOTE_STEP_ORDER.map((s, i) => {
              const done = reached > i + 1 || (submitted && i + 1 === reached)
              const current = !submitted && reached === i + 1
              return (
                <li key={s.step} className="relative flex items-center gap-3 pb-3 last:pb-0">
                  {i < QUOTE_STEP_ORDER.length - 1 && <span aria-hidden className={`absolute left-[11px] top-6 h-[calc(100%-12px)] w-px ${done ? 'bg-emerald-500/60' : 'bg-slate-700'}`} />}
                  <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${done ? 'bg-emerald-500 text-white' : current ? 'bg-blue-500 text-white ring-4 ring-blue-500/20' : 'bg-slate-800 text-slate-500'}`}>
                    {done ? <Check size={13} strokeWidth={3.5} /> : i + 1}
                  </span>
                  <span className={`text-xs ${done ? 'text-slate-200' : current ? 'font-semibold text-blue-300' : 'text-slate-500'}`}>{s.label}</span>
                </li>
              )
            })}
          </ol>
        </Section>

        {failed ? (
          <p className="px-6 py-5 text-xs text-rose-400">Could not load everything for this application.</p>
        ) : !shown || docs === null ? (
          <p className="flex items-center gap-2 px-6 py-5 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading details...</p>
        ) : (
          <>
            <Section title={snapshot ? `Details as submitted (${when(snapshot.takenAt)})` : 'Customer details (not submitted yet)'}>
              <div className="grid grid-cols-2 gap-3">
                {FIELD_LABELS.map(([key, label]) => (
                  <Detail key={key} label={label} value={shown[key] as string | number | undefined} changed={changed.has(key)} wide={key === 'email'} />
                ))}
              </div>
              {changed.size > 0 && <p className="mt-3 text-[11px] text-amber-300">The customer edited {changed.size} detail{changed.size === 1 ? '' : 's'} on their profile after submitting. This panel shows what they submitted.</p>}
            </Section>

            <Section title={`Documents (${docList.length})`}>
              {docList.length === 0 ? (
                <p className="text-xs text-slate-500">No documents uploaded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {docList.map((d) => {
                    const flaggingThis = flagging?.slot === d.slot
                    return (
                      <li key={d.slot} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-100">
                              <FileText size={13} className="shrink-0 text-blue-400" />{DOCUMENT_LABELS[d.slot] ?? d.slot}
                              {d.reviewStatus === 'verified' && <span className="rounded bg-emerald-500/15 px-1.5 text-[10px] font-bold text-emerald-300">VERIFIED</span>}
                              {d.reviewStatus === 'rejected' && <span className="rounded bg-rose-500/15 px-1.5 text-[10px] font-bold text-rose-300">NEEDS CHANGES</span>}
                              {!d.reviewStatus && canReviewDocs && <span className="rounded bg-slate-700 px-1.5 text-[10px] font-bold text-slate-300">NOT REVIEWED</span>}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">{d.fileName}{d.period ? ` · ${d.period}` : ''} &middot; {(d.fileSize / 1024).toFixed(0)} KB</p>
                            {d.reviewStatus === 'rejected' && d.reviewNote && <p className="mt-1 text-[11px] text-rose-300">Reason: {d.reviewNote}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button type="button" disabled={docBusy === d.slot} onClick={() => void open(d.slot)} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-500 disabled:opacity-60">{docBusy === d.slot ? '...' : 'View'}</button>
                            {canReviewDocs && d.reviewStatus !== 'verified' && <button type="button" disabled={docBusy === d.slot} onClick={() => void review(d.slot, 'verified')} className="rounded-lg bg-emerald-600/90 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-60">Verify</button>}
                            {canReviewDocs && d.reviewStatus !== 'rejected' && <button type="button" disabled={docBusy === d.slot} onClick={() => setFlagging({ slot: d.slot, note: '' })} className="rounded-lg bg-rose-600/90 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-rose-500 disabled:opacity-60">Flag</button>}
                          </div>
                        </div>
                        {flaggingThis && (
                          <div className="mt-2 flex gap-2">
                            <input autoFocus value={flagging.note} maxLength={300} onChange={(e) => setFlagging({ slot: d.slot, note: e.target.value })} placeholder="What is wrong? The customer sees this." className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-rose-500 focus:outline-none" />
                            <button type="button" disabled={!flagging.note.trim() || docBusy === d.slot} onClick={() => void review(d.slot, 'rejected', flagging.note)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-500 disabled:opacity-50">Save</button>
                            <button type="button" onClick={() => setFlagging(null)} className="rounded-lg border border-slate-600 px-3 py-1.5 text-[11px] text-slate-300">Cancel</button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
              {canReviewDocs && docList.length > 0 && <p className="mt-3 text-[11px] text-slate-500">Flag documents with a reason, then use <strong>Request documents</strong> to send them back to the customer.</p>}
            </Section>

            <Section title="Timeline">
              {history.length === 0 ? (
                <p className="text-xs text-slate-500">No review activity yet.</p>
              ) : (
                <ol className="space-y-3">
                  {[...history].reverse().map((h) => (
                    <li key={h.id} className="text-xs">
                      <p className="font-semibold text-slate-200">
                        {h.actor === 'admin' ? 'Team' : 'Customer'}: {STATUS_INFO[h.from as QuoteStatus]?.label ?? h.from} &rarr; {STATUS_INFO[h.to as QuoteStatus]?.label ?? h.to}
                      </p>
                      <p className="text-[11px] text-slate-500">{when(h.at)}</p>
                      {h.message && <p className="mt-1 rounded-lg bg-slate-900 p-2 text-slate-300">{h.message}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <Section title="Internal notes (not visible to the customer)">
              {notes.length === 0 ? <p className="text-xs text-slate-500">No notes yet.</p> : (
                <ul className="mb-3 space-y-2">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-xs">
                      <p className="text-slate-200">{n.text}</p>
                      <p className="mt-1 text-[10px] text-slate-500">{n.byEmail} &middot; {when(n.at)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} maxLength={1000} placeholder="Add a note for the team..." className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:border-blue-500 focus:outline-none" />
                <button type="button" disabled={!noteText.trim()} onClick={() => void addNote()} className="self-end rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-600 disabled:opacity-50">Add</button>
              </div>
            </Section>

            {submitted && app.consentVersion && (
              <Section title="Consent">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                  Consent to share details and documents with {lender?.name ?? 'the lender'} was given on {when(app.submittedAt)} (text version {app.consentVersion}).
                </div>
              </Section>
            )}
          </>
        )}
      </aside>

      {dialog && <ActionDialog action={dialog} docs={docList} busy={busy} error={dialogError} onCancel={() => setDialog(null)} onConfirm={(m, n) => void confirmAction(m, n)} />}
    </div>
  )
}
