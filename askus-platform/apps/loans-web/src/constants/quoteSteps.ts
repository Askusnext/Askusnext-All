import type { QuoteStep } from '../services/api/loansApi'

/** The customer journey in order. `index` is how far along an application is (1 = just started). */
export const QUOTE_STEP_ORDER: { step: QuoteStep; label: string; short: string }[] = [
  { step: 'know_you', label: 'Started: personal details', short: 'Started' },
  { step: 'details_confirmed', label: 'Personal details done', short: 'Details' },
  { step: 'personal_details', label: 'Address and bank done', short: 'Address & bank' },
  { step: 'documents', label: 'Uploading documents', short: 'Documents' },
  { step: 'documents_uploaded', label: 'Documents done, in review', short: 'Review' },
  { step: 'submitted', label: 'Submitted with consent', short: 'Submitted' },
]

export const stepIndex = (step: QuoteStep): number => QUOTE_STEP_ORDER.findIndex((s) => s.step === step) + 1

export const stepLabel = (step: QuoteStep): string => QUOTE_STEP_ORDER.find((s) => s.step === step)?.label ?? step
