// FICTIONAL demonstration data for the loan-quotes page.
// None of these rates, limits, EMIs or approval levels are real lender offers.
// Lender names and logos are shown only to reproduce the reference layout.

export type ApprovalLevel = 1 | 2 | 3 | 4 | 5

export const APPROVAL_LABELS: Record<ApprovalLevel, string> = {
  1: 'Very Low',
  2: 'Low',
  3: 'Moderate',
  4: 'High',
  5: 'Very High',
}

// Segment colours, low -> high (as captured from the reference meter).
export const APPROVAL_COLORS = ['rgb(227, 28, 28)', 'rgb(255, 153, 0)', 'rgb(255, 191, 0)', 'rgb(80, 193, 110)', 'rgb(29, 142, 59)']

export interface QuoteLender {
  id: string
  name: string
  logo: string // PNG id under /assets/images/lenders
  /** Maximum amount in rupees (demo). */
  maxAmount: number
  /** Demo annual rate, percent. */
  roi: number
  approval: ApprovalLevel
  /** Demo disbursal time in hours. */
  disbursalHours: number
  /** Offers an instant, paperless journey for smaller loans. */
  instant: boolean
  /** Matches an id in src/constants/banks.ts for the /apply hand-off, if any. */
  applyLenderId?: string
}

export const formatLimit = (n: number): string =>
  n >= 10000000 ? `Upto ₹${+(n / 10000000).toFixed(2)} Crore${n >= 20000000 ? 's' : ''}` : `Upto ₹${+(n / 100000).toFixed(2)} Lakhs`

const L = (
  id: string, name: string, logo: string, maxAmount: number, roi: number, approval: ApprovalLevel,
  disbursalHours: number, instant: boolean, applyLenderId?: string,
): QuoteLender => ({ id, name, logo, maxAmount, roi, approval, disbursalHours, instant, applyLenderId })

/** Demo lenders (first group). */
const PRIMARY: QuoteLender[] = [
  L('hdfc', 'HDFC Bank', '2', 5000000, 10.4, 5, 48, false, 'hdfc-bank'),
  L('icici', 'ICICI Bank', '6', 20000000, 10.6, 5, 72, false, 'icici-bank'),
  L('bajaj', 'Bajaj Finance', '61', 7500000, 10.2, 4, 24, true, 'bajaj-finance'),
  L('kotak', 'Kotak Bank', '17', 5000000, 10.1, 4, 48, false, 'kotak-mahindra-bank'),
  L('indusind', 'IndusInd Bank', '67', 5000000, 10.7, 3, 72, false, 'indusind-bank'),
  L('abcl', 'Aditya Birla Capital Limited', '237', 3000000, 17.5, 3, 24, true),
]

/** Demo lenders (second group). */
const SECONDARY: QuoteLender[] = [
  L('yes', 'YES BANK', '65', 5000000, 10.8, 4, 48, false),
  L('lt', 'L&T Finance', '446', 3000000, 10.9, 3, 24, true),
  L('poonawalla', 'Poonawalla Fincorp', '438', 2000000, 12.2, 3, 12, true),
  L('piramal', 'Piramal Finance', '376', 2500000, 13.1, 3, 24, true),
  L('chola', 'Cholamandalam', '233', 5000000, 16.8, 3, 36, true),
  L('axis', 'Axis Bank', '27', 4000000, 10.3, 3, 72, false, 'axis-bank'),
  L('idfc', 'IDFC FIRST Bank', '247', 10000000, 10.2, 3, 48, false),
  L('tata', 'Tata Capital', '71', 3500000, 11.2, 3, 24, true, 'tata-capital'),
]

/** Lenders that are always listed as not eligible in the demo. */
export const ALWAYS_UNMATCHED: { name: string; logo: string }[] = [
  { name: 'Muthoot Finance', logo: '93' },
  { name: 'SMFG India Credit', logo: '162' },
  { name: 'HDB Financial Services', logo: '231' },
  { name: 'DBS', logo: '243' },
  { name: 'Fibe', logo: '257' },
  { name: 'DMI Finance', logo: '260' },
  { name: 'InCred', logo: '264' },
  { name: 'Moneyview', logo: '336' },
  { name: 'KreditBee', logo: '339' },
  { name: 'Prefr', logo: '405' },
  { name: 'Federal', logo: '443' },
  { name: 'Credit Saison', logo: '457' },
  { name: 'FINNABLE', logo: '473' },
  { name: 'OLYV', logo: '476' },
  { name: 'Shriram Finance', logo: '660' },
  { name: 'ClickPe', logo: '711' },
  { name: 'Flex Salary', logo: '719' },
  { name: 'Lending Plate', logo: '720' },
]

/** SVG logos for the scrolling "top lenders" strip. */
export const STRIP_LOGOS = ['2', '17', '233', '65', '67', '376', '71', '438', '446', '237', '339', '474', '254']

export const TESTIMONIALS = [
  { quote: 'A clear comparison made the decision simple', name: 'Sample customer A', city: 'Chennai', tone: 'from-[#0b3d91] to-[#0066ff]' },
  { quote: 'From checking options to a finished application', name: 'Sample customer B', city: 'Pune', tone: 'from-[#065f46] to-[#10b981]' },
  { quote: 'Planning the EMI first helped me borrow less', name: 'Sample customer C', city: 'Jaipur', tone: 'from-[#6b21a8] to-[#a855f7]' },
]

export type SortKey = 'approval' | 'disbursal' | 'emi' | 'roi'

export const SORT_OPTIONS: { key: SortKey; title: string; sub: string }[] = [
  { key: 'approval', title: 'Approval Chances', sub: 'High to Low' },
  { key: 'disbursal', title: 'Disbursal Time', sub: 'Low to High' },
  { key: 'emi', title: 'EMI', sub: 'Low to High' },
  { key: 'roi', title: 'ROI', sub: 'Low to High' },
]

/** Every demo lender the quotes page can show. Rates, limits and base approval are sample values. */
export const ALL_LENDERS: QuoteLender[] = [...PRIMARY, ...SECONDARY]

export const findLender = (id: string): QuoteLender | undefined => ALL_LENDERS.find((l) => l.id === id)
