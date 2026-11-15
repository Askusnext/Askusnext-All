import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import {
  fetchCustomerDetails, saveCustomerDetails, saveQuoteApplication, type CustomerDetails,
} from '../../services/api/loansApi'
import { findLender } from '../../constants/quotesData'
import { QUOTE_TYPES, QUOTE_TYPE_NAMES } from '../../constants/quotesTypes'
import { SALARY_BANKS } from '../../constants/profileOptions'
import { adaptLender } from '../../utils/quotes'
import { isValidEmail, isValidPan, isValidPincode } from '../../utils/validation'
import { AuthModal } from '../../components/auth/AuthModal'
import { FloatingCombo, FloatingInput } from '../../components/quotes/FloatingFields'
import { FlowShell } from '../../components/quotes/FlowShell'

interface Form {
  pan: string
  salaryBank: string
  line1: string
  line2: string
  pin: string
  city: string
  state: string
  email: string
}

const EMPTY_FORM: Form = { pan: '', salaryBank: '', line1: '', line2: '', pin: '', city: '', state: '', email: '' }

const EMPTY_DETAILS: CustomerDetails = {
  fullName: '', email: '', dateOfBirth: '', address: '', pinCode: '', panNumber: '', employmentType: '',
  employerName: '', monthlyIncome: null, gender: '', maritalStatus: '', qualification: '',
  salaryBank: '', addressLine2: '', city: '', state: '',
}

type Errors = Partial<Record<keyof Form, string>>

const validate = (f: Form): Errors => {
  const e: Errors = {}
  if (!isValidPan(f.pan)) e.pan = 'Enter a valid PAN (e.g. ABCDE1234F).'
  if (!SALARY_BANKS.includes(f.salaryBank)) e.salaryBank = 'Please select your salary bank'
  if (f.line1.trim().length < 3) e.line1 = 'Enter your residence address.'
  if (f.line2.trim().length < 2) e.line2 = 'Enter your area or landmark.'
  if (!isValidPincode(f.pin)) e.pin = 'Enter a valid 6-digit pincode.'
  if (f.city.trim().length < 2) e.city = 'Enter your city.'
  if (f.state.trim().length < 2) e.state = 'Enter your state.'
  if (!isValidEmail(f.email)) e.email = 'Enter a valid email address.'
  return e
}

const longDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const shortDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso)

const formFromProfile = (d: CustomerDetails, authEmail?: string): Form => ({
  pan: d.panNumber,
  salaryBank: SALARY_BANKS.includes(d.salaryBank) ? d.salaryBank : '',
  line1: d.address,
  line2: d.addressLine2,
  pin: d.pinCode,
  city: d.city,
  state: d.state,
  email: d.email || authEmail || '',
})

const ReviewRow: React.FC<{ label: string; value: string; right?: boolean }> = ({ label, value, right }) => (
  <div className={`min-w-0 ${right ? 'text-right' : ''}`}>
    <p className="font-poppins text-[13px] leading-5 text-[#6A6D71]">{label}</p>
    <p className="mt-0.5 break-words font-poppins text-[16px] font-medium leading-6 text-[#1C1D1F]">{value || '-'}</p>
  </div>
)

/**
 * Step after "Let's Get to Know You": PAN, salary bank, residence address and
 * email. Shown as a read-only review when everything is already saved in the
 * profile (with Edit), otherwise as a form. Saved back to the profile on Proceed.
 */
export const PersonalDetailsPage: React.FC = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, isAuthenticated, isLoading, openAuthModal, patchUser } = useAuth()
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

  const [profile, setProfile] = useState<CustomerDetails>(EMPTY_DETAILS)
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [errors, setErrors] = useState<Errors>({})
  const [editing, setEditing] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)

  const uid = user?.uid
  useEffect(() => {
    if (!uid) return
    let active = true
    fetchCustomerDetails(uid)
      .then((d) => {
        if (!active) return
        const f = formFromProfile(d, user?.email)
        setProfile(d)
        setForm(f)
        // Everything already saved: start with the read-only review.
        setEditing(Object.keys(validate(f)).length > 0)
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

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // Saved addresses the customer can pick from.
  const emailSuggestions = useMemo(
    () => Array.from(new Set([profile.email, user?.email ?? ''].map((e) => e.trim()).filter(isValidEmail))),
    [profile.email, user?.email],
  )

  const backToKnowYou = () => {
    const q = new URLSearchParams({ type: loanType, lender: params.get('lender') ?? '', amount: String(amount), tenure: String(tenure), purpose })
    navigate(`/loans/quotes/know-you?${q.toString()}`)
  }

  const proceed = async () => {
    if (!uid) return
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length) {
      setEditing(true)
      return
    }
    setSaving(true)
    try {
      const next: CustomerDetails = {
        ...profile,
        panNumber: form.pan.trim().toUpperCase(),
        salaryBank: form.salaryBank,
        address: form.line1.trim(),
        addressLine2: form.line2.trim(),
        pinCode: form.pin.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        email: form.email.trim(),
      }
      if (JSON.stringify(next) !== JSON.stringify(profile)) {
        await saveCustomerDetails(uid, next)
        setProfile(next)
        patchUser({ email: next.email })
        showToast({ type: 'success', title: 'Details saved', message: 'Your profile has been updated.' })
      }
      if (lender && quotedRoi !== null && amount >= 1000 && Number.isInteger(tenure) && tenure >= 1) {
        await saveQuoteApplication(uid, { loanType, lenderId: lender.id, amount, tenureMonths: tenure, roi: quotedRoi, step: 'personal_details', purpose: purpose || undefined })
      }
      const q = new URLSearchParams({ type: loanType, lender: params.get('lender') ?? '', amount: String(amount), tenure: String(tenure), purpose })
      navigate(`/loans/quotes/documents?${q.toString()}`)
    } catch (err) {
      showToast({ type: 'error', title: 'Could not save', message: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const previousStepIncomplete = !loading && isAuthenticated && (!profile.fullName || !profile.dateOfBirth)
  const bankLabel = profile.employmentType === 'self_employed' || profile.employmentType === 'professional' ? 'Primary Bank' : 'Salary Bank'
  const pinOk = isValidPincode(form.pin)
  const ready = isAuthenticated && !loading

  const footer = ready ? (
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

  return (
    <>
      <FlowShell
        title="Personal Details"
        lender={lender}
        summary={amount >= 1000 && tenure >= 1 ? { typeName: QUOTE_TYPE_NAMES[loanType] ?? 'Loan', amount, tenure } : undefined}
        onBack={backToKnowYou}
        footer={footer}
      >
        {isLoading || (isAuthenticated && loading) ? (
          <div className="flex items-center gap-2 py-10 text-sm text-[#6A6D71]"><Loader2 className="animate-spin" size={18} /> Loading your details...</div>
        ) : !isAuthenticated ? (
          <div className="max-w-[560px] rounded-xl border border-[#E4E4E3] p-5 text-center">
            <p className="text-[15px] font-semibold text-[#052F5F]">Sign in to continue</p>
            <p className="mt-1 text-[13px] text-[#6A6D71]">We use your saved profile so you don&apos;t have to type your details again.</p>
            <button type="button" onClick={() => openAuthModal('phone')} className="mt-4 rounded-lg bg-[#0066ff] px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0052cc]">Login with OTP</button>
          </div>
        ) : (
          <div className="flex max-w-[560px] flex-col gap-5">
            {loadError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-[12px] text-amber-800">We couldn&apos;t load your saved details. Enter them below and they will be saved when you continue.</p>}
            {previousStepIncomplete && (
              <p role="alert" className="rounded-lg bg-amber-50 p-3 text-[12px] text-amber-900">
                Your name and date of birth are missing. <button type="button" onClick={backToKnowYou} className="font-semibold underline">Complete the previous step</button> first.
              </p>
            )}

            {!editing ? (
              <section className="overflow-hidden rounded-[6px] border border-[#E4E4E3]">
                <div className="flex items-center justify-between bg-[#F5F5F5] px-5 py-3.5">
                  <h2 className="text-[16px] font-medium text-[#1C1D1F]">Ensure your details are correct</h2>
                  <button type="button" onClick={() => setEditing(true)} className="text-[15px] font-medium text-[#0066FF]">Edit</button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-5 px-5 py-5">
                  <ReviewRow label="PAN Number" value={form.pan} />
                  <ReviewRow right label="Full Name (as per PAN)" value={profile.fullName} />
                  <ReviewRow label="Date of Birth (as per PAN)" value={shortDate(profile.dateOfBirth)} />
                  <ReviewRow right label={bankLabel} value={form.salaryBank} />
                  <ReviewRow label="Residence Address Line 1" value={form.line1} />
                  <ReviewRow right label="Residence Address Line 2" value={form.line2} />
                  <ReviewRow label="Residence Pincode" value={form.pin} />
                  <ReviewRow right label="City" value={form.city} />
                  <ReviewRow label="State" value={form.state} />
                  <ReviewRow right label="Personal Email ID" value={form.email} />
                </div>
              </section>
            ) : (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault()
                  void proceed()
                }}
                className="flex flex-col gap-[1.6rem] md:gap-5"
              >
                <FloatingInput
                  label="PAN Number"
                  required
                  uppercase
                  maxLength={10}
                  autoComplete="off"
                  value={form.pan}
                  onChange={(v) => set('pan', v)}
                  error={errors.pan}
                  helper={
                    profile.fullName && profile.dateOfBirth ? (
                      <div className="mb-2 mt-1 flex items-start gap-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-1">
                            <img alt="" width={18} height={18} className="mt-px size-[18px] shrink-0 object-contain" src="/assets/images/pan-confirm-person.png" />
                            <p className="m-0 min-w-0 break-words">Name in your profile <span className="font-bold">{profile.fullName}</span></p>
                          </div>
                          <div className="flex items-start gap-1">
                            <img alt="" width={18} height={18} className="mt-px size-[18px] shrink-0 object-contain" src="/assets/images/pan-confirm-cake.png" />
                            <p className="m-0 min-w-0 break-words">Born on <span className="font-bold">{longDate(profile.dateOfBirth)}</span></p>
                          </div>
                        </div>
                        <button type="button" onClick={backToKnowYou} className="shrink-0 whitespace-nowrap text-[#0066FF] underline">Incorrect details?</button>
                      </div>
                    ) : null
                  }
                />

                <FloatingCombo
                  label={bankLabel}
                  required
                  options={SALARY_BANKS}
                  value={form.salaryBank}
                  onChange={(v) => set('salaryBank', v)}
                  error={errors.salaryBank}
                  helper={`Enter your ${bankLabel.toLowerCase()} name`}
                />

                <FloatingInput label="Residence Address Line 1" required autoComplete="address-line1" maxLength={200} value={form.line1} onChange={(v) => set('line1', v)} error={errors.line1} />
                <FloatingInput label="Residence Address Line 2" required autoComplete="address-line2" maxLength={200} value={form.line2} onChange={(v) => set('line2', v)} error={errors.line2} />
                <FloatingInput
                  label="Residence Pincode"
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={6}
                  value={form.pin}
                  onChange={(v) => set('pin', v.replace(/\D/g, '').slice(0, 6))}
                  error={errors.pin}
                  helper={pinOk && form.city && form.state ? `${form.city}, ${form.state}` : undefined}
                />
                {pinOk && (
                  <div className="grid grid-cols-2 gap-3">
                    <FloatingInput label="City" required autoComplete="address-level2" maxLength={60} value={form.city} onChange={(v) => set('city', v)} error={errors.city} />
                    <FloatingInput label="State" required autoComplete="address-level1" maxLength={60} value={form.state} onChange={(v) => set('state', v)} error={errors.state} />
                  </div>
                )}

                <div className="flex w-full min-w-0 flex-col gap-2 rounded-lg bg-[#F2F7FF] px-2 py-3">
                  <FloatingInput label="Personal Email ID" autoComplete="email" type="email" maxLength={254} value={form.email} onChange={(v) => set('email', v)} error={errors.email} />
                  {emailSuggestions.length > 0 && (
                    <>
                      <div className="flex min-w-0 items-center gap-3 py-2" role="separator" aria-label="Or">
                        <span className="h-px min-w-0 flex-1 bg-[#E8EAED]" aria-hidden />
                        <span className="shrink-0 text-[12px] font-medium leading-4 text-[#8F9194]">Or</span>
                        <span className="h-px min-w-0 flex-1 bg-[#E8EAED]" aria-hidden />
                      </div>
                      <div className="flex w-full min-w-0 flex-col gap-2">
                        <p className="m-0 text-left text-[14px] font-medium leading-5 text-[#45484D]">Choose from below</p>
                        <div className="w-full min-w-0 overflow-hidden rounded-[8px] border border-[#D3D6DB] bg-white px-4">
                          <fieldset className="min-w-0 border-0 p-0">
                            <legend className="sr-only">Choose from suggested email addresses</legend>
                            {emailSuggestions.map((s) => (
                              <label key={s} className="flex min-h-[62px] cursor-pointer items-center gap-3 py-4">
                                <input type="radio" name="suggested-email" checked={form.email === s} onChange={() => set('email', s)} className="h-4 w-4 shrink-0 cursor-pointer accent-[#0066FF]" />
                                <span className="min-w-0 break-all text-[16px] leading-6 text-[#1C1D1F]">{s}</span>
                              </label>
                            ))}
                          </fieldset>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button type="submit" className="sr-only">Save</button>
              </form>
            )}

          </div>
        )}
      </FlowShell>
      <AuthModal />
    </>
  )
}
