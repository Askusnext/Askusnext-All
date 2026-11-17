// Documents every submitted application must contain, shared by the upload page,
// the review page and the resubmit check so they can never disagree.

export interface RequiredDoc {
  label: string
  /** Index of the step on the upload page where this document lives. */
  step: number
  ok: (docs: Record<string, unknown>) => boolean
}

export const REQUIRED_DOCUMENTS: RequiredDoc[] = [
  { label: '1st salary slip', step: 0, ok: (d) => Boolean(d.salary_slip_1) },
  { label: '2nd salary slip', step: 0, ok: (d) => Boolean(d.salary_slip_2) },
  { label: '3rd salary slip', step: 0, ok: (d) => Boolean(d.salary_slip_3) },
  { label: 'bank statement', step: 1, ok: (d) => Boolean(d.bank_statement) },
  { label: 'address proof (Aadhaar front and back, or one file with both sides)', step: 2, ok: (d) => Boolean(d.aadhaar_both) || Boolean(d.aadhaar_front && d.aadhaar_back) },
  { label: 'PAN card', step: 3, ok: (d) => Boolean(d.pan_card) },
]

export const missingRequired = (docs: Record<string, unknown>): RequiredDoc[] => REQUIRED_DOCUMENTS.filter((r) => !r.ok(docs))

export const DOCUMENT_LABELS: Record<string, string> = {
  salary_slip_1: 'Salary slip 1',
  salary_slip_2: 'Salary slip 2',
  salary_slip_3: 'Salary slip 3',
  bank_statement: 'Bank statement',
  aadhaar_front: 'Aadhaar front',
  aadhaar_back: 'Aadhaar back',
  aadhaar_both: 'Aadhaar (both sides)',
  pan_card: 'PAN card',
}
