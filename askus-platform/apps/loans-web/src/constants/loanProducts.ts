// Loan product landing-page content.
//
// IMPORTANT: this file intentionally contains no lender-specific rates, fees or
// approval claims (see src/constants/banks.ts). `planning` values are slider
// ranges for the planning UI, and `illustrativeRate` is only the starting value
// of the editable EMI calculator. Rates, eligibility and approval are decided by
// the lender.

export interface LoanFaq {
  q: string
  a: string
}

export interface LoanProduct {
  slug: string
  title: string
  short: string
  icon: string
  tile?: string
  accent: string
  /** FINANCIAL_SERVICES id accepted by the existing /apply wizard, if any. */
  wizardServiceId?: string
  planning: {
    min: number
    max: number
    step: number
    defaultAmount: number
    minMonths: number
    maxMonths: number
    defaultMonths: number
  }
  illustrativeRate: number
  calculatorId: string
  overview: string[]
  categories: string[]
  highlights: { title: string; text: string }[]
  eligibility: string[]
  documents: string[]
  steps: { title: string; text: string }[]
  faqs: LoanFaq[]
}

const commonSteps = (product: string) => [
  { title: 'Plan', text: `Choose an indicative ${product} amount and tenure and review the estimated EMI.` },
  { title: 'Check readiness', text: 'Answer a few questions to see which requirements you should confirm with a lender.' },
  { title: 'Apply', text: 'Continue to the application workflow or to the lender’s official channel.' },
  { title: 'Track', text: 'Follow your application status. The lender makes the final credit decision.' },
]

const commonFaqs = (product: string): LoanFaq[] => [
  {
    q: `Who decides ${product} approval and the interest rate?`,
    a: 'The lender. Askus Financial Services does not lend money and cannot guarantee approval, a rate or a loan amount.',
  },
  {
    q: 'Does using the calculator or readiness check affect my credit score?',
    a: 'No. These tools run in your browser with the values you enter, send nothing to a lender and do not request a bureau report.',
  },
  {
    q: 'Which documents will I need?',
    a: 'Requirements vary by lender and applicant profile. The list on this page is a general checklist; confirm the current list with the lender.',
  },
]

export const LOAN_PRODUCTS: LoanProduct[] = [
  {
    slug: 'personal-loan',
    title: 'Personal Loan',
    short: 'Unsecured credit for planned or urgent personal expenses.',
    icon: 'personal_loan.svg',
    tile: 'personalLoanTile.png',
    accent: '#0066ff',
    wizardServiceId: 'personal-loan',
    planning: { min: 50000, max: 5000000, step: 10000, defaultAmount: 500000, minMonths: 12, maxMonths: 84, defaultMonths: 36 },
    illustrativeRate: 12,
    calculatorId: 'personal-loan-emi',
    overview: [
      'A personal loan is an unsecured loan, so no collateral is pledged. It is commonly used for medical needs, weddings, travel, home repairs or consolidating higher-cost debt.',
      'Lenders consider income, employment type, existing obligations and credit history. Rates, fees and limits differ by lender, so compare the full cost before you apply.',
    ],
    categories: ['Salaried', 'Self employed', 'Medical', 'Wedding', 'Travel', 'Debt consolidation', 'Balance transfer'],
    highlights: [
      { title: 'No collateral', text: 'Unsecured, so no asset needs to be pledged.' },
      { title: 'Flexible tenure', text: 'Pick a tenure that balances EMI size against total interest.' },
      { title: 'Fixed monthly EMI', text: 'Most personal loans are repaid in equal monthly instalments.' },
      { title: 'Compare before applying', text: 'Check processing fees, prepayment terms and total cost.' },
    ],
    eligibility: [
      'Age typically between 21 and 60 years (varies by lender)',
      'Stable income as salaried or self-employed',
      'Minimum income and employment vintage set by the lender',
      'Healthy credit history and manageable existing EMIs',
      'Indian resident with valid identity and address proof',
    ],
    documents: ['PAN card', 'Aadhaar or other address proof', 'Recent salary slips or income proof', 'Bank statements', 'Employer / business proof', 'Recent photograph'],
    steps: commonSteps('personal loan'),
    faqs: [
      ...commonFaqs('personal loan'),
      { q: 'Can I get a personal loan with a cash salary?', a: 'Some lenders accept it with additional evidence, others do not. Read our document guide and confirm with the lender first.' },
    ],
  },
  {
    slug: 'home-loan',
    title: 'Home Loan',
    short: 'Long-tenure secured credit to buy, build or renovate a home.',
    icon: 'home-loan.svg',
    accent: '#00a86b',
    wizardServiceId: 'home-loan',
    planning: { min: 500000, max: 50000000, step: 100000, defaultAmount: 4000000, minMonths: 60, maxMonths: 360, defaultMonths: 240 },
    illustrativeRate: 8.5,
    calculatorId: 'home-loan-emi',
    overview: [
      'A home loan finances the purchase or construction of a house, plot or renovation, secured against the property. Tenures are long, which keeps EMIs manageable.',
      'Lenders assess your income, the property’s value and legal status, and your credit history. Compare floating and fixed rate options, fees and prepayment rules.',
    ],
    categories: ['Home purchase', 'Construction', 'Plot loan', 'Renovation', 'Extension', 'Top-up', 'Balance transfer', 'NRI'],
    highlights: [
      { title: 'Long tenure', text: 'Spread repayment over many years to keep EMIs affordable.' },
      { title: 'Secured by property', text: 'The property is mortgaged to the lender until the loan is closed.' },
      { title: 'Balance transfer', text: 'Existing loans can sometimes be moved to a lender with better terms.' },
      { title: 'Tax provisions', text: 'Tax benefits may apply under prevailing law; consult a tax professional.' },
    ],
    eligibility: [
      'Age typically between 21 and 65 years at loan maturity (varies)',
      'Stable income and sufficient repayment capacity',
      'Clear title and approved plan for the property',
      'Down payment arranged for the part the lender does not finance',
      'Good credit history',
    ],
    documents: ['PAN card', 'Identity and address proof', 'Income proof (salary slips / ITR)', 'Bank statements', 'Property documents and sale agreement', 'Form 16 or business financials'],
    steps: commonSteps('home loan'),
    faqs: [
      ...commonFaqs('home loan'),
      { q: 'What is the difference between floating and fixed rates?', a: 'A floating rate moves with a benchmark and can change over the tenure; a fixed rate stays constant for the agreed period. Ask the lender how each is defined.' },
    ],
  },
  {
    slug: 'business-loan',
    title: 'Business Loan',
    short: 'Working capital and growth funding for small and growing businesses.',
    icon: 'business_loan.svg',
    accent: '#7c3aed',
    wizardServiceId: 'business-loan',
    planning: { min: 100000, max: 20000000, step: 50000, defaultAmount: 1000000, minMonths: 12, maxMonths: 60, defaultMonths: 36 },
    illustrativeRate: 15,
    calculatorId: 'business-loan-emi',
    overview: [
      'Business loans fund working capital, equipment, inventory or expansion. They can be unsecured or secured depending on the lender and amount.',
      'Lenders look at business vintage, turnover, profitability, banking behaviour and the promoter’s credit history.',
    ],
    categories: ['MSME', 'Working capital', 'Term loan', 'Overdraft', 'Mudra', 'Startup', 'Professional'],
    highlights: [
      { title: 'Working capital', text: 'Smooth out cash-flow gaps and fund day-to-day operations.' },
      { title: 'Growth funding', text: 'Finance equipment, stock or a new location.' },
      { title: 'Scheme-linked options', text: 'Government-backed schemes may be available for eligible borrowers.' },
      { title: 'Flexible structures', text: 'Term loans and overdraft-style limits are common.' },
    ],
    eligibility: [
      'Business operating for a minimum period set by the lender',
      'Minimum annual turnover and profitability',
      'Business registration / GST or equivalent proof',
      'Credit history of the business and promoters',
      'Owner age within the lender’s limits',
    ],
    documents: ['PAN of owner and business', 'KYC of owners / partners', 'Business registration proof', 'Bank statements (last 6–12 months)', 'ITR and financial statements', 'GST returns where applicable'],
    steps: commonSteps('business loan'),
    faqs: commonFaqs('business loan'),
  },
  {
    slug: 'loan-against-property',
    title: 'Loan Against Property',
    short: 'Borrow against residential or commercial property you already own.',
    icon: 'lap_icon.svg',
    accent: '#ea580c',
    planning: { min: 500000, max: 100000000, step: 100000, defaultAmount: 5000000, minMonths: 36, maxMonths: 240, defaultMonths: 120 },
    illustrativeRate: 10,
    calculatorId: 'lap-emi',
    overview: [
      'A loan against property (LAP) lets you borrow against a property you own without selling it. Funds can be used for business, education, medical or other needs, subject to lender rules.',
      'The amount depends on the property’s assessed value, your income and credit profile. Tenures are generally long and rates lower than unsecured loans, but the property is at risk if you default.',
    ],
    categories: ['Residential property', 'Commercial property', 'Self-occupied', 'Rented', 'Balance transfer'],
    highlights: [
      { title: 'Higher limits', text: 'Property-backed limits are usually larger than unsecured loans.' },
      { title: 'Long tenure', text: 'Longer repayment periods keep the EMI lower.' },
      { title: 'Versatile use', text: 'Business, education, medical or other lawful needs.' },
      { title: 'Understand the risk', text: 'The property is mortgaged; missed EMIs can lead to recovery action.' },
    ],
    eligibility: [
      'Owner of a residential or commercial property with clear title',
      'Stable income or business cash flow',
      'Age within the lender’s limits',
      'Satisfactory credit history',
      'Property in a location the lender accepts',
    ],
    documents: ['PAN card', 'Identity and address proof', 'Title deed and property documents', 'Income proof / ITR', 'Bank statements', 'Property tax receipts'],
    steps: commonSteps('loan against property'),
    faqs: [
      ...commonFaqs('loan against property'),
      { q: 'Can I apply for a loan against property here?', a: 'Not yet. You can plan the loan and review readiness here, then follow the lender’s official channel.' },
    ],
  },
  {
    slug: 'car-loan',
    title: 'Car Loan',
    short: 'Finance a new or used car with a fixed repayment plan.',
    icon: 'credit_card.svg',
    accent: '#e11d48',
    wizardServiceId: 'vehicle-loan',
    planning: { min: 100000, max: 3000000, step: 10000, defaultAmount: 800000, minMonths: 12, maxMonths: 84, defaultMonths: 60 },
    illustrativeRate: 9.5,
    calculatorId: 'car-loan-emi',
    overview: [
      'A car loan finances a new or pre-owned vehicle, which is hypothecated to the lender until repayment. The amount is usually a percentage of the vehicle price.',
      'Compare on-road price funding, processing fees and foreclosure terms along with the interest rate.',
    ],
    categories: ['New car', 'Used car', 'Loan against car'],
    highlights: [
      { title: 'Quick planning', text: 'Estimate the EMI for different down payments and tenures.' },
      { title: 'Vehicle as security', text: 'The vehicle is hypothecated to the lender.' },
      { title: 'New or used', text: 'Options exist for both, with different terms.' },
      { title: 'Check total cost', text: 'Include insurance, fees and any foreclosure charges.' },
    ],
    eligibility: ['Age within lender limits', 'Stable income', 'Satisfactory credit history', 'Down payment arranged', 'Valid identity and address proof'],
    documents: ['PAN card', 'Identity and address proof', 'Income proof', 'Bank statements', 'Vehicle quotation / proforma invoice'],
    steps: commonSteps('car loan'),
    faqs: commonFaqs('car loan'),
  },
  {
    slug: 'two-wheeler-loan',
    title: 'Two Wheeler Loan',
    short: 'Finance a motorcycle or scooter in manageable EMIs.',
    icon: 'other_loans.svg',
    accent: '#0891b2',
    planning: { min: 20000, max: 500000, step: 5000, defaultAmount: 80000, minMonths: 6, maxMonths: 60, defaultMonths: 36 },
    illustrativeRate: 13,
    calculatorId: 'personal-loan-emi',
    overview: [
      'Two wheeler loans finance a motorcycle or scooter, usually with a short tenure and a modest down payment. Terms vary widely between lenders and dealers.',
    ],
    categories: ['Motorcycle', 'Scooter', 'Electric two-wheeler'],
    highlights: [
      { title: 'Small ticket', text: 'Lower amounts and shorter tenures.' },
      { title: 'Dealer tie-ups', text: 'Some dealers arrange finance; compare it with other lenders.' },
      { title: 'Plan the EMI', text: 'Use the calculator to match the EMI to your budget.' },
    ],
    eligibility: ['Age within lender limits', 'Regular income', 'Valid identity and address proof', 'Credit history as assessed by the lender'],
    documents: ['PAN card', 'Identity and address proof', 'Income proof', 'Bank statements', 'Vehicle quotation'],
    steps: commonSteps('two wheeler loan'),
    faqs: commonFaqs('two wheeler loan'),
  },
  {
    slug: 'gold-loan',
    title: 'Gold Loan',
    short: 'Short-tenure credit against gold jewellery.',
    icon: 'fd_icon.svg',
    accent: '#ca8a04',
    planning: { min: 10000, max: 2500000, step: 5000, defaultAmount: 200000, minMonths: 3, maxMonths: 36, defaultMonths: 12 },
    illustrativeRate: 11,
    calculatorId: 'gold-loan-emi',
    overview: [
      'A gold loan is secured against gold ornaments, with the value based on weight and purity. Paperwork is usually lighter than other secured loans.',
      'Understand the loan-to-value ratio, how the lender stores the gold and what happens if you miss repayments.',
    ],
    categories: ['Jewellery', 'Bullet repayment', 'EMI repayment'],
    highlights: [
      { title: 'Light documentation', text: 'Typically KYC and the gold to be pledged.' },
      { title: 'Short tenure', text: 'Often months rather than years.' },
      { title: 'Know the risk', text: 'Unpaid loans can lead to auction of the pledged gold.' },
    ],
    eligibility: ['Age 18+ as per lender', 'Valid KYC', 'Gold of acceptable purity', 'Ownership of the gold'],
    documents: ['PAN / identity proof', 'Address proof', 'Photograph', 'Gold ornaments for valuation'],
    steps: commonSteps('gold loan'),
    faqs: commonFaqs('gold loan'),
  },
  {
    slug: 'education-loan',
    title: 'Education Loan',
    short: 'Fund tuition and living costs for studies in India or abroad.',
    icon: 'by-type.svg',
    accent: '#4f46e5',
    planning: { min: 100000, max: 15000000, step: 50000, defaultAmount: 1500000, minMonths: 24, maxMonths: 180, defaultMonths: 120 },
    illustrativeRate: 10,
    calculatorId: 'personal-loan-emi',
    overview: [
      'Education loans cover tuition, accommodation and related costs. Many lenders have a moratorium period during the course and for some time after.',
      'A co-applicant (often a parent) is usually required, and larger loans may need collateral.',
    ],
    categories: ['India', 'Abroad', 'Undergraduate', 'Postgraduate', 'Vocational'],
    highlights: [
      { title: 'Moratorium', text: 'Repayment may begin only after the course and a grace period.' },
      { title: 'Co-applicant', text: 'A co-applicant’s income is considered.' },
      { title: 'Tax provisions', text: 'Interest may be eligible for deductions; consult a tax professional.' },
    ],
    eligibility: ['Admission to a recognised institution', 'Indian citizen', 'Co-applicant with regular income', 'Academic record as required'],
    documents: ['Admission letter', 'Fee structure', 'Student and co-applicant KYC', 'Co-applicant income proof', 'Academic records'],
    steps: commonSteps('education loan'),
    faqs: commonFaqs('education loan'),
  },
]

export const findLoanProduct = (slug: string) => LOAN_PRODUCTS.find((p) => p.slug === slug)
