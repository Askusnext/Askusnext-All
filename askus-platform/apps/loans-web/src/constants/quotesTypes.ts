// Per-loan-type configuration for the quotes page. All figures are demo values.

export interface QuoteTab {
  id: string
  title: string
  sub: string
  min: number
  max: number
  step: number
  defaultAmount: number
  presets: number[]
  /** Only lenders with an instant, paperless journey match this tab. */
  requireInstant: boolean
}

export interface QuoteType {
  id: string
  /** Used in "N Personalised <label> offers For You". */
  label: string
  tabs: [QuoteTab, QuoteTab]
  tenure: { min: number; max: number; step: number; defaultMonths: number; presets: number[] }
  /** Scales each lender's demo maximum amount. */
  limitScale: number
  /** Added to each lender's demo rate (percentage points). */
  roiDelta: number
  rateNote: string
  whyTitle: string
}

const L = 100000
const CR = 10000000

export const QUOTE_TYPES: Record<string, QuoteType> = {
  'personal-loan': {
    id: 'personal-loan',
    label: 'Loan',
    tabs: [
      { id: 'small', title: 'Loan < ₹5 Lacs', sub: 'Instant Paperless Process', min: 50000, max: 499000, step: 1000, defaultAmount: 3 * L, presets: [1 * L, 2 * L, 3 * L, 4 * L], requireInstant: true },
      { id: 'large', title: 'Loan ₹5 Lacs+', sub: 'Income Documents Needed', min: 5 * L, max: CR, step: 50000, defaultAmount: 10 * L, presets: [5 * L, 10 * L, 20 * L, 50 * L], requireInstant: false },
    ],
    tenure: { min: 12, max: 84, step: 6, defaultMonths: 60, presets: [12, 24, 36, 48, 60, 72, 84] },
    limitScale: 1,
    roiDelta: 0,
    rateNote: 'Many personal loans come with a fixed rate for the full tenure',
    whyTitle: 'A clearer way to choose your personal loan',
  },
  'home-loan': {
    id: 'home-loan',
    label: 'Home Loan',
    tabs: [
      { id: 'small', title: 'Loan < ₹50 Lacs', sub: 'Standard Documentation', min: 5 * L, max: 49 * L, step: 50000, defaultAmount: 30 * L, presets: [10 * L, 20 * L, 30 * L, 40 * L], requireInstant: false },
      { id: 'large', title: 'Loan ₹50 Lacs+', sub: 'Higher Value Property', min: 50 * L, max: 5 * CR, step: 100000, defaultAmount: 75 * L, presets: [50 * L, 75 * L, 1 * CR, 2 * CR], requireInstant: false },
    ],
    tenure: { min: 60, max: 360, step: 12, defaultMonths: 240, presets: [60, 120, 180, 240, 300, 360] },
    limitScale: 4,
    roiDelta: -1.9,
    rateNote: 'Home loan rates are often floating and can change over the tenure',
    whyTitle: 'A clearer way to choose your home loan',
  },
  'business-loan': {
    id: 'business-loan',
    label: 'Business Loan',
    tabs: [
      { id: 'small', title: 'Loan < ₹10 Lacs', sub: 'Quick Digital Process', min: 1 * L, max: 9 * L, step: 25000, defaultAmount: 5 * L, presets: [2 * L, 5 * L, 7 * L, 9 * L], requireInstant: true },
      { id: 'large', title: 'Loan ₹10 Lacs+', sub: 'Financials Needed', min: 10 * L, max: 2 * CR, step: 100000, defaultAmount: 25 * L, presets: [10 * L, 25 * L, 50 * L, 1 * CR], requireInstant: false },
    ],
    tenure: { min: 12, max: 84, step: 6, defaultMonths: 36, presets: [12, 24, 36, 48, 60, 84] },
    limitScale: 1.5,
    roiDelta: 2.2,
    rateNote: 'Business loan rates depend on turnover, vintage and the lender',
    whyTitle: 'A clearer way to choose your business loan',
  },
  'loan-against-property': {
    id: 'loan-against-property',
    label: 'Loan Against Property',
    tabs: [
      { id: 'small', title: 'Loan < ₹50 Lacs', sub: 'Faster Processing', min: 5 * L, max: 49 * L, step: 50000, defaultAmount: 25 * L, presets: [10 * L, 20 * L, 30 * L, 40 * L], requireInstant: false },
      { id: 'large', title: 'Loan ₹50 Lacs+', sub: 'Property Valuation Needed', min: 50 * L, max: 5 * CR, step: 100000, defaultAmount: 1 * CR, presets: [50 * L, 1 * CR, 2 * CR, 3 * CR], requireInstant: false },
    ],
    tenure: { min: 36, max: 240, step: 12, defaultMonths: 120, presets: [36, 60, 120, 180, 240] },
    limitScale: 3,
    roiDelta: -0.4,
    rateNote: 'Your property stays mortgaged until the loan is fully repaid',
    whyTitle: 'A clearer way to choose a loan against property',
  },
  'consumer-durable-loan': {
    id: 'consumer-durable-loan',
    label: 'Consumer Durable Loan',
    tabs: [
      { id: 'small', title: 'Loan < ₹50,000', sub: 'Instant Paperless Process', min: 10000, max: 49000, step: 1000, defaultAmount: 30000, presets: [10000, 20000, 30000, 49000], requireInstant: true },
      { id: 'large', title: 'Loan ₹50,000+', sub: 'Basic Documents Needed', min: 50000, max: 5 * L, step: 5000, defaultAmount: 1 * L, presets: [50000, 1 * L, 2 * L, 5 * L], requireInstant: false },
    ],
    tenure: { min: 3, max: 36, step: 3, defaultMonths: 12, presets: [3, 6, 12, 18, 24, 36] },
    limitScale: 0.1,
    roiDelta: 3.5,
    rateNote: 'Some lenders offer no-cost EMI on selected products; confirm before you buy',
    whyTitle: 'A clearer way to finance your purchase',
  },
}

export const QUOTE_TYPE_NAMES: Record<string, string> = {
  'personal-loan': 'Personal Loan',
  'home-loan': 'Home Loan',
  'business-loan': 'Business Loan',
  'loan-against-property': 'Loan Against Property',
  'consumer-durable-loan': 'Consumer Durable Loan',
}

/** Resolve a ?type= value (also accepts the instant-personal alias). */
export const resolveQuoteType = (param: string | null): { type: QuoteType; tabIndex: 0 | 1 } => {
  if (param === 'instant-personal-loan') return { type: QUOTE_TYPES['personal-loan'], tabIndex: 0 }
  return { type: QUOTE_TYPES[param ?? ''] ?? QUOTE_TYPES['personal-loan'], tabIndex: 1 }
}

/** Version of the consent text customers agree to when submitting an application. */
export const CONSENT_VERSION = 'v1-2026-11'
