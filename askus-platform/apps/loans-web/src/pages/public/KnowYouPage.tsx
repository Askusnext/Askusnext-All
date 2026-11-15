import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { fetchCustomerDetails, saveCustomerDetails, saveQuoteApplication, type CustomerDetails } from '../../services/api/loansApi'
import { findLender } from '../../constants/quotesData'
import { QUOTE_TYPES, QUOTE_TYPE_NAMES } from '../../constants/quotesTypes'
import { adaptLender } from '../../utils/quotes'
import { GENDERS, LOAN_PURPOSES, MARITAL_STATUSES, QUALIFICATIONS, optionLabel, type Option } from '../../constants/profileOptions'
import { isValidEmail, isValidPan } from '../../utils/validation'
import { AuthModal } from '../../components/auth/AuthModal'
import { FlowShell } from '../../components/quotes/FlowShell'

const EMPTY: CustomerDetails = {
  fullName: '', email: '', dateOfBirth: '', address: '', pinCode: '', panNumber: '', employmentType: '',
  employerName: '', monthlyIncome: null, gender: '', maritalStatus: '', qualification: '',
  salaryBank: '', addressLine2: '', city: '', state: '',
}

type Errors = Partial<Record<keyof CustomerDetails | 'purpose', string>>

const REQUIRED_KEYS: (keyof CustomerDetails)[] = ['panNumber', 'fullName', 'dateOfBirth', 'gender', 'maritalStatus', 'qualification', 'email']

const displayDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso)

const validate = (d: CustomerDetails, purpose: string): Errors => {
  const e: Errors = {}
  if (!isValidPan(d.panNumber)) e.panNumber = 'Enter a valid PAN (e.g. ABCDE1234F).'
  if (d.fullName.trim().length < 2) e.fullName = 'Enter your name as per PAN.'
  const dob = new Date(d.dateOfBirth)
  const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)
  if (!d.dateOfBirth || Number.isNaN(dob.getTime()) || age < 18 || age > 100) e.dateOfBirth = 'Enter a date of birth (18 to 100 years).'
  if (!d.gender) e.gender = 'Select gender.'
  if (!d.maritalStatus) e.maritalStatus = 'Select marital status.'
  if (!d.qualification) e.qualification = 'Select qualification.'
  if (!isValidEmail(d.email)) e.email = 'Enter a valid email address.'
  if (!purpose) e.purpose = 'Select a purpose.'
  return e
}

interface RowProps {
  id: string
  label: string
  right?: boolean
  error?: string
  value: string
  editing: boolean
  children: React.ReactNode
}

const Row: React.FC<RowProps> = ({ id, label, right, error, value, editing, children }) => (
  <div className={`min-w-0 ${right ? 'text-right' : ''}`}>
    <label htmlFor={editing ? id : undefined} className="block font-poppins text-[13px] leading-5 text-[#6A6D71]">{label}</label>
    {editing ? <div className="mt-1 text-left">{children}</div> : <p className="mt-0.5 break-words font-poppins text-[16px] font-medium leading-6 text-[#1C1D1F]">{value || '-'}</p>}
    {error && <p role="alert" className="mt-1 text-left font-poppins text-[11px] text-rose-600">{error}</p>}
  </div>
)

/**
 * Step shown after "Apply Now" on a quote: confirms personal details from the
 * saved profile. First-time users fill them in once; they are saved to the
 * profile and can be edited later here or under My Profile.
 */
export const KnowYouPage: React.FC = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, isAuthenticated, isLoading, openAuthModal, patchUser } = useAuth()
  const { showToast } = useToast()

  const lender = useMemo(() => findLender(params.get('lender') ?? ''), [params])

  const loanType = params.get('type') ?? ''
  const amount = Number(params.get('amount'))
  const tenure = Number(params.get('tenure'))
  // The rate this application was quoted at (sample rate for the loan type).
  const quotedRoi = useMemo(() => {
    const t = QUOTE_TYPES[loanType]
    return lender && t ? adaptLender(lender, t).roi : null
  }, [lender, loanType])
  const canTrack = Boolean(lender && quotedRoi !== null && amount >= 1000 && Number.isInteger(tenure) && tenure >= 1)

  const track = (step: 'know_you' | 'details_confirmed', purposeValue?: string) => {
    if (!uid || !lender || quotedRoi === null || !canTrack) return Promise.resolve()
    return saveQuoteApplication(uid, { loanType, lenderId: lender.id, amount, tenureMonths: tenure, roi: quotedRoi, step, purpose: purposeValue || undefined })
  }

  const [saved, setSaved] = useState<CustomerDetails>(EMPTY)
  const [form, setForm] = useState<CustomerDetails>(EMPTY)
  const [purpose, setPurpose] = useState(params.get('purpose') || '')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Errors>({})

  const uid = user?.uid

  // Starting (or reopening) this step records the application as in progress.
  useEffect(() => {
    if (!uid || !canTrack) return
    void track('know_you', params.get('purpose') ?? undefined).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, canTrack, lender?.id, loanType])

  useEffect(() => {
    if (!uid) return
    let active = true
    fetchCustomerDetails(uid)
      .then((d) => {
        if (!active) return
        const merged = { ...d, fullName: d.fullName || user?.displayName || '', email: d.email || user?.email || '' }
        setSaved(merged)
        setForm(merged)
        // First-time users (anything required missing) start in edit mode.
        setEditing(REQUIRED_KEYS.some((k) => !merged[k]))
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setLoadError(true)
        setEditing(true)
        setLoading(false)
      })
    return () => {
      active = false
    }
    // Load once per signed-in user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  const set = <K extends keyof CustomerDetails>(key: K, value: CustomerDetails[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const proceed = async () => {
    if (!uid) return
    const found = validate(form, purpose)
    setErrors(found)
    if (Object.keys(found).length) {
      setEditing(true)
      return
    }
    const clean = { ...form, fullName: form.fullName.trim(), email: form.email.trim(), panNumber: form.panNumber.trim().toUpperCase() }
    setSaving(true)
    try {
      if (JSON.stringify(clean) !== JSON.stringify(saved)) {
        await saveCustomerDetails(uid, clean)
        setSaved(clean)
        setForm(clean)
        patchUser({ displayName: clean.fullName, email: clean.email })
        showToast({ type: 'success', title: 'Details saved', message: 'Your profile has been updated.' })
      }
      await track('details_confirmed', purpose)
      const q = new URLSearchParams({ type: loanType, lender: params.get('lender') ?? '', amount: String(amount), tenure: String(tenure), purpose })
      navigate(`/loans/quotes/personal-details?${q.toString()}`)
    } catch (err) {
      showToast({ type: 'error', title: 'Could not save', message: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full rounded-lg border border-[#E4E4E3] bg-white px-3 py-2 font-poppins text-[14px] text-[#1C1D1F] focus:border-[#0066ff] focus:outline-none focus:ring-2 focus:ring-[#d9e8ff]'

  const select = (id: string, value: string, onChange: (v: string) => void, options: Option[]) => (
    <select id={id} className={field} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )

  const typeName = QUOTE_TYPE_NAMES[loanType] ?? 'Loan'
  const goBack = () => navigate(`/loans/quotes?${new URLSearchParams({ type: loanType, amount: String(amount) }).toString()}`)

  return (
    <>
      <FlowShell
        title="Let's Get to Know You"
        lender={lender}
        summary={amount >= 1000 && tenure >= 1 ? { typeName, amount, tenure } : undefined}
        onBack={goBack}
        footer={
          isAuthenticated && !loading ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => void proceed()}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#0066ff] text-[18px] font-medium text-white transition hover:bg-[#0052cc] disabled:opacity-60"
              >
                {saving && <Loader2 className="animate-spin" size={18} />} Proceed
              </button>
              <p className="mt-3 flex items-center justify-center gap-2 text-center text-[13px] text-[#45484D]">
                <img alt="" width={18} height={18} src="/assets/icons/shield-tick.svg" /> Your details are visible only to you and authorised staff
              </p>
  
            </>
          ) : undefined
        }
      >
        {isLoading || (isAuthenticated && loading) ? (
          <div className="flex items-center gap-2 py-10 text-sm text-[#6A6D71]"><Loader2 className="animate-spin" size={18} /> Loading your details...</div>
        ) : !isAuthenticated ? (
          <div className="rounded-xl border border-[#E4E4E3] p-5 text-center">
            <p className="text-[15px] font-semibold text-[#052F5F]">Sign in to continue</p>
            <p className="mt-1 text-[13px] text-[#6A6D71]">We use your saved profile so you don&apos;t have to type your details again.</p>
            <button type="button" onClick={() => openAuthModal('phone')} className="mt-4 rounded-lg bg-[#0066ff] px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0052cc]">
              Login with OTP
            </button>
          </div>
        ) : (
          <>
            {loadError && <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-[12px] text-amber-800">We couldn&apos;t load your saved details. Enter them below and they will be saved when you continue.</p>}
            <section className="overflow-hidden rounded-[6px] border border-[#E4E4E3]">
              <div className="flex items-center justify-between bg-[#F5F5F5] px-6 py-4">
                <h2 className="text-[16px] font-medium text-[#1C1D1F]">{REQUIRED_KEYS.some((k) => !saved[k]) ? 'Tell us about yourself' : 'Ensure your details are correct'}</h2>
                {!editing ? (
                  <button type="button" onClick={() => setEditing(true)} className="text-[15px] font-medium text-[#0066FF]">Edit</button>
                ) : (
                  saved.panNumber && (
                    <button type="button" onClick={() => { setForm(saved); setErrors({}); setEditing(false) }} className="text-[15px] font-medium text-[#0066FF]">Cancel</button>
                  )
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-5 py-6">
                <Row editing={editing} id="ky-pan" label="PAN Number" value={form.panNumber} error={errors.panNumber}>
                  <input id="ky-pan" className={`${field} uppercase`} maxLength={10} value={form.panNumber} onChange={(e) => set('panNumber', e.target.value.toUpperCase())} placeholder="ABCDE1234F" autoComplete="off" />
                </Row>
                <Row editing={editing} id="ky-name" label="Full Name (as per PAN)" right value={form.fullName} error={errors.fullName}>
                  <input id="ky-name" className={field} maxLength={100} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" />
                </Row>
                <Row editing={editing} id="ky-dob" label="Date of Birth (as per PAN)" value={displayDate(form.dateOfBirth)} error={errors.dateOfBirth}>
                  <input id="ky-dob" type="date" className={field} value={form.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('dateOfBirth', e.target.value)} autoComplete="bday" />
                </Row>
                <Row editing={editing} id="ky-gender" label="Gender" right value={optionLabel(GENDERS, form.gender)} error={errors.gender}>
                  {select('ky-gender', form.gender, (v) => set('gender', v), GENDERS)}
                </Row>
                <Row editing={editing} id="ky-marital" label="Marital Status" value={optionLabel(MARITAL_STATUSES, form.maritalStatus)} error={errors.maritalStatus}>
                  {select('ky-marital', form.maritalStatus, (v) => set('maritalStatus', v), MARITAL_STATUSES)}
                </Row>
                <Row editing={editing} id="ky-qual" label="Highest Qualification" right value={optionLabel(QUALIFICATIONS, form.qualification)} error={errors.qualification}>
                  {select('ky-qual', form.qualification, (v) => set('qualification', v), QUALIFICATIONS)}
                </Row>
                <Row editing={editing} id="ky-purpose" label="Purpose of Loan" value={purpose} error={errors.purpose}>
                  {select('ky-purpose', purpose, (v) => { setPurpose(v); setErrors((e) => ({ ...e, purpose: undefined })) }, LOAN_PURPOSES)}
                </Row>
                <Row editing={editing} id="ky-email" label="Personal Email" right value={form.email} error={errors.email}>
                  <input id="ky-email" type="email" className={field} maxLength={254} value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
                </Row>
              </div>
            </section>
            <p className="mt-3 text-[11px] text-[#8F9194]">Saved to your Askus Fin profile, where you can edit it any time.</p>
          </>
        )}

      </FlowShell>
      <AuthModal />
    </>
  )
}
