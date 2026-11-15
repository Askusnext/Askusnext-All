export interface JobProfileInfo {
  category: string
  label: string
  documentsToPrepare: string[]
  notes: string
}

const lenderNotice = 'Eligibility and document requirements are set by the lender for each product and applicant. Check its official source before applying.'

export const JOB_PROFILES: JobProfileInfo[] = [
  { category: 'government', label: 'Central / State Government Employee', documentsToPrepare: ['Salary slip or salary certificate', 'Salary-account statement', 'Employee ID or service proof if requested', 'PAN and accepted identity/address proof'], notes: lenderNotice },
  { category: 'psu', label: 'PSU / Public Sector Enterprise', documentsToPrepare: ['Salary slips', 'Salary-account statement', 'Employee ID and employment proof', 'PAN and accepted identity/address proof'], notes: lenderNotice },
  { category: 'mnc_it', label: 'MNC / Listed Corporate / IT Company', documentsToPrepare: ['Salary slips', 'Bank statement showing salary credits', 'Employee ID or appointment letter', 'Form 16 if requested', 'PAN and accepted identity/address proof'], notes: lenderNotice },
  { category: 'private_ltd', label: 'Private Limited / Non-Listed Firm', documentsToPrepare: ['Salary slips', 'Bank statement', 'Employee ID or appointment letter', 'Employer verification', 'PAN and accepted identity/address proof'], notes: lenderNotice },
  { category: 'institutional', label: 'School / College / Hospital / Clinic Staff', documentsToPrepare: ['Salary slips or employer certificate', 'Bank statement', 'ID card and appointment/employment proof', 'PAN and accepted identity/address proof'], notes: lenderNotice },
  { category: 'contract', label: 'Contract / Temporary / Third-Party Payroll', documentsToPrepare: ['Contract or appointment letter', 'Employer certificate', 'Salary proof and bank statement', 'PAN and accepted identity/address proof'], notes: lenderNotice },
  { category: 'cash_salaried', label: 'Daily Wage / Cash-Paid Worker / Informal Salary', documentsToPrepare: ['Employer-confirmed work and income records', 'Genuine wage receipts/register if maintained', 'KYC and current address proof', 'Bank statement'], notes: 'Cash income is not accepted by every lender. Confirm acceptable proofs before applying; never create or alter income records.' },
]
