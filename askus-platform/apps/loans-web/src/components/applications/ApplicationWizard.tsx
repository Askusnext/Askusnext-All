import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  User,
  Briefcase,
  Wallet,
  FileCheck2,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Upload,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  Check
} from 'lucide-react'
import { LENDERS } from '../../constants/banks'
import { FINANCIAL_SERVICES } from '../../constants/services'
import { generateDocumentChecklist } from '../../utils/checklistEngine'
import { calculateEMI } from '../../utils/emiCalculator'
import { formatINR } from '../../utils/formatters'
import {
  isValidIndianMobile,
  isValidPan,
  isValidPincode,
  validateUploadFile
} from '../../utils/validation'
import { deleteDraftDocument, uploadApplicationDocument } from '../../services/api/storageService'
import { fetchCustomerDetails, submitLoanApplication } from '../../services/api/loansApi'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import type {
  EmploymentType,
  SalaryPaymentMode,
  ApplicationDocument,
} from '../../types'

interface ApplicationWizardProps {
  initialServiceId?: string
  initialAmount?: number
  initialTenureMonths?: number
  initialLenderId?: string
}

const DRAFT_STORAGE_KEY = 'askus_application_draft'
const DOCUMENT_DRAFT_DOCS_KEY = `${DRAFT_STORAGE_KEY}_documents`

export const ApplicationWizard: React.FC<ApplicationWizardProps> = ({
  initialServiceId = 'personal-loan',
  initialAmount = 0,
  initialTenureMonths = 36,
  initialLenderId = 'hdfc-bank'
}) => {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [currentStep, setCurrentStep] = useState<number>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Form State
  // Step 1: Personal
  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('1995-01-01')
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male')
  const [mobile, setMobile] = useState(user?.mobileNumber ? user.mobileNumber.replace(/\D/g, '').slice(-10) : '')
  const [email, setEmail] = useState(user?.email || '')
  const [panNumber, setPanNumber] = useState(user?.panNumber || '')
  const [address, setAddress] = useState('')
  const [pincode, setPincode] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')

  // Step 2: Employment
  const [employmentType, setEmploymentType] = useState<EmploymentType>('salaried_bank')
  const [employerName, setEmployerName] = useState('')
  const [designation, setDesignation] = useState('')
  const [workExperienceYears, setWorkExperienceYears] = useState<number>(3)
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0)
  const [salaryPaymentMode, setSalaryPaymentMode] = useState<SalaryPaymentMode>('bank_transfer')
  const [salaryCreditBank, setSalaryCreditBank] = useState('HDFC Bank')

  // Step 3: Loan Details
  const [serviceId, setServiceId] = useState(initialServiceId)
  const [lenderId, setLenderId] = useState(initialLenderId)
  const [loanAmount, setLoanAmount] = useState<number>(initialAmount)
  const [tenureMonths, setTenureMonths] = useState<number>(initialTenureMonths)
  const [existingEmi, setExistingEmi] = useState<number>(0)
  const [purpose, setPurpose] = useState('Debt Consolidation & Personal Expenses')

  // Step 4: Documents list
  const [documents, setDocuments] = useState<ApplicationDocument[]>(() => {
    try {
      const saved = localStorage.getItem(DOCUMENT_DRAFT_DOCS_KEY)
      const parsed = saved ? JSON.parse(saved) : []
      return Array.isArray(parsed) ? parsed as ApplicationDocument[] : []
    } catch { return [] }
  })
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null)
  const [documentDraftId] = useState(() => {
    const key = `${DRAFT_STORAGE_KEY}_draft_id`
    const existing = localStorage.getItem(key)
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing
    const created = crypto.randomUUID()
    localStorage.setItem(key, created)
    return created
  })

  // Step 5: Consent
  const [consentGiven, setConsentGiven] = useState(false)

  // Selected Lender object
  const selectedLender = LENDERS.find((l) => l.id === lenderId) || LENDERS[0]
  const selectedService = FINANCIAL_SERVICES.find((s) => s.id === serviceId) || FINANCIAL_SERVICES[1]

  // Calculated EMI
  const calculatedEmi = calculateEMI(loanAmount, 12, tenureMonths / 12).monthlyEmi

  // Load draft on mount if available
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY)
      if (savedDraft) {
        const d = JSON.parse(savedDraft)
        if (d.fullName) setFullName(d.fullName)
        if (d.mobile) setMobile(d.mobile)
        if (d.email) setEmail(d.email)
        if (d.panNumber) setPanNumber(d.panNumber)
        if (d.address) setAddress(d.address)
        if (d.pincode) setPincode(d.pincode)
        if (d.city) setCity(d.city)
        if (d.state) setState(d.state)
        if (d.employerName) setEmployerName(d.employerName)
        if (d.designation) setDesignation(d.designation)
        if (d.monthlyIncome) setMonthlyIncome(d.monthlyIncome)
        if (d.employmentType) setEmploymentType(d.employmentType)
        if (d.salaryPaymentMode) setSalaryPaymentMode(d.salaryPaymentMode)
      }
    } catch {
      // Ignore parse error
    }
  }, [])

  // My Profile is the source of truth for personal and employment details.
  const [profileMissing, setProfileMissing] = useState<string[] | null>(null)
  useEffect(() => {
    if (!user?.uid) return
    let active = true
    fetchCustomerDetails(user.uid)
      .then((p) => {
        if (!active) return
        if (p.fullName) setFullName(p.fullName)
        if (p.dateOfBirth) setDob(p.dateOfBirth)
        if (p.email) setEmail(p.email)
        if (p.panNumber) setPanNumber(p.panNumber)
        if (p.address) setAddress(p.address)
        if (p.pinCode) setPincode(p.pinCode)
        if (p.gender === 'male' || p.gender === 'female' || p.gender === 'other') setGender(p.gender)
        if (p.employerName) setEmployerName(p.employerName)
        if (p.monthlyIncome) setMonthlyIncome(p.monthlyIncome)
        if (p.employmentType === 'salaried') setEmploymentType('salaried_bank')
        else if (p.employmentType === 'self_employed' || p.employmentType === 'professional') setEmploymentType('self_employed')
        const missing: string[] = []
        if (!p.fullName) missing.push('name')
        if (!p.dateOfBirth) missing.push('date of birth')
        if (!p.panNumber) missing.push('PAN')
        if (!p.address || !p.pinCode) missing.push('address')
        if (!p.employmentType || !p.monthlyIncome) missing.push('employment details')
        setProfileMissing(missing)
      })
      .catch(() => {
        if (active) setProfileMissing(null)
      })
    return () => {
      active = false
    }
  }, [user?.uid])

  // Update mobile if auth changes
  useEffect(() => {
    if (user?.mobileNumber) {
      setMobile(user.mobileNumber.replace(/\D/g, '').slice(-10))
    }
    if (user?.email && !email) {
      setEmail(user.email)
    }
  }, [user])

  // Sync checklist when lender, employment type, or salary mode changes
  useEffect(() => {
    const list = generateDocumentChecklist({
      serviceId,
      lenderId,
      employmentType,
      salaryPaymentMode,
      loanAmount
    })
    // Merge existing uploaded documents
    setDocuments((prevDocs) => {
      return list.map((newItem) => {
        const existing = prevDocs.find((p) => p.type === newItem.type)
        if (existing && (existing.storageKey || existing.fileUrl)) {
          return {
            ...newItem,
            fileUrl: existing.fileUrl,
            fileName: existing.fileName,
            fileSize: existing.fileSize,
            mimeType: existing.mimeType,
            storageKey: existing.storageKey,
            fileId: existing.fileId,
            fileFormat: existing.fileFormat,
            storageKind: existing.storageKind,
            fileVersion: existing.fileVersion,
            uploadedAt: existing.uploadedAt,
            status: existing.status,
          }
        }
        return newItem
      })
    })
  }, [serviceId, lenderId, employmentType, salaryPaymentMode, loanAmount])

  // Auto-save draft
  const saveDraft = () => {
    const draft = {
      fullName,
      dob,
      gender,
      mobile,
      email,
      panNumber,
      address,
      pincode,
      city,
      state,
      employmentType,
      employerName,
      designation,
      workExperienceYears,
      monthlyIncome,
      salaryPaymentMode,
      salaryCreditBank,
      serviceId,
      lenderId,
      loanAmount,
      tenureMonths,
      purpose,
      existingEmi
    }
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
    showToast({ type: 'info', title: 'Draft Saved', message: 'Your application progress is saved locally.' })
  }

  // File upload handler
  const handleFileUpload = async (docId: string, file: File) => {
    const validation = validateUploadFile(file)
    if (!validation.valid) {
      showToast({ type: 'error', title: 'Upload Failed', message: validation.error })
      return
    }

    try {
      setUploadingDocId(docId)
      if (!user?.uid) throw new Error('Sign in and verify your phone before uploading documents.')
      const currentDocument = documents.find((item) => item.id === docId)
      if (!currentDocument) throw new Error('Checklist document was not found.')
      const res = await uploadApplicationDocument(documentDraftId, currentDocument, file)

      setDocuments((prev) => {
        const next = prev.map((d) => {
          if (d.id === docId) {
            return {
              ...d,
              fileUrl: undefined,
              fileName: res.fileName,
              fileSize: res.fileSize,
              mimeType: res.mimeType,
              storageKey: res.storageKey,
              fileId: res.fileId,
              fileFormat: res.fileFormat,
              storageKind: res.storageKind,
              fileVersion: res.fileVersion,
              status: 'pending' as const,
              uploadedAt: new Date().toISOString()
            }
          }
          return d
        })
        localStorage.setItem(DOCUMENT_DRAFT_DOCS_KEY, JSON.stringify(next))
        return next
      })

      showToast({
        type: 'success',
        title: 'Document Uploaded',
        message: `${file.name} uploaded successfully.`
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload error'
      showToast({ type: 'error', title: 'Upload Error', message: msg })
    } finally {
      setUploadingDocId(null)
    }
  }

  const handleRemoveDoc = async (docId: string) => {
    const existing = documents.find((doc) => doc.id === docId)
    if (existing?.storageKey) {
      try { await deleteDraftDocument(documentDraftId, existing) } catch (error) {
        showToast({ type: 'error', title: 'Could not remove file', message: error instanceof Error ? error.message : 'Please try again.' })
        return
      }
    }
    setDocuments((prev) => {
      const next = prev.map((d) => {
        if (d.id === docId) {
          return {
            ...d,
            fileUrl: undefined,
            fileName: undefined,
            fileSize: undefined,
            mimeType: undefined,
            storageKey: undefined,
            fileId: undefined,
            fileFormat: undefined,
            storageKind: undefined,
            fileVersion: undefined,
            uploadedAt: undefined,
            status: 'pending' as const
          }
        }
        return d
      })
      localStorage.setItem(DOCUMENT_DRAFT_DOCS_KEY, JSON.stringify(next))
      return next
    })
  }

  // STEP VALIDATIONS
  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {}
    if (!fullName.trim() || fullName.trim().length < 3) {
      errs.fullName = 'Full legal name as per PAN is required.'
    }
    if (!isValidIndianMobile(mobile)) {
      errs.mobile = 'Valid 10-digit Indian mobile number is required.'
    }
    if (!isValidPan(panNumber)) {
      errs.panNumber = 'Valid 10-character PAN card number (e.g. ABCDE1234F) is required.'
    }
    if (!address.trim()) {
      errs.address = 'Current residential address is required.'
    }
    if (!isValidPincode(pincode)) {
      errs.pincode = 'Valid 6-digit PIN code is required.'
    }
    if (!city.trim()) {
      errs.city = 'City is required.'
    }
    if (!state.trim()) {
      errs.state = 'State is required.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {}
    if (!employerName.trim()) {
      errs.employerName = 'Employer or company name is required.'
    }
    if (!designation.trim()) {
      errs.designation = 'Current job designation is required.'
    }
    if (!monthlyIncome || monthlyIncome < 10000) {
      errs.monthlyIncome = 'Minimum monthly income of ₹10,000 is required.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {}
    if (!loanAmount || loanAmount < 10000) {
      errs.loanAmount = 'Requested loan amount must be at least ₹10,000.'
    }
    if (!tenureMonths || tenureMonths < 3) {
      errs.tenureMonths = 'Minimum tenure is 3 months.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateStep4 = (): boolean => {
    const missing = documents.filter((document) => document.required && !document.storageKey)
    if (missing.length) {
      showToast({ type: 'error', title: 'Required documents missing', message: `Upload: ${missing.map((doc) => doc.title).join(', ')}.` })
      return false
    }
    return true
  }

  const nextStep = () => {
    if (currentStep === 1 && !validateStep1()) return
    if (currentStep === 2 && !validateStep2()) return
    if (currentStep === 3 && !validateStep3()) return
    if (currentStep === 4 && !validateStep4()) return
    setCurrentStep((prev) => Math.min(prev + 1, 5))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // FINAL SUBMISSION
  const handleFinalSubmit = async () => {
    if (!user?.uid) return showToast({ type: 'error', title: 'Sign-in required', message: 'Sign in and verify your phone before submitting.' })
    if (!consentGiven) return showToast({ type: 'error', title: 'Consent required', message: 'Confirm the application declaration before submitting.' })
    setIsSubmitting(true)
    try {
      const application = await submitLoanApplication({
        userId: user.uid, userName: fullName, userMobile: `+91${mobile}`, userEmail: email,
        serviceId, serviceName: selectedService.title, lenderId, lenderName: selectedLender.name,
        loanAmount, tenureMonths, interestRate: 12, calculatedEmi, purpose, existingEmi,
        fullName, dob, gender, panNumber: panNumber.toUpperCase(), currentAddress: address,
        pincode, city, state, employmentType, employerName, designation, workExperienceYears,
        monthlyIncome, salaryPaymentMode, salaryCreditBank, documents, documentDraftId,
        status: 'submitted',
      })
      showToast({ type: 'success', title: 'Application submitted', message: `Reference ${application.referenceNumber} has been saved.` })
      window.location.assign(`/customer/applications/${application.id}`)
    } catch (error) {
      showToast({ type: 'error', title: 'Could not submit application', message: error instanceof Error ? error.message : 'Please check your details and try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const stepsList = [
    { num: 1, title: 'Personal Info', icon: User },
    { num: 2, title: 'Employment', icon: Briefcase },
    { num: 3, title: 'Loan & Lender', icon: Wallet },
    { num: 4, title: 'Documents', icon: FileCheck2 },
    { num: 5, title: 'Review & Submit', icon: CheckCircle }
  ]

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* STEP PROGRESS BAR */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 -translate-y-1/2 z-0" />
          <div
            className="absolute top-1/2 left-0 h-1 bg-blue-600 -translate-y-1/2 z-0 transition-all duration-300"
            style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
          />

          {stepsList.map((s) => {
            const Icon = s.icon
            const isDone = currentStep > s.num
            const isCurrent = currentStep === s.num
            return (
              <div key={s.num} className="relative z-10 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (isDone) setCurrentStep(s.num)
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isDone
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : isCurrent
                      ? 'bg-blue-700 text-white ring-4 ring-blue-200 shadow-md'
                      : 'bg-white border-2 border-slate-300 text-slate-400'
                  }`}
                >
                  {isDone ? <Check size={16} /> : <Icon size={16} />}
                </button>
                <span
                  className={`mt-2 text-[11px] font-semibold hidden sm:block ${
                    isCurrent ? 'text-blue-700' : isDone ? 'text-slate-800' : 'text-slate-400'
                  }`}
                >
                  {s.title}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* FORM CARD */}
      <div className="rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-10 shadow-xl shadow-slate-100">
        <AnimatePresence mode="wait">
          {/* ================= STEP 1: PERSONAL INFORMATION ================= */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-bold text-slate-900">Step 1: Personal Information</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your official details exactly as they appear on your Government PAN card.
                </p>
              </div>
              {profileMissing !== null && (
                <div className={`rounded-2xl border p-4 text-xs ${profileMissing.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-100 bg-blue-50 text-blue-900'}`}>
                  {profileMissing.length ? (
                    <p>
                      Your profile is missing: <strong>{profileMissing.join(', ')}</strong>.{' '}
                      <Link to="/customer/profile" className="font-semibold underline">Complete My Profile</Link> once and these details will fill in here automatically.
                    </p>
                  ) : (
                    <p>
                      Details below were filled in from your profile.{' '}
                      <Link to="/customer/profile" className="font-semibold underline">Edit in My Profile</Link>
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Full Legal Name (As per PAN) *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                      errors.fullName
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
                    }`}
                  />
                  {errors.fullName && <p className="text-xs text-rose-600 mt-1">{errors.fullName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Gender *
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    PAN Card Number *
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm uppercase font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 ${
                      errors.panNumber
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
                    }`}
                  />
                  {errors.panNumber && <p className="text-xs text-rose-600 mt-1">{errors.panNumber}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Registered Mobile Number *
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 text-xs font-semibold text-slate-600">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                      placeholder="10-digit number"
                      className={`w-full rounded-r-xl border px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 ${
                        errors.mobile
                          ? 'border-rose-400 focus:ring-rose-200'
                          : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
                      }`}
                    />
                  </div>
                  {errors.mobile && <p className="text-xs text-rose-600 mt-1">{errors.mobile}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Current Residential Address *
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House/Flat No, Street, Landmark"
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                    errors.address
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
                  }`}
                />
                {errors.address && <p className="text-xs text-rose-600 mt-1">{errors.address}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    PIN Code *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6 Digits"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 ${
                      errors.pincode
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
                    }`}
                  />
                  {errors.pincode && <p className="text-xs text-rose-600 mt-1">{errors.pincode}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    City *
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                      errors.city
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
                    }`}
                  />
                  {errors.city && <p className="text-xs text-rose-600 mt-1">{errors.city}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    State *
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Karnataka"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                      errors.state
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
                    }`}
                  />
                  {errors.state && <p className="text-xs text-rose-600 mt-1">{errors.state}</p>}
                </div>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 2: EMPLOYMENT INFORMATION ================= */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-bold text-slate-900">Step 2: Employment & Income Details</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Specify how your salary or income is disbursed. Document requirements dynamically adapt to this selection.
                </p>
              </div>

              {/* Salary Mode Selector (Bank Salary vs Cash Salary) */}
              <div className="rounded-2xl bg-blue-50/70 border border-blue-200 p-5">
                <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
                  Salary Disbursement Mode *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSalaryPaymentMode('bank_transfer')
                      setEmploymentType('salaried_bank')
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      salaryPaymentMode === 'bank_transfer'
                        ? 'border-blue-600 bg-white shadow-md text-blue-950 font-bold'
                        : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
                    }`}
                  >
                    <span className="block text-sm font-semibold">Bank Transfer / NEFT</span>
                    <span className="text-[11px] text-slate-500">Salary credited directly to bank account</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSalaryPaymentMode('cash')
                      setEmploymentType('salaried_cash')
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      salaryPaymentMode === 'cash'
                        ? 'border-amber-600 bg-white shadow-md text-amber-950 font-bold ring-2 ring-amber-200'
                        : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-amber-900">Cash in Hand</span>
                    <span className="text-[11px] text-slate-500">Salary received in physical cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSalaryPaymentMode('cheque')
                      setEmploymentType('salaried_bank')
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      salaryPaymentMode === 'cheque'
                        ? 'border-blue-600 bg-white shadow-md text-blue-950 font-bold'
                        : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
                    }`}
                  >
                    <span className="block text-sm font-semibold">Company Cheque</span>
                    <span className="text-[11px] text-slate-500">Deposited periodically into bank</span>
                  </button>
                </div>

                {salaryPaymentMode === 'cash' && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-amber-800 bg-amber-100/70 p-3 rounded-xl border border-amber-300">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Cash Salary Notice:</span> Acceptance and documentation vary by lender and product. Confirm requirements with the lender. Askus Fin cannot guarantee approval.
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Employment Category *
                  </label>
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="salaried_bank">Private Corporate / IT / MNC</option>
                    <option value="government">Central / State Government</option>
                    <option value="psu">PSU / Public Sector</option>
                    <option value="salaried_cash">Cash-Paid Salaried / Informal Sector</option>
                    <option value="contract">Contract / Agency Payroll</option>
                    <option value="self_employed">Self-Employed / Business Owner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Employer / Company Name *
                  </label>
                  <input
                    type="text"
                    value={employerName}
                    onChange={(e) => setEmployerName(e.target.value)}
                    placeholder="e.g. Tata Consultancy Services"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                      errors.employerName
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
                    }`}
                  />
                  {errors.employerName && <p className="text-xs text-rose-600 mt-1">{errors.employerName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Job Designation *
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Assistant Project Manager"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                      errors.designation
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
                    }`}
                  />
                  {errors.designation && <p className="text-xs text-rose-600 mt-1">{errors.designation}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Total Work Experience (Years) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={45}
                    value={workExperienceYears}
                    onChange={(e) => setWorkExperienceYears(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Net Monthly In-Hand Income (₹) *
                  </label>
                  <input
                    type="number"
                    min={5000}
                    step={1000}
                    value={monthlyIncome || ''}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(e) => setMonthlyIncome(Number(e.target.value) || 0)}
                    placeholder="e.g. 50000"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 ${
                      errors.monthlyIncome
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
                    }`}
                  />
                  {errors.monthlyIncome && <p className="text-xs text-rose-600 mt-1">{errors.monthlyIncome}</p>}
                </div>

                {salaryPaymentMode === 'bank_transfer' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Salary Account Bank Name
                    </label>
                    <input
                      type="text"
                      value={salaryCreditBank}
                      onChange={(e) => setSalaryCreditBank(e.target.value)}
                      placeholder="e.g. HDFC Bank / SBI / ICICI"
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ================= STEP 3: LOAN & LENDER SELECTION ================= */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-bold text-slate-900">Step 3: Loan Configuration & Preferred Lender</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Compare partner lenders from the Company-Wise Guide and customize your loan parameters.
                </p>
              </div>

              {/* Service Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Select Loan Category *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {FINANCIAL_SERVICES.filter((s) => s.isDirectApplication).map((srv) => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setServiceId(srv.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        serviceId === srv.id
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="block text-xs font-semibold truncate">{srv.title}</span>
                      <span className="text-[10px] text-blue-600 font-medium">Rates set by lender</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lender selection list (10 lenders from Guide) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Select Preferred Banking Partner *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                  {LENDERS.map((bank) => {
                    const isSelected = lenderId === bank.id
                    return (
                      <button
                        key={bank.id}
                        type="button"
                        onClick={() => setLenderId(bank.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/80 shadow-md ring-2 ring-blue-200'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-slate-900">{bank.name}</span>
                          <span className="text-[10px] font-bold text-blue-700">Official details</span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{bank.tagline}</p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                          <span>Terms set by lender</span>
                          <span className="font-semibold text-slate-600">See official site</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Amount, Tenure, Existing EMIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Requested Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min={10000}
                    step={10000}
                    value={loanAmount || ''}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(e) => setLoanAmount(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Limits are determined by the lender.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tenure (Months) *
                  </label>
                  <select
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value={12}>12 Months (1 Year)</option>
                    <option value={24}>24 Months (2 Years)</option>
                    <option value={36}>36 Months (3 Years)</option>
                    <option value={48}>48 Months (4 Years)</option>
                    <option value={60}>60 Months (5 Years)</option>
                    {selectedService.id === 'home-loan' && (
                      <>
                        <option value={120}>120 Months (10 Years)</option>
                        <option value={240}>240 Months (20 Years)</option>
                        <option value={360}>360 Months (30 Years)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Existing Monthly EMIs (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={existingEmi || ''}
                    onChange={(e) => setExistingEmi(Number(e.target.value) || 0)}
                    placeholder="0 if none"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Purpose of Loan
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Wedding, Medical Emergency, Business Working Capital"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Indicative EMI Banner */}
              <div className="rounded-2xl bg-slate-900 text-white p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Illustrative EMI estimate (12% example rate)
                  </span>
                  <div className="text-2xl font-extrabold text-blue-400 mt-1">
                    {formatINR(calculatedEmi)} <span className="text-xs font-normal text-slate-300">/ month</span>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>Not a lender offer or eligibility decision.</p>
                  <p>Actual rates and fees are set by the lender.</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 4: DYNAMIC DOCUMENT CHECKLIST & UPLOADS ================= */}
          {currentStep === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-bold text-slate-900">Step 4: Required Documents</h3>
                <p className="text-xs text-amber-800 mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3" role="status">
                  {['personal-loan', 'instant-personal-loan'].includes(serviceId)
                    ? 'Checklist references are based on the supplied personal-loan guide and may change. Confirm the current requirements with the lender.'
                    : 'This company-wise document guide covers personal loans only. Confirm the current requirements for this product with the lender.'} Files are stored privately and application details are saved securely in the AskUs database.
                </p>
              </div>

              {/* Dynamic notice about company policy */}
              <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-blue-900 uppercase">
                    Checklist for {selectedLender.name}:
                  </span>
                  <span className="rounded-full bg-blue-200/80 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                    {salaryPaymentMode === 'cash' ? 'Cash Salary Profile' : 'Bank Salary Profile'}
                  </span>
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">
                  {salaryPaymentMode === 'cash'
                    ? 'Cash salary is not accepted by every lender. Ask the lender which genuine alternative income proofs it will accept before applying.'
                    : 'This is a reference checklist, not a lender decision. The lender may request additional or different documents.'}
                </p>
              </div>

              {/* Document upload items */}
              <p className="text-[11px] text-slate-500">Accepted formats: PDF, JPG, PNG. Maximum 5 MB per file. Uploaded file names and storage IDs are recorded with the application; the browser does not store file contents.</p>
              <div className="space-y-4">
                {documents.map((doc) => {
                  const hasFile = Boolean(doc.storageKey || doc.fileUrl)
                  const isUploading = uploadingDocId === doc.id
                  return (
                    <div
                      key={doc.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        hasFile
                          ? 'border-emerald-300 bg-emerald-50/40'
                          : doc.required
                          ? 'border-slate-300 bg-white hover:border-slate-400'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{doc.title}</span>
                            {doc.required ? (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                Required
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                Optional
                              </span>
                            )}
                          </div>
                          {doc.description && (
                            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                              {doc.description}
                            </p>
                          )}
                          {hasFile && doc.fileName && (
                            <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 pt-1">
                              <CheckCircle size={14} className="text-emerald-600" />
                              <span>{doc.fileName}</span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          {hasFile ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveDoc(doc.id)}
                              className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <Trash2 size={14} />
                              <span>Remove</span>
                            </button>
                          ) : (
                            <label className="cursor-pointer rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5">
                              <Upload size={14} />
                              <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) handleFileUpload(doc.id, f)
                                  e.currentTarget.value = ''
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* ================= STEP 5: REVIEW & FINAL SUBMISSION ================= */}
          {currentStep === 5 && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-bold text-slate-900">Step 5: Review & Submit Application</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Verify your details before submitting to Askus Fin credit advisory network.
                </p>
              </div>

              {/* Review Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                {/* 1. Personal */}
                <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 uppercase">Applicant Details</span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="space-y-1 text-slate-600">
                    <p><strong className="text-slate-800">Name:</strong> {fullName}</p>
                    <p><strong className="text-slate-800">Mobile:</strong> +91 {mobile}</p>
                    <p><strong className="text-slate-800">PAN:</strong> {panNumber}</p>
                    <p><strong className="text-slate-800">Location:</strong> {city}, {state} - {pincode}</p>
                  </div>
                </div>

                {/* 2. Employment */}
                <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 uppercase">Employment Profile</span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="space-y-1 text-slate-600">
                    <p><strong className="text-slate-800">Company:</strong> {employerName}</p>
                    <p><strong className="text-slate-800">Designation:</strong> {designation}</p>
                    <p><strong className="text-slate-800">Monthly Income:</strong> {formatINR(monthlyIncome)}</p>
                    <p><strong className="text-slate-800">Salary Mode:</strong> {salaryPaymentMode === 'cash' ? 'Cash in Hand' : 'Bank Transfer'}</p>
                  </div>
                </div>

                {/* 3. Loan Configuration */}
                <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 uppercase">Loan & Lender Choice</span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="space-y-1 text-slate-600">
                    <p><strong className="text-slate-800">Lender:</strong> {selectedLender.name}</p>
                    <p><strong className="text-slate-800">Loan Amount:</strong> {formatINR(loanAmount)}</p>
                    <p><strong className="text-slate-800">Tenure:</strong> {tenureMonths} Months ({tenureMonths / 12} Yrs)</p>
                    <p><strong className="text-slate-800">Indicative EMI:</strong> {formatINR(calculatedEmi)} / mo</p>
                  </div>
                </div>

                {/* 4. Documents Uploaded */}
                <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 uppercase">Documents Attached</span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="space-y-1 text-slate-600">
                    {documents.filter((d) => d.storageKey || d.fileUrl).map((d) => (
                      <p key={d.id} className="text-emerald-700 flex items-center gap-1">
                        <Check size={12} className="text-emerald-600" />
                        <span>{d.title}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Consent & Declarations */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="consent-check"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="consent-check" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
                    <strong className="text-slate-900">Declaration & Consent:</strong> I confirm that the information provided is accurate and consent to its storage in Askus Fin to manage this application. This form does not request a credit bureau report or automatically send my information to a lender. Any lender sharing or credit check requires separate explanation and consent. Loan decisions are made by the lender.
                  </label>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTTOM NAVIGATION BUTTONS */}
        <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="rounded-xl border border-slate-300 hover:bg-slate-100 px-5 py-2.5 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition"
              >
                <ArrowLeft size={14} />
                <span>Previous Step</span>
              </button>
            )}

            <button
              type="button"
              onClick={saveDraft}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-2 transition"
            >
              Save as Draft
            </button>
          </div>

          <div className="w-full sm:w-auto">
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={nextStep}
                className="w-full sm:w-auto rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-7 py-3 text-xs font-bold uppercase tracking-wider shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition active:scale-98"
              >
                <span>Continue to Step {currentStep + 1}</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting || !consentGiven}
                onClick={handleFinalSubmit}
                className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-xs font-bold uppercase tracking-wider shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-60"
              >
                <ShieldCheck size={16} />
                <span>{isSubmitting ? 'Submitting…' : 'Submit Application'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
