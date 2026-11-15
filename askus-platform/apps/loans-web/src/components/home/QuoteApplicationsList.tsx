import React from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useQuoteApplications } from '../../hooks/useQuoteApplications'
import { findLender } from '../../constants/quotesData'
import { QUOTE_TYPE_NAMES } from '../../constants/quotesTypes'
import { STATUS_INFO, TONE_CLASSES, type QuoteStatus } from '../../constants/quoteStatus'
import { formatAmountLabel } from '../../utils/quotes'
import type { QuoteApplication, QuoteStep } from '../../services/api/loansApi'

const STEP_LABELS: Record<QuoteStep, string> = {
  know_you: 'Step 1 of 5: Personal details',
  details_confirmed: 'Step 2 of 5: Address and bank',
  personal_details: 'Step 3 of 5: Documents',
  documents: 'Step 3 of 5: Documents',
  documents_uploaded: 'Step 4 of 5: Review',
  submitted: 'Submitted',
}

const path = (a: QuoteApplication) => {
  const page =
    a.status === 'documents_required' ? 'documents'
    : a.status !== 'in_progress' ? 'review'
    : a.step === 'know_you' ? 'know-you'
    : a.step === 'details_confirmed' ? 'personal-details'
    : a.step === 'documents_uploaded' ? 'review'
    : 'documents'
  const q = new URLSearchParams({ type: a.loanType, lender: a.lenderId, amount: String(a.amount), tenure: String(a.tenureMonths) })
  if (a.purpose) q.set('purpose', a.purpose)
  return `/loans/quotes/${page}?${q.toString()}`
}

const dateLabel = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const statusIcon = (s: QuoteStatus) =>
  s === 'approved' || s === 'disbursed' ? <CheckCircle2 size={12} /> : s === 'rejected' ? <XCircle size={12} /> : s === 'documents_required' ? <AlertTriangle size={12} /> : <Clock size={12} />

const noticeTone: Partial<Record<QuoteStatus, string>> = {
  documents_required: 'border-orange-200 bg-orange-50 text-orange-900',
  rejected: 'border-rose-200 bg-rose-50 text-rose-900',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  disbursed: 'border-teal-200 bg-teal-50 text-teal-900',
  closed: 'border-slate-200 bg-slate-50 text-slate-700',
}

/** The customer's loan applications started from the quotes flow, refreshed from the AskUs API. */
export const QuoteApplicationsList: React.FC = () => {
  const { user } = useAuth()
  const { apps, loaded, error } = useQuoteApplications(user?.uid)
  const needsAction = apps.filter((a) => a.status === 'documents_required').length

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#1c1d1f]">Loan applications</h2>
        <Link to="/loans/quotes" className="text-xs font-semibold text-[#0066ff] hover:underline">Compare offers</Link>
      </div>
      {needsAction > 0 && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-900">
          <AlertTriangle size={14} /> {needsAction === 1 ? 'One application needs' : `${needsAction} applications need`} your attention.
        </p>
      )}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-rose-600">We could not load your applications. Please refresh.</p>
      ) : !loaded ? (
        <p className="mt-4 text-sm text-slate-500">Loading...</p>
      ) : apps.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Applications you start from the loan offers page appear here, including ones you left halfway.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {apps.map((a) => {
            const lender = findLender(a.lenderId)
            const info = STATUS_INFO[a.status] ?? STATUS_INFO.in_progress
            const showNotice = a.status !== 'in_progress' && a.status !== 'submitted' && a.status !== 'under_review' && a.reviewMessage
            const action = a.status === 'in_progress' ? 'Resume' : a.status === 'documents_required' ? 'Update documents' : 'View'
            return (
              <li key={a.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200">
                    {lender && <img alt="" className="h-7 w-7 object-contain" src={`/assets/images/lenders/${lender.logo}.png`} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#052F5F]">{lender?.name ?? a.lenderId} &middot; {QUOTE_TYPE_NAMES[a.loanType] ?? a.loanType}</p>
                    <p className="text-xs text-slate-500">{formatAmountLabel(a.amount)} over {a.tenureMonths} months{a.referenceNumber ? ` · Ref ${a.referenceNumber}` : ''}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLASSES[info.tone].customer}`}>
                    {statusIcon(a.status)}
                    {a.status === 'in_progress' ? STEP_LABELS[a.step] : `${info.customerLabel}${a.status === 'submitted' ? ` ${dateLabel(a.submittedAt)}` : ''}`}
                  </span>
                  <Link
                    to={path(a)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${a.status === 'documents_required' ? 'bg-orange-500 text-white hover:bg-orange-600' : 'border border-[#0066ff] text-[#0066ff] hover:bg-[#f2f7ff]'}`}
                  >
                    {action}
                  </Link>
                </div>
                {showNotice && (
                  <p className={`mt-2 rounded-lg border px-3 py-2 text-xs leading-[18px] ${noticeTone[a.status] ?? 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                    <strong className="font-semibold">{info.customerLabel}:</strong> {a.reviewMessage}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
