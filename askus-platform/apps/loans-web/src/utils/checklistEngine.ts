import type { ApplicationDocument, DocumentType, EmploymentType, SalaryPaymentMode } from '../types'

export interface ChecklistRuleContext {
  serviceId?: string
  lenderId: string
  employmentType: EmploymentType
  salaryPaymentMode: SalaryPaymentMode
  loanAmount: number
}

type Requirement = { type: DocumentType; title: string; description: string; required: boolean }

const base: Requirement[] = [
  { type: 'pan_card', title: 'PAN card', description: 'Clear copy showing the complete PAN.', required: true },
  { type: 'aadhaar_card', title: 'Identity proof (Aadhaar or accepted ID)', description: 'Upload an identity document accepted by the lender.', required: true },
  { type: 'address_proof', title: 'Current address proof', description: 'Upload a separate address proof if your identity document does not show your current address.', required: false },
]

const bankSalary: Record<string, Requirement[]> = {
  'hdfc-bank': [
    { type: 'salary_slips', title: 'Latest 2 salary slips', description: 'Pre-approved journeys may request less. Confirm the lender’s current checklist.', required: true },
    { type: 'bank_statement', title: 'Latest 3 months bank statements', description: 'Show salary credits for a non-pre-approved application.', required: true },
  ],
  'icici-bank': [
    { type: 'salary_slips', title: 'Latest salary slip', description: 'The lender may ask for additional months.', required: true },
    { type: 'bank_statement', title: 'Latest 3 months bank statements', description: 'Should show salary or income credits.', required: true },
  ],
  'axis-bank': [
    { type: 'salary_slips', title: 'Latest 2 months salary slips', description: 'Some digital journeys may ask for 3 months.', required: true },
    { type: 'bank_statement', title: 'Latest 2 months bank statements', description: 'Some digital journeys may ask for 3 months.', required: true },
  ],
  'kotak-mahindra-bank': [
    { type: 'salary_slips', title: 'Latest 3 salary slips', description: 'Confirm the applicable customer and location checklist.', required: true },
    { type: 'bank_statement', title: 'Latest 3 months bank statements', description: 'Confirm the applicable customer and location checklist.', required: true },
    { type: 'photograph', title: 'Passport-size photograph', description: 'Use a recent photograph if requested in the lender journey.', required: false },
  ],
  'bajaj-finance': [
    { type: 'salary_slips', title: 'Latest 3 salary slips', description: 'Salaried profile reference checklist.', required: true },
    { type: 'bank_statement', title: 'Latest 3 months bank statements', description: 'Salaried profile reference checklist.', required: true },
    { type: 'employee_id', title: 'Employee ID or employment proof', description: 'Upload if requested by the lender.', required: false },
    { type: 'photograph', title: 'Photograph', description: 'Upload if requested by the lender.', required: false },
  ],
  'tata-capital': [
    { type: 'salary_slips', title: 'Latest 3 salary slips', description: 'Reference checklist.', required: true },
    { type: 'bank_statement', title: 'Latest 3 months salary-credit statements', description: 'Reference checklist.', required: true },
    { type: 'appointment_letter', title: 'Employment proof or appointment letter', description: 'Upload if requested by the lender.', required: false },
  ],
  'indusind-bank': [
    { type: 'photograph', title: 'Recent photograph', description: 'Reference checklist.', required: true },
    { type: 'salary_slips', title: 'Latest 3 salary slips', description: 'Reference checklist.', required: true },
    { type: 'bank_statement', title: 'Latest 3 months salary-credit statements', description: 'Reference checklist.', required: true },
    { type: 'itr_form16', title: 'Form 16 or ITR', description: 'May be requested by the lender.', required: false },
  ],
  pnb: [
    { type: 'salary_certificate', title: 'Latest salary certificate', description: 'Reference checklist.', required: true },
    { type: 'itr_form16', title: 'ITR or Form 16 for the last 2 years', description: 'As applicable to the lender journey.', required: false },
    { type: 'bank_statement', title: 'Salary-account statement (up to 1 year)', description: 'Reference checklist; confirm the period with the lender.', required: true },
  ],
  'bank-of-baroda': [
    { type: 'photograph', title: 'Recent photographs', description: 'Reference checklist.', required: true },
    { type: 'salary_slips', title: 'Latest 3 salary slips', description: 'Reference checklist.', required: true },
    { type: 'bank_statement', title: 'Latest 6 months bank statements or passbook', description: 'Reference checklist.', required: true },
    { type: 'business_proof', title: 'Assets and liabilities details', description: 'Only if requested by the lender.', required: false },
  ],
  'hsbc-india': [
    { type: 'bank_statement', title: 'Bank statements', description: 'Confirm required period and documents directly with HSBC; eligibility is account and location dependent.', required: false },
  ],
}

const employmentProof: Requirement[] = [
  { type: 'employee_id', title: 'Employee ID or employment proof', description: 'Employee ID, appointment letter, or employer certificate, if requested.', required: false },
]

const cashSalary: Requirement[] = [
  { type: 'salary_certificate', title: 'Employer-issued salary certificate', description: 'Should state gross/net salary, pay frequency, role, and joining date. Confirm lender acceptance first.', required: false },
  { type: 'salary_vouchers', title: 'Genuine salary vouchers or wage-register extracts', description: 'Latest 3–6 months if legitimately maintained and accepted by the lender.', required: false },
  { type: 'bank_statement', title: 'Latest 6 months bank statements', description: 'Cash-paid applicants may still be asked for account activity. Confirm the requirement with the lender.', required: false },
  { type: 'appointment_letter', title: 'Appointment letter or employer confirmation', description: 'Include employer contact details when requested.', required: false },
  { type: 'itr_form16', title: 'ITR or Form 16', description: 'If available and requested by the lender.', required: false },
]

function unique(items: Requirement[]) {
  return [...new Map(items.map((item) => [item.type, item])).values()]
}

export function generateDocumentChecklist(context: ChecklistRuleContext): ApplicationDocument[] {
  const isPersonalLoan = !context.serviceId || ['personal-loan', 'instant-personal-loan'].includes(context.serviceId)
  const lenderItems = isPersonalLoan ? bankSalary[context.lenderId] || [] : []
  const isCash = context.salaryPaymentMode === 'cash' || context.employmentType === 'salaried_cash' || context.employmentType === 'daily_wage'
  const items = unique([
    ...base,
    ...(isPersonalLoan && isCash ? cashSalary : lenderItems),
    ...((!isPersonalLoan || !isCash) && ['government', 'psu', 'contract', 'self_employed'].includes(context.employmentType) ? employmentProof : []),
  ])

  return items.map((item) => ({
    id: item.type,
    type: item.type,
    title: item.title,
    description: item.description,
    required: item.required,
    status: 'pending',
  }))
}
