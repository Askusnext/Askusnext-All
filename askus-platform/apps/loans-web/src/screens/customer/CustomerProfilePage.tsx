import React, { useEffect, useState } from 'react'
import {
  ShieldCheck, CheckCircle2, Save, Lock, User, Smartphone, Mail, IdCard,
  CalendarDays, MapPin, Building2, BriefcaseBusiness, Banknote, Loader2,
} from 'lucide-react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchCustomerDetails, saveCustomerDetails, type CustomerDetails,
} from '../../services/api/loansApi'
import { useToast } from '../../contexts/ToastContext'
import { GENDERS, MARITAL_STATUSES, QUALIFICATIONS } from '../../constants/profileOptions'
import { isValidEmail, isValidPan, isValidPincode } from '../../utils/validation'

const EMPTY: CustomerDetails = {
  fullName: '', email: '', dateOfBirth: '', address: '', pinCode: '', panNumber: '',
  employmentType: '', employerName: '', monthlyIncome: null, gender: '', maritalStatus: '', qualification: '',
  salaryBank: '', addressLine2: '', city: '', state: '',
}

const EMPLOYMENT_OPTIONS = [
  { value: 'salaried', label: 'Salaried' },
  { value: 'self_employed', label: 'Self employed' },
  { value: 'professional', label: 'Self employed professional' },
  { value: 'other', label: 'Other' },
]

type Errors = Partial<Record<keyof CustomerDetails, string>>

const validate = (d: CustomerDetails): Errors => {
  const e: Errors = {}
  if (d.fullName.trim().length > 100) e.fullName = 'Name is too long.'
  if (d.email && !isValidEmail(d.email)) e.email = 'Enter a valid email address.'
  if (d.dateOfBirth) {
    const dob = new Date(d.dateOfBirth)
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)
    if (Number.isNaN(dob.getTime()) || age < 18 || age > 100) e.dateOfBirth = 'You must be between 18 and 100 years old.'
  }
  if (d.pinCode && !isValidPincode(d.pinCode)) e.pinCode = 'Enter a valid 6-digit pin code.'
  if (d.panNumber && !isValidPan(d.panNumber)) e.panNumber = 'Enter a valid 10-character PAN (e.g. ABCDE1234F).'
  if (d.monthlyIncome !== null && (d.monthlyIncome < 0 || d.monthlyIncome > 100000000)) e.monthlyIncome = 'Enter a valid monthly income.'
  return e
}

export const CustomerProfilePage: React.FC = () => {
  const { user, patchUser } = useAuth()
  const { showToast } = useToast()
  const uid = user?.uid

  const [saved, setSaved] = useState<CustomerDetails>(EMPTY)
  const [form, setForm] = useState<CustomerDetails>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!uid) return
    let active = true
    fetchCustomerDetails(uid)
      .then((d) => {
        if (!active) return
        // Fall back to what sign-in already knows (e.g. Google name/email).
        const merged = { ...d, fullName: d.fullName || user?.displayName || '', email: d.email || user?.email || '' }
        setSaved(merged)
        setForm(merged)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setLoadError(true)
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

  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uid) return
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length) {
      showToast({ type: 'error', title: 'Check your details', message: 'Fix the highlighted fields and try again.' })
      return
    }
    setIsSaving(true)
    try {
      const clean = { ...form, fullName: form.fullName.trim(), email: form.email.trim(), panNumber: form.panNumber.trim().toUpperCase() }
      await saveCustomerDetails(uid, clean)
      setSaved(clean)
      setForm(clean)
      patchUser({ displayName: clean.fullName || undefined, email: clean.email || undefined })
      showToast({ type: 'success', title: 'Profile updated', message: 'Your details have been saved.' })
    } catch (err: unknown) {
      showToast({ type: 'error', title: 'Could not save', message: err instanceof Error ? err.message : 'Update failed' })
    } finally {
      setIsSaving(false)
    }
  }

  const input = 'w-full bg-transparent text-base font-medium text-[#052f5f] placeholder:text-slate-300 focus:outline-none'

  const row = (id: string, label: string, icon: React.ReactNode, control: React.ReactNode, error?: string, locked?: boolean) => (
    <div>
      <label htmlFor={id} className="block text-sm text-slate-500">{label}</label>
      <div className={`mt-1 flex items-center gap-3 border-b pb-2 ${error ? 'border-rose-400' : 'border-[#d0d1d2] focus-within:border-[#0066ff]'}`}>
        <span className="text-[#0066ff]">{icon}</span>
        <div className="min-w-0 flex-1">{control}</div>
        {locked && <Lock size={18} className="shrink-0 text-slate-400" aria-label="Verified, cannot be edited" />}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  )

  const firstName = (form.fullName || user?.displayName || 'Customer').split(' ')[0]

  return (
    <DashboardLayout title={`Welcome! ${firstName}`}>
      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl bg-white p-8 text-sm text-slate-500 shadow-sm"><Loader2 className="animate-spin" size={18} /> Loading your profile...</div>
      ) : (
        <form onSubmit={handleSave} noValidate className="space-y-8">
          {loadError && (
            <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              We couldn't load your saved details. You can still enter them, but check your connection before saving.
            </p>
          )}

          <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-9">
            <h2 className="text-xl font-semibold text-[#052f5f]">Personal Details</h2>
            <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-2">
              {row('pf-name', 'Full Name', <User size={20} />, (
                <input id="pf-name" className={input} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Your full name" autoComplete="name" maxLength={100} />
              ), errors.fullName)}
              {row('pf-dob', 'Date Of Birth', <CalendarDays size={20} />, (
                <input id="pf-dob" type="date" className={input} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} max={new Date().toISOString().slice(0, 10)} autoComplete="bday" />
              ), errors.dateOfBirth)}
              {row('pf-gender', 'Gender', <User size={20} />, (
                <select id="pf-gender" className={input} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                  <option value="">Select</option>
                  {GENDERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ))}
              {row('pf-marital', 'Marital Status', <User size={20} />, (
                <select id="pf-marital" className={input} value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}>
                  <option value="">Select</option>
                  {MARITAL_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ))}
              {row('pf-qual', 'Highest Qualification', <User size={20} />, (
                <select id="pf-qual" className={input} value={form.qualification} onChange={(e) => set('qualification', e.target.value)}>
                  <option value="">Select</option>
                  {QUALIFICATIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ))}
              {row('pf-email', 'Email Address', <Mail size={20} />, (
                <input id="pf-email" type="email" className={input} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" autoComplete="email" maxLength={254} />
              ), errors.email)}
              {row('pf-mobile', 'Mobile Number', <Smartphone size={20} />, (
                <span id="pf-mobile" className="block text-base font-medium text-slate-500">{user?.mobileNumber || '-'}</span>
              ), undefined, true)}
              {row('pf-address', 'Address', <Building2 size={20} />, (
                <input id="pf-address" className={input} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="House, street, area" autoComplete="street-address" maxLength={200} />
              ), errors.address)}
              {row('pf-address2', 'Address Line 2', <Building2 size={20} />, (
                <input id="pf-address2" className={input} value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} placeholder="Area, landmark" maxLength={200} />
              ))}
              {row('pf-city', 'City', <Building2 size={20} />, (
                <input id="pf-city" className={input} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" maxLength={60} />
              ))}
              {row('pf-state', 'State', <Building2 size={20} />, (
                <input id="pf-state" className={input} value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="State" maxLength={60} />
              ))}
              {row('pf-pin', 'Pin Code', <MapPin size={20} />, (
                <input id="pf-pin" inputMode="numeric" className={input} value={form.pinCode} onChange={(e) => set('pinCode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="600001" autoComplete="postal-code" />
              ), errors.pinCode)}
              {row('pf-pan', 'PAN Card Number', <IdCard size={20} />, (
                <input id="pf-pan" className={`${input} uppercase`} maxLength={10} value={form.panNumber} onChange={(e) => set('panNumber', e.target.value.toUpperCase())} placeholder="ABCDE1234F" autoComplete="off" />
              ), errors.panNumber)}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-9">
            <h2 className="text-xl font-semibold text-[#052f5f]">Employment Details</h2>
            <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-2">
              {row('pf-emp', 'Employment Type', <BriefcaseBusiness size={20} />, (
                <select id="pf-emp" className={input} value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
                  <option value="">Select</option>
                  {EMPLOYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ))}
              {row('pf-salarybank', 'Salary Bank', <Building2 size={20} />, (
                <input id="pf-salarybank" className={input} value={form.salaryBank} onChange={(e) => set('salaryBank', e.target.value)} placeholder="Bank where you receive income" maxLength={60} />
              ))}
              {row('pf-employer', 'Employer Name', <Building2 size={20} />, (
                <input id="pf-employer" className={input} value={form.employerName} onChange={(e) => set('employerName', e.target.value)} placeholder="Company or business name" maxLength={100} />
              ), errors.employerName)}
              {row('pf-income', 'Monthly Income', <Banknote size={20} />, (
                <input id="pf-income" inputMode="numeric" className={input} value={form.monthlyIncome ?? ''} onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
                  set('monthlyIncome', digits === '' ? null : Number(digits))
                }} placeholder="e.g. 70000" />
              ), errors.monthlyIncome)}
            </div>
            <p className="mt-8 text-sm text-[#052f5f]"><strong>Note:</strong> Please enter correct details so lenders can assess your application accurately.</p>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-9">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-[#052f5f]">
              <ShieldCheck className="text-[#0066ff]" size={22} /> Sign-in &amp; Security
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Your account is secured with one-time passwords sent to your verified mobile number, so there is no password to remember or reset. Your details are visible only to you and authorised Askus Financial Services staff.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-[#f7f8fa] p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Mobile</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#052f5f]"><CheckCircle2 size={16} className="text-[#00a86b]" /> OTP verified</p>
              </div>
              <div className="rounded-xl bg-[#f7f8fa] p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Google identity</p>
                <p className="mt-1 text-sm font-semibold text-[#052f5f]">{user?.googleLinked ? 'Linked' : 'Not linked'}</p>
              </div>
              <div className="rounded-xl bg-[#f7f8fa] p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">WhatsApp</p>
                <p className="mt-1 text-sm font-semibold text-[#052f5f]">Unavailable</p>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving || !dirty}
              className="flex items-center gap-2 rounded-lg bg-[#0066ff] px-12 py-3 text-base font-semibold text-white shadow transition hover:bg-[#0052cc] disabled:cursor-not-allowed disabled:bg-[#d9e0ea] disabled:text-slate-500 disabled:shadow-none"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </DashboardLayout>
  )
}
