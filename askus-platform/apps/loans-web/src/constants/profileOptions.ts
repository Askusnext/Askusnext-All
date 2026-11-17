// Option lists shared by the profile page and the loan "Let's Get to Know You" step.
// Options offered to the customer; the API stores them as plain text.

export interface Option {
  value: string
  label: string
}

export const GENDERS: Option[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

export const MARITAL_STATUSES: Option[] = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
]

export const QUALIFICATIONS: Option[] = [
  { value: 'under_graduate', label: 'Under-Graduate' },
  { value: 'graduate', label: 'Graduate' },
  { value: 'post_graduate', label: 'Post-Graduate' },
  { value: 'professional', label: 'Professional / Doctorate' },
  { value: 'other', label: 'Other' },
]

export const LOAN_PURPOSES: Option[] = [
  'Medical expenses', 'Wedding', 'Travel', 'Home renovation', 'Education', 'Debt consolidation', 'Business needs', 'Other',
].map((p) => ({ value: p, label: p }))

export const optionLabel = (list: Option[], value: string): string => list.find((o) => o.value === value)?.label ?? ''

export const SALARY_BANKS: string[] = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'IndusInd Bank',
  'Yes Bank', 'IDFC FIRST Bank', 'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'Union Bank of India',
  'Bank of India', 'Indian Bank', 'Central Bank of India', 'Indian Overseas Bank', 'UCO Bank', 'Federal Bank',
  'South Indian Bank', 'Karur Vysya Bank', 'RBL Bank', 'Bandhan Bank', 'HSBC India', 'Standard Chartered Bank',
  'Citibank', 'DBS Bank India', 'AU Small Finance Bank', 'Other bank',
]
