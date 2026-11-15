export type UserRole = 'customer' | 'admin'

export interface UserProfile {
  uid: string
  mobileNumber: string
  isMobileVerified: boolean
  email?: string
  displayName?: string
  role: UserRole
  createdAt: string
  updatedAt: string
  googleLinked?: boolean
  whatsappLinked?: boolean
  panNumber?: string
  dateOfBirth?: string
  address?: string
  pinCode?: string
  employmentType?: string
  employerName?: string
  monthlyIncome?: number
}



export type EmploymentType =
  | 'salaried_bank'
  | 'salaried_cash'
  | 'self_employed'
  | 'government'
  | 'psu'
  | 'contract'
  | 'daily_wage'

export type SalaryPaymentMode = 'bank_transfer' | 'cash' | 'cheque'

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'documents_required'
  | 'verification_pending'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'closed'

export type DocumentType =
  | 'pan_card'
  | 'aadhaar_card'
  | 'salary_slips'
  | 'bank_statement'
  | 'salary_certificate'
  | 'salary_vouchers'
  | 'appointment_letter'
  | 'employee_id'
  | 'itr_form16'
  | 'address_proof'
  | 'photograph'
  | 'business_proof'

export type DocumentStatus = 'pending' | 'verified' | 'rejected' | 'reupload_required'

export interface ApplicationDocument {
  id: string
  type: DocumentType
  title: string
  description?: string
  required: boolean
  status: DocumentStatus
  fileUrl?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  storageKey?: string
  fileId?: string
  fileFormat?: string
  storageKind?: 'raw'
  fileVersion?: number
  uploadedAt?: string
  rejectionReason?: string
  verifiedAt?: string
  adminNote?: string
}

export interface StatusHistoryEntry {
  status: ApplicationStatus
  timestamp: string
  note?: string
  updatedBy?: string
}

export interface LoanApplication {
  id: string
  referenceNumber: string
  userId: string
  userName: string
  userMobile: string
  userEmail?: string
  serviceId: string
  serviceName: string
  lenderId: string
  lenderName: string
  loanAmount: number
  tenureMonths: number
  interestRate: number
  calculatedEmi: number
  purpose: string
  existingEmi?: number
  // Step 1: Personal
  fullName: string
  dob: string
  gender: 'male' | 'female' | 'other'
  panNumber: string
  currentAddress: string
  pincode: string
  city: string
  state: string
  // Step 2: Employment
  employmentType: EmploymentType
  employerName: string
  designation: string
  workExperienceYears: number
  monthlyIncome: number
  salaryPaymentMode: SalaryPaymentMode
  salaryCreditBank?: string
  // Step 4: Documents
  documents: ApplicationDocument[]
  documentDraftId?: string
  // Status & Review
  status: ApplicationStatus
  statusHistory: StatusHistoryEntry[]
  adminNotes?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
}

export interface LenderInfo {
  id: string
  name: string
  code: string
  tagline: string
  minRate: number
  maxRate: number
  minAmount: number
  maxAmount: number
  maxTenureYears: number
  processingFee: string
  bankSalaryChecklist: string[]
  cashSalaryNote: string
  cashSalaryAccepted: 'Yes, with proof' | 'Case-by-case basis' | 'Not standard route' | 'Prior confirmation required'
  publicReferenceUrl: string
  turnaroundTime: string
  colorTheme: string
  lastVerifiedAt?: string
}

export interface FinancialService {
  id: string
  title: string
  shortDesc: string
  fullDesc: string
  badge: string
  badgeColor: string
  minRate?: number
  maxAmountText: string
  iconName: string
  route: string
  highlights: string[]
  eligibility: string[]
  disclaimer?: string
  isDirectApplication: boolean
}

export interface SupportTicket {
  id: string
  userId: string
  userName: string
  userMobile: string
  subject: string
  message: string
  category: string
  status: 'open' | 'in_progress' | 'resolved'
  createdAt: string
  reply?: string
}

export interface AuditLog {
  id: string
  adminId: string
  adminEmail?: string
  action: string
  applicationId?: string
  referenceNumber?: string
  details: string
  timestamp: string
}

export interface EmiCalculationResult {
  monthlyEmi: number
  principal: number
  totalInterest: number
  totalRepayment: number
  amortizationPreview: {
    year: number
    principalPaid: number
    interestPaid: number
    remainingBalance: number
  }[]
}
