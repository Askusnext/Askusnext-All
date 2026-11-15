import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import {
  deleteQuoteDocument, ensureDocumentDraftId, findReusableQuoteDocuments, getQuoteApplication, quoteApplicationId, saveQuoteApplication,
  resubmitQuoteApplication, saveQuoteDocument, subscribeQuoteDocuments, type QuoteDocument,
} from '../../services/api/loansApi'
import { deleteDraftDocument, getQuoteDocumentUrl, uploadApplicationDocument } from '../../services/api/storageService'
import { findLender } from '../../constants/quotesData'
import { QUOTE_TYPES } from '../../constants/quotesTypes'
import { missingRequired } from '../../constants/quoteDocuments'
import { adaptLender } from '../../utils/quotes'
import { validateUploadFile } from '../../utils/validation'
import { AuthModal } from '../../components/auth/AuthModal'
import { QuotesHeaderLogo } from '../../components/quotes/QuotesSections'
import './documentUpload.css'

interface SlotDef {
  id: string
  label: string
  /** Salary slips also record the year and month they cover. */
  period?: boolean
}

interface StepDef {
  id: string
  title: string
  subtitle?: string
  /** Extensions accepted for every slot in the step. */
  formats: string[]
  slots: SlotDef[]
  /** Aadhaar front + back, or one file with both sides. */
  address?: boolean
}

const ALL_FORMATS = ['pdf', 'png', 'jpeg', 'jpg']

const STEPS: StepDef[] = [
  {
    id: 'salary',
    title: 'Salary slip (last 3 months)',
    formats: ALL_FORMATS,
    slots: [
      { id: 'salary_slip_1', label: '1st Salary Slip', period: true },
      { id: 'salary_slip_2', label: '2nd Salary Slip', period: true },
      { id: 'salary_slip_3', label: '3rd Salary Slip', period: true },
    ],
  },
  {
    id: 'bank',
    title: 'Bank Statement',
    subtitle: 'Last 3/6 Months Bank Statement',
    formats: ['pdf'],
    slots: [{ id: 'bank_statement', label: 'Bank Statement' }],
  },
  {
    id: 'address',
    title: 'Address Proof',
    formats: ['png', 'jpeg', 'jpg', 'pdf'],
    address: true,
    slots: [
      { id: 'aadhaar_front', label: 'Aadhaar Card Front' },
      { id: 'aadhaar_back', label: 'Aadhaar Card Back' },
      { id: 'aadhaar_both', label: 'Have both sides in one File?' },
    ],
  },
  {
    id: 'pan',
    title: 'PAN CARD',
    formats: ['png', 'jpeg', 'jpg', 'pdf'],
    slots: [{ id: 'pan_card', label: 'PAN Card' }],
  },
]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface Period {
  year: number
  month: number // 0-11
}

const defaultPeriod = (monthsAgo: number): Period => {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

const periodKey = (p: Period) => `${p.year}-${String(p.month + 1).padStart(2, '0')}`
const parsePeriod = (s?: string): Period | null => {
  const m = s?.match(/^(\d{4})-(\d{2})$/)
  return m ? { year: Number(m[1]), month: Number(m[2]) - 1 } : null
}

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

/**
 * Document upload step. Each file is uploaded to the AskUs API (POST /loans/files) and stored privately;
 * its details are saved in PostgreSQL against the application.
 */
export const DocumentUploadPage: React.FC = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, isAuthenticated, isLoading, openAuthModal } = useAuth()
  const { showToast } = useToast()

  const loanType = params.get('type') ?? ''
  const lender = useMemo(() => findLender(params.get('lender') ?? ''), [params])
  const amount = Number(params.get('amount'))
  const tenure = Number(params.get('tenure'))
  const purpose = params.get('purpose') ?? ''
  const quotedRoi = useMemo(() => {
    const t = QUOTE_TYPES[loanType]
    return lender && t ? adaptLender(lender, t).roi : null
  }, [lender, loanType])
  const validParams = Boolean(lender && quotedRoi !== null && amount >= 1000 && Number.isInteger(tenure) && tenure >= 1)
  const appId = lender ? quoteApplicationId(loanType, lender.id) : ''

  const uid = user?.uid
  const [draftId, setDraftId] = useState<string | null>(null)
  const [setupError, setSetupError] = useState('')
  const [docs, setDocs] = useState<Record<string, QuoteDocument>>({})
  const [docsLoaded, setDocsLoaded] = useState(false)
  const [reusedFrom, setReusedFrom] = useState<{ lenderName: string; loanType: string } | null>(null)
  const reuseTried = useRef(false)
  const [step, setStep] = useState(0)
  // Set when the reviewer asked for changes: only flagged or missing documents can be edited.
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewMessage, setReviewMessage] = useState('')
  const jumped = useRef(false)
  const reviewRef = useRef(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [stepError, setStepError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [periods, setPeriods] = useState<Record<string, Period>>({
    salary_slip_1: defaultPeriod(1),
    salary_slip_2: defaultPeriod(2),
    salary_slip_3: defaultPeriod(3),
  })

  const fileInput = useRef<HTMLInputElement>(null)
  const pendingSlot = useRef<{ slot: SlotDef; formats: string[] } | null>(null)

  // Make sure the in-progress application exists and has a draft id for the stored file names.
  useEffect(() => {
    if (!uid || !validParams || !lender || quotedRoi === null) return
    let active = true
    ;(async () => {
      try {
        const existing = await getQuoteApplication(uid, appId)
        if (existing && existing.status !== 'in_progress' && existing.status !== 'documents_required') {
          // Already with the review team: the documents are read-only, so show the review page instead.
          const q = new URLSearchParams({ type: loanType, lender: lender.id, amount: String(amount), tenure: String(tenure), purpose })
          navigate(`/loans/quotes/review?${q.toString()}`, { replace: true })
          return
        }
        if (existing?.status === 'documents_required') {
          if (active) {
            reviewRef.current = true
            setReviewMode(true)
            setReviewMessage(existing.reviewMessage ?? '')
          }
        } else if (!existing || (existing.step !== 'documents' && existing.step !== 'documents_uploaded')) {
          await saveQuoteApplication(uid, { loanType, lenderId: lender.id, amount, tenureMonths: tenure, roi: quotedRoi, step: 'documents', purpose: purpose || existing?.purpose })
        }
        const id = await ensureDocumentDraftId(uid, appId)
        if (active) setDraftId(id)
      } catch (err) {
        if (active) setSetupError(err instanceof Error ? err.message : 'Could not prepare your application.')
      }
    })()
    return () => {
      active = false
    }
    // Run once per user and application.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, appId, validParams])

  useEffect(() => {
    if (!uid || !draftId) return
    // The API is known to be reachable here: the setup step above already used it.
    const unsubscribe = subscribeQuoteDocuments(
      uid,
      appId,
      (list) => {
        const map: Record<string, QuoteDocument> = {}
        for (const d of list) map[d.slot] = d
        setDocs(map)
        setDocsLoaded(true)
        // When changes were requested, open on the first step that needs attention (once).
        if (reviewRef.current && !jumped.current) {
          jumped.current = true
          const flagged = list.find((d) => d.reviewStatus === 'rejected')?.slot
          const stepWithFlag = STEPS.findIndex((st) => st.slots.some((sl) => sl.id === flagged))
          const missing = missingRequired(map)
          const target = stepWithFlag >= 0 ? stepWithFlag : missing.length > 0 ? missing[0].step : -1
          if (target >= 0) setStep(target)
        }
        setPeriods((prev) => {
          const next = { ...prev }
          for (const d of list) {
            const p = parsePeriod(d.period)
            if (p) next[d.slot] = p
          }
          return next
        })
      },
      () => setSetupError('Could not load your uploaded documents.'),
    )
    return () => unsubscribe()
  }, [uid, appId, draftId])

  // A customer who already uploaded documents for another application does not start from scratch:
  // the same files are linked to this application and can be replaced or viewed individually.
  useEffect(() => {
    if (!uid || !draftId || !docsLoaded || reviewMode || reuseTried.current || Object.keys(docs).length > 0) return
    reuseTried.current = true
    let active = true
    findReusableQuoteDocuments(uid, appId)
      .then(async (found) => {
        if (!found || !active) return
        for (const d of found.docs) {
          const { uploadedAt, ...meta } = d
          void uploadedAt
          await saveQuoteDocument(uid, appId, meta)
        }
        if (active) setReusedFrom({ lenderName: findLender(found.lenderId)?.name ?? 'an earlier application', loanType: found.loanType })
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [uid, draftId, docsLoaded, docs, appId, reviewMode])

  const current = STEPS[step]
  const flaggedIn = (st: StepDef) => st.slots.some((sl) => docs[sl.id]?.reviewStatus === 'rejected')
  const hasUpload = (s: StepDef) => s.slots.some((slot) => docs[slot.id])

  const startUpload = (slot: SlotDef, formats: string[]) => {
    pendingSlot.current = { slot, formats }
    if (fileInput.current) {
      fileInput.current.value = ''
      fileInput.current.accept = formats.map((f) => `.${f}`).join(',')
      fileInput.current.click()
    }
  }

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const pending = pendingSlot.current
    if (!file || !pending || !uid || !draftId) return
    const { slot, formats } = pending
    const check = validateUploadFile(file)
    const ext = extOf(file.name)
    if (!check.valid) {
      showToast({ type: 'error', title: 'Cannot upload', message: check.error || 'Invalid file.' })
      return
    }
    if (!formats.includes(ext)) {
      showToast({ type: 'error', title: 'Unsupported format', message: `This document accepts ${formats.map((f) => `.${f}`).join(', ')} files.` })
      return
    }
    setBusy(slot.id)
    setStepError('')
    try {
      const old = docs[slot.id]
      const newFormat = ext === 'jpeg' ? 'jpg' : ext
      if (old && old.fileFormat !== newFormat && old.storageKey.includes(`_${draftId}_`)) {
        // A replacement with a different extension is stored under a different file name; remove the old file.
        await deleteDraftDocument(draftId, { type: slot.id, storageKey: old.storageKey }).catch(() => undefined)
      }
      const uploaded = await uploadApplicationDocument(draftId, { type: slot.id }, file)
      await saveQuoteDocument(uid, appId, {
        slot: slot.id,
        label: slot.label,
        fileName: uploaded.fileName.slice(0, 200),
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType.slice(0, 100),
        storageKey: uploaded.storageKey,
        fileId: uploaded.fileId,
        fileFormat: uploaded.fileFormat,
        fileVersion: uploaded.fileVersion,
        period: slot.period ? periodKey(periods[slot.id]) : undefined,
      })
      showToast({ type: 'success', title: 'Uploaded', message: `${slot.label} uploaded securely.` })
    } catch (err) {
      showToast({ type: 'error', title: 'Upload failed', message: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  const preview = async (slot: SlotDef) => {
    try {
      const url = await getQuoteDocumentUrl(appId, slot.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      showToast({ type: 'error', title: 'Cannot open document', message: err instanceof Error ? err.message : 'Please try again.' })
    }
  }

  const removeDoc = async (slot: SlotDef) => {
    if (!uid || !draftId) return
    const d = docs[slot.id]
    setBusy(slot.id)
    try {
      // Reused files belong to an earlier application, so only this application's link is removed.
      if (d && d.storageKey.includes(`_${draftId}_`)) await deleteDraftDocument(draftId, { type: slot.id, storageKey: d.storageKey })
      await deleteQuoteDocument(uid, appId, slot.id)
    } catch (err) {
      showToast({ type: 'error', title: 'Could not remove', message: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  const addressProblem = (s: StepDef) => {
    if (!s.address) return ''
    const f = Boolean(docs.aadhaar_front)
    const b = Boolean(docs.aadhaar_back)
    if (docs.aadhaar_both) return ''
    if (f !== b) return 'Upload both the front and the back, or use the single-file option.'
    return ''
  }

  const isLast = step === STEPS.length - 1
  const goNext = () => {
    const problem = addressProblem(current)
    if (problem) {
      setStepError(problem)
      return
    }
    setStepError('')
    if (!isLast) setStep(step + 1)
  }

  const submit = async () => {
    if (!uid || !lender || quotedRoi === null) return
    const problem = addressProblem(current)
    if (problem) {
      setStepError(problem)
      return
    }
    const missing = missingRequired(docs)
    if (missing.length > 0) {
      const names = missing.map((m) => m.label)
      setStepError(`Please upload all documents before submitting. Still needed: ${names.join('; ')}.`)
      // Take the customer to the first step that still has something missing.
      if (!missing.some((m) => m.step === step)) setStep(missing[0].step)
      return
    }
    if (reviewMode) {
      const flagged = Object.values(docs).filter((d) => d.reviewStatus === 'rejected')
      if (flagged.length > 0) {
        setStepError(`Replace the documents marked "Needs changes" before you resubmit: ${flagged.map((d) => d.label).join(', ')}.`)
        const idx = STEPS.findIndex((st) => st.slots.some((sl) => sl.id === flagged[0].slot))
        if (idx >= 0 && idx !== step) setStep(idx)
        return
      }
    }
    setSubmitting(true)
    try {
      if (reviewMode) await resubmitQuoteApplication(uid, appId)
      else await saveQuoteApplication(uid, { loanType, lenderId: lender.id, amount, tenureMonths: tenure, roi: quotedRoi, step: 'documents_uploaded', purpose: purpose || undefined })
      const q = new URLSearchParams({ type: loanType, lender: params.get('lender') ?? '', amount: String(amount), tenure: String(tenure), purpose })
      navigate(`/loans/quotes/review?${q.toString()}`)
    } catch (err) {
      showToast({ type: 'error', title: reviewMode ? 'Could not resubmit' : 'Could not submit', message: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const backToDetails = () => {
    const q = new URLSearchParams({ type: loanType, lender: params.get('lender') ?? '', amount: String(amount), tenure: String(tenure), purpose })
    navigate(`/loans/quotes/personal-details?${q.toString()}`)
  }

  const ready = isAuthenticated && validParams && draftId && !setupError

  const renderSlot = (s: StepDef, slot: SlotDef) => {
    const d = docs[slot.id]
    const loading = busy === slot.id
    const blockedBy =
      s.address && slot.id === 'aadhaar_both' ? Boolean(docs.aadhaar_front || docs.aadhaar_back) : s.address && slot.id !== 'aadhaar_both' ? Boolean(docs.aadhaar_both) : false
    const period = periods[slot.id]
    const years = [new Date().getFullYear() - 1, new Date().getFullYear()]
    return (
      <div key={slot.id} className={`du-card${slot.id === 'aadhaar_both' ? ' is-alt' : ''}`}>
        <div className="du-card-row">
          <div className="du-card-name">
            <img alt="" width={30} height={30} src="/assets/icons/doc-file-icon.svg" />
            <span>{slot.label}</span>
          </div>
          {d ? (
            <div className="du-done">
              <span className={`du-pill${d.reviewStatus === 'rejected' ? ' is-flag' : ''}`}>
                {d.reviewStatus === 'rejected' ? <>Needs changes</> : <><img alt="" width={15} height={15} src="/assets/icons/doc-tick.svg" /> {d.reviewStatus === 'verified' ? 'Verified' : 'Uploaded'}</>}
              </span>
              <button type="button" className="du-icon-btn" aria-label={`Replace ${slot.label}`} disabled={loading || (reviewMode && d.reviewStatus !== 'rejected')} title={reviewMode && d.reviewStatus !== 'rejected' ? 'This document was accepted' : undefined} onClick={() => startUpload(slot, s.formats)}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <img alt="" width={18} height={18} src="/assets/icons/doc-refresh.svg" />}
              </button>
              <button type="button" className="du-icon-btn" aria-label={`View ${slot.label}`} onClick={() => void preview(slot)}>
                <img alt="" width={18} height={18} src="/assets/icons/doc-eye.svg" />
              </button>
            </div>
          ) : (
            <button type="button" className="du-upload" disabled={loading || blockedBy} title={blockedBy ? 'Remove the other option first' : undefined} onClick={() => startUpload(slot, s.formats)}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <img alt="" width={22} height={22} src="/assets/icons/doc-upload-icon.svg" />} Upload
            </button>
          )}
        </div>
        {d && <p className="du-filename">{d.fileName}</p>}
        {d?.reviewStatus === 'rejected' && <p className="du-flag-note" role="alert"><strong>Why:</strong> {d.reviewNote || 'Please upload a clearer copy.'}</p>}
        {slot.period && (
          <div className="du-period">
            <p>Select Year &amp; Month:</p>
            <div className="du-period-selects">
              <select
                className="du-select"
                aria-label={`${slot.label} year`}
                disabled={Boolean(d)}
                value={period.year}
                onChange={(e) => setPeriods((p) => ({ ...p, [slot.id]: { ...p[slot.id], year: Number(e.target.value) } }))}
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                className="du-select"
                aria-label={`${slot.label} month`}
                disabled={Boolean(d)}
                value={period.month}
                onChange={(e) => setPeriods((p) => ({ ...p, [slot.id]: { ...p[slot.id], month: Number(e.target.value) } }))}
              >
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
          </div>
        )}
        {d && !loading && !reviewMode && (
          <button type="button" className="du-link" onClick={() => void removeDoc(slot)}>Remove</button>
        )}
      </div>
    )
  }

  return (
    <div className="du-root">
      {/* Mobile header */}
      <div className="du-mobile">
        <div className="du-mobile-row">
          <QuotesHeaderLogo />
          <small>Step {step + 1} of {STEPS.length}</small>
        </div>
        <div className="du-bars" aria-hidden>
          {STEPS.map((s, i) => <i key={s.id} className={hasUpload(s) ? 'is-done' : i === step ? 'is-active' : ''} />)}
        </div>
      </div>

      {/* Left: progress */}
      <aside className="du-aside">
        <QuotesHeaderLogo />
        <h2>Document Upload Required</h2>
        <p>For further processing of your application, please provide documents as listed below.</p>
        <ul>
          <li>Do ensure documents are correct &amp; clear to avoid rejection</li>
          <li>Click <strong>&quot;Submit&quot;</strong> once all documents are uploaded</li>
        </ul>
        <ol className="du-steps">
          {STEPS.map((s, i) => {
            const done = hasUpload(s) && i !== step
            const active = i === step
            const last = i === STEPS.length - 1
            const state = (done ? ' is-done' : active ? ' is-active' : '') + (flaggedIn(s) ? ' is-flag' : '')
            return (
              <li key={s.id} className="du-step">
                {!last && <span aria-hidden className={`du-step-line${hasUpload(s) ? ' is-done' : active ? ' is-active' : ''}`} />}
                <button type="button" className={`du-step-dot${state}`} onClick={() => setStep(i)} aria-current={active ? 'step' : undefined}>
                  {done ? <Check size={30} strokeWidth={3} /> : i + 1}
                </button>
                <span className={`du-step-title${state}`}>{s.title}</span>
              </li>
            )
          })}
        </ol>
      </aside>

      {/* Right: current step */}
      <main className="du-main">
        <div className="du-content">
          {isLoading ? (
            <div className="du-spin"><Loader2 className="animate-spin" size={18} /> Loading...</div>
          ) : !isAuthenticated ? (
            <div className="du-box">
              <h3>Sign in to upload documents</h3>
              <p>Your files are stored securely and linked to your account.</p>
              <button type="button" className="du-primary" onClick={() => openAuthModal('phone')}>Login with OTP</button>
            </div>
          ) : !validParams ? (
            <div className="du-box">
              <h3>We could not find this application</h3>
              <p>Start again from the loan offers page.</p>
              <button type="button" className="du-primary" onClick={() => navigate('/loans/quotes')}>View offers</button>
            </div>
          ) : setupError ? (
            <p role="alert" className="du-error">{setupError}</p>
          ) : !ready ? (
            <div className="du-spin"><Loader2 className="animate-spin" size={18} /> Preparing your secure upload...</div>
          ) : (
            <>
              {reviewMode && (
                <p className="du-flag-banner" role="status">
                  <strong>Changes requested.</strong> {reviewMessage || 'Please update the documents marked below.'} Replace only the documents marked "Needs changes", then resubmit.
                </p>
              )}
              {reusedFrom && (
                <p className="du-reuse" role="status">
                  We reused the documents you uploaded for your earlier application with {reusedFrom.lenderName}. Use the replace button on any that are out of date, then continue.
                </p>
              )}
              <h1 className="du-title">{current.title}</h1>
              {current.subtitle && <p className="du-subtitle">{current.subtitle}</p>}
              <div className="du-meta">
                <span>Supported file formats</span>
                {current.formats.map((f) => <span key={f} className="du-chip">.{f}</span>)}
              </div>
              <div className="du-meta">
                <span>Max File Size</span> <span className="du-chip">5MB</span>
              </div>

              <div className="du-slots">
                {current.address ? (
                  <>
                    {renderSlot(current, current.slots[0])}
                    {renderSlot(current, current.slots[1])}
                    <div className="du-or" role="separator" aria-label="Or">
                      <span />
                      <b>OR</b>
                      <span />
                    </div>
                    {renderSlot(current, current.slots[2])}
                  </>
                ) : (
                  current.slots.map((slot) => renderSlot(current, slot))
                )}
              </div>

              {stepError && <p role="alert" className="du-error">{stepError}</p>}

              <div className="du-nav">
                {step > 0 ? (
                  <button type="button" className="du-btn" onClick={() => { setStepError(''); setStep(step - 1) }}>Previous</button>
                ) : (
                  <button type="button" className="du-btn is-outline" onClick={backToDetails}>Back</button>
                )}
                {isLast ? (
                  <button type="button" className="du-btn" disabled={submitting} onClick={() => void submit()}>
                    {submitting && <Loader2 size={18} className="animate-spin" />} {reviewMode ? 'Resubmit' : 'Submit'}
                  </button>
                ) : (
                  <button type="button" className="du-btn" onClick={goNext}>{hasUpload(current) ? 'Next' : 'Skip | Next'}</button>
                )}
              </div>

              <p className="du-terms">
                By submitting, you have read and agree to our<br />
                <a href="#terms">Terms of Use</a> and <a href="#privacy">Privacy Policy</a>
              </p>
            </>
          )}
        </div>
      </main>

      <input ref={fileInput} type="file" style={{ display: 'none' }} onChange={(e) => void onFileChosen(e)} />
      <AuthModal />
    </div>
  )
}
