import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Check, CheckCircle2, Loader2, ScanEye, XCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import {
  fetchCustomerDetails, quoteApplicationId, subscribeQuoteDocuments, submitQuoteApplication,
  type CustomerDetails, type QuoteDocument,
} from '../../services/api/loansApi'
import { findLender } from '../../constants/quotesData'
import { getQuoteDocumentUrl } from '../../services/api/storageService'
import { CONSENT_VERSION, QUOTE_TYPES, QUOTE_TYPE_NAMES } from '../../constants/quotesTypes'
import { adaptLender } from '../../utils/quotes'
import { STATUS_INFO, TONE_CLASSES, type QuoteStatus } from '../../constants/quoteStatus'
import { useQuoteApplications, useQuoteHistory } from '../../hooks/useQuoteApplications'
import { StatusTimeline } from '../../components/quotes/StatusTimeline'
import { AuthModal } from '../../components/auth/AuthModal'
import { FlowShell } from '../../components/quotes/FlowShell'
import { ConsentModal } from '../../components/quotes/ConsentModal'

const shortDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso)

const Field: React.FC<{ label: string; right?: boolean; children: React.ReactNode }> = ({ label, right, children }) => (
  <div className={`min-w-0 ${right ? 'text-right' : ''}`}>
    <p className="break-words text-[12px] leading-[18px] text-[#6A6D71]">{label}</p>
    <div className="break-words text-[14px] font-medium leading-5 text-[#1C1D1F]">{children || '-'}</div>
  </div>
)

const Card: React.FC<{ title: string; onEdit?: () => void; children: React.ReactNode }> = ({ title, onEdit, children }) => (
  <section className="shrink-0 overflow-hidden rounded-[4px] border border-[rgba(5,47,95,0.15)] bg-white">
    <div className="flex items-center justify-between gap-4 bg-[#F6F6F6] px-4 py-[10px]">
      <h2 className="m-0 min-w-0 flex-1 text-[14px] font-medium leading-5 text-[#1C1D1F]">{title}</h2>
      {onEdit && <button type="button" onClick={onEdit} className="shrink-0 text-[14px] font-medium leading-5 text-[#0066FF] hover:underline">Edit</button>}
    </div>
    <div className="grid grid-cols-2 gap-3 px-4 py-3">{children}</div>
  </section>
)

interface UploadedFile {
  name: string
  fileName: string
  onView: () => void
}

const Uploaded: React.FC<{ label: string; files: UploadedFile[] }> = ({ label, files }) =>
  files.length > 0 ? (
    <div className="space-y-1">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full bg-[#14803F] text-white"><Check size={10} strokeWidth={3.5} /></span>
        {label}
      </span>
      <ul className="space-y-0.5 pl-5">
        {files.map((f) => (
          <li key={f.name} className="flex items-center gap-2 text-[12px] font-normal text-[#6A6D71]">
            <span className="min-w-0 truncate">{f.name}: {f.fileName}</span>
            <button type="button" onClick={f.onView} className="shrink-0 font-medium text-[#0066FF] hover:underline">View</button>
          </li>
        ))}
      </ul>
    </div>
  ) : (
    <span className="text-[#6A6D71]">&mdash;</span>
  )

/**
 * Review step shown after the documents are submitted: the customer checks
 * their personal details and which documents were uploaded, and can jump back
 * to either step to change them.
 */
export const ApplicationReviewPage: React.FC = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { showToast } = useToast()
  const { user, isAuthenticated, isLoading, openAuthModal } = useAuth()

  const loanType = params.get('type') ?? ''
  const lender = findLender(params.get('lender') ?? '')
  const amount = Number(params.get('amount'))
  const tenure = Number(params.get('tenure'))
  const purpose = params.get('purpose') ?? ''
  const appId = lender ? quoteApplicationId(loanType, lender.id) : ''

  const uid = user?.uid
  const [profile, setProfile] = useState<CustomerDetails | null>(null)
  const [docs, setDocs] = useState<Record<string, QuoteDocument>>({})
  const [error, setError] = useState(false)
  const [consentOpen, setConsentOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [blocked, setBlocked] = useState('')
  const [reference, setReference] = useState('')

  useEffect(() => {
    if (!uid || !lender) return
    let active = true
    fetchCustomerDetails(uid)
      .then((d) => active && setProfile(d))
      .catch(() => active && setError(true))
    const unsubscribe = subscribeQuoteDocuments(
      uid,
      appId,
      (list) => {
        const map: Record<string, QuoteDocument> = {}
        for (const d of list) map[d.slot] = d
        if (active) setDocs(map)
      },
      () => active && setError(true),
    )
    return () => {
      active = false
      unsubscribe()
    }
  }, [uid, lender, appId])

  const go = (page: 'personal-details' | 'documents') => {
    const q = new URLSearchParams({ type: loanType, lender: params.get('lender') ?? '', amount: String(amount), tenure: String(tenure), purpose })
    navigate(`/loans/quotes/${page}?${q.toString()}`)
  }

  const viewDoc = async (slot: string) => {
    try {
      window.open(await getQuoteDocumentUrl(appId, slot), '_blank', 'noopener,noreferrer')
    } catch (err) {
      setBlocked(err instanceof Error ? err.message : 'Could not open the document.')
    }
  }
  const filesFor = (slots: [string, string][]): UploadedFile[] =>
    slots.flatMap(([slot, name]) => (docs[slot] ? [{ name, fileName: docs[slot].fileName, onView: () => void viewDoc(slot) }] : []))

  const hasAddress = Boolean(docs.aadhaar_both || (docs.aadhaar_front && docs.aadhaar_back))
  const allDocs = Boolean(docs.salary_slip_1 && docs.salary_slip_2 && docs.salary_slip_3 && docs.bank_statement && docs.pan_card && hasAddress)
  const { apps } = useQuoteApplications(uid)
  const app = apps.find((a) => a.id === appId) ?? null
  const history = useQuoteHistory(uid, appId)
  const status: QuoteStatus = app?.status ?? (reference ? 'submitted' : 'in_progress')
  const submitted = status !== 'in_progress'
  const info = STATUS_INFO[status]
  const needsDocuments = status === 'documents_required'
  const referenceNumber = reference || app?.referenceNumber || ''
  const ready = isAuthenticated && Boolean(profile) && Boolean(lender)

  const quotedRoi = lender && QUOTE_TYPES[loanType] ? adaptLender(lender, QUOTE_TYPES[loanType]).roi : null

  const onProceed = () => {
    setBlocked('')
    if (!allDocs) {
      setBlocked('Please upload all documents before you continue. Use Edit on Documents Uploaded to add the missing ones.')
      return
    }
    setSubmitError('')
    setConsentOpen(true)
  }

  const onAgree = async () => {
    if (!uid || !lender || quotedRoi === null) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const ref = await submitQuoteApplication(uid, { loanType, lenderId: lender.id, amount, tenureMonths: tenure, roi: quotedRoi, purpose: purpose || undefined }, CONSENT_VERSION)
      setReference(ref)
      setConsentOpen(false)
      showToast({ type: 'success', title: 'Application submitted', message: `Your reference number is ${ref}. You can track it here.` })
      // Take the customer to their applications, where the new one now appears with its status.
      navigate('/customer/applications', { replace: true })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit your application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const footer = ready && !submitted ? (
    <>
      <button
        type="button"
        onClick={onProceed}
        className="flex h-[52px] w-full items-center justify-center rounded-lg bg-[#0066ff] text-[18px] font-medium text-white transition hover:bg-[#0052cc]"
      >
        Proceed
      </button>
      <p className="mt-3 flex items-center justify-center gap-2 text-center text-[13px] text-[#45484D]">
        <img alt="" width={18} height={18} src="/assets/icons/shield-tick.svg" /> Your details are visible only to you and authorised staff
      </p>
    </>
  ) : undefined

  return (
    <>
      <FlowShell
        title="Application Form"
        lender={lender}
        summary={amount >= 1000 && tenure >= 1 ? { typeName: QUOTE_TYPE_NAMES[loanType] ?? 'Loan', amount, tenure } : undefined}
        panel={{ title: 'Give It a Quick Check', text: 'Review your details carefully before you complete your application.', icon: <ScanEye size={34} /> }}
        onBack={() => (submitted && !needsDocuments ? navigate('/customer/applications') : go('documents'))}
        footer={footer}
      >
        {isLoading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-[#6A6D71]"><Loader2 className="animate-spin" size={18} /> Loading...</div>
        ) : !isAuthenticated ? (
          <div className="max-w-[560px] rounded-xl border border-[#E4E4E3] p-5 text-center">
            <p className="text-[15px] font-semibold text-[#052F5F]">Sign in to continue</p>
            <p className="mt-1 text-[13px] text-[#6A6D71]">Your application is saved to your account.</p>
            <button type="button" onClick={() => openAuthModal('phone')} className="mt-4 rounded-lg bg-[#0066ff] px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0052cc]">Login with OTP</button>
          </div>
        ) : !lender ? (
          <div className="max-w-[560px] rounded-xl border border-[#E4E4E3] p-5">
            <p className="text-[15px] font-semibold text-[#052F5F]">We could not find this application</p>
            <button type="button" onClick={() => navigate('/loans/quotes')} className="mt-3 rounded-lg bg-[#0066ff] px-5 py-2 text-[13px] font-semibold text-white">View offers</button>
          </div>
        ) : error ? (
          <p role="alert" className="rounded-lg bg-rose-50 p-4 text-[14px] text-rose-700">We could not load your application. Please refresh and try again.</p>
        ) : !profile ? (
          <div className="flex items-center gap-2 py-10 text-sm text-[#6A6D71]"><Loader2 className="animate-spin" size={18} /> Loading your application...</div>
        ) : (
          <div className="flex max-w-[640px] flex-col gap-5">
            {submitted && (
              <section className={`rounded-xl border p-5 ${needsDocuments ? 'border-orange-200 bg-orange-50' : status === 'rejected' ? 'border-rose-200 bg-rose-50' : status === 'approved' || status === 'disbursed' ? 'border-[#9BE0B3] bg-[#F3FBF6]' : 'border-[#CFE0FF] bg-[#F2F7FF]'}`}>
                <div className="flex items-start gap-3">
                  {needsDocuments ? <AlertTriangle className="mt-0.5 shrink-0 text-orange-600" size={28} /> : status === 'rejected' ? <XCircle className="mt-0.5 shrink-0 text-rose-600" size={28} /> : <CheckCircle2 className="mt-0.5 shrink-0 text-[#14803F]" size={28} />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[18px] font-semibold text-[#052F5F]">{status === 'submitted' ? 'Application submitted' : info.customerLabel}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[info.tone].customer}`}>{info.label}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-[#45484D]">
                      Your {QUOTE_TYPE_NAMES[loanType] ?? 'loan'} application with {lender.name} (reference <strong className="font-semibold text-[#052F5F]">{referenceNumber}</strong>). {info.customerHelp}
                    </p>
                    {app?.reviewMessage && status !== 'submitted' && status !== 'under_review' && (
                      <p className="mt-2 rounded-lg bg-white/80 p-3 text-[13px] leading-5 text-[#1C1D1F]"><strong className="font-semibold">Message from our team:</strong> {app.reviewMessage}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {needsDocuments && <button type="button" onClick={() => go('documents')} className="rounded-lg bg-orange-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-orange-600">Update documents</button>}
                      <button type="button" onClick={() => navigate('/customer/applications')} className="rounded-lg bg-[#0066ff] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#0052cc]">View my applications</button>
                      <button type="button" onClick={() => navigate('/')} className="rounded-lg border border-[#0066ff] px-4 py-2 text-[13px] font-semibold text-[#0066ff] hover:bg-[#F2F7FF]">Back to home</button>
                    </div>
                  </div>
                </div>
              </section>
            )}
            {blocked && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-[13px] text-amber-900">{blocked}</p>}
            <Card title="Personal Details" onEdit={submitted ? undefined : () => go('personal-details')}>
              <Field label="PAN">{profile.panNumber}</Field>
              <Field label="Full Name" right>{profile.fullName}</Field>
              <Field label="Date of Birth">{shortDate(profile.dateOfBirth)}</Field>
              <Field label="Salary Bank" right>{profile.salaryBank}</Field>
              <Field label="Personal Email ID">{profile.email}</Field>
              <Field label="Residence Address Line 1" right>{profile.address}</Field>
              <Field label="Residence Address Line 2">{profile.addressLine2}</Field>
              <Field label="Residence Pincode" right>{profile.pinCode}</Field>
              <Field label="City">{profile.city}</Field>
              <Field label="State" right>{profile.state}</Field>
            </Card>

            <Card title="Documents Uploaded" onEdit={!submitted || needsDocuments ? () => go('documents') : undefined}>
              <div className="col-span-2"><Field label="Identity Proof"><Uploaded label="PAN CARD" files={filesFor([['pan_card', 'PAN card']])} /></Field></div>
              <div className="col-span-2"><Field label="Address Proof"><Uploaded label="AADHAAR CARD" files={filesFor([['aadhaar_front', 'Front'], ['aadhaar_back', 'Back'], ['aadhaar_both', 'Both sides']])} /></Field></div>
              <div className="col-span-2"><Field label="Income Proof"><Uploaded label="SALARY SLIPS" files={filesFor([['salary_slip_1', 'Slip 1'], ['salary_slip_2', 'Slip 2'], ['salary_slip_3', 'Slip 3']])} /></Field></div>
              <div className="col-span-2"><Field label="Bank Statement"><Uploaded label="BANK STATEMENTS" files={filesFor([['bank_statement', 'Statement']])} /></Field></div>
            </Card>

            {submitted && <StatusTimeline entries={history} />}
          </div>
        )}
      </FlowShell>
      {consentOpen && lender && <ConsentModal lender={lender} loading={submitting} error={submitError} onAgree={() => void onAgree()} onClose={() => setConsentOpen(false)} />}
      <AuthModal />
    </>
  )
}
