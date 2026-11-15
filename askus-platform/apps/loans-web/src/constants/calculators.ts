export type CalculatorKind = 'emi' | 'eligibility' | 'sip' | 'fd' | 'gst'

export interface CalculatorDef {
  id: string
  title: string
  kind: CalculatorKind
  icon: string
  group: 'Loan EMI' | 'Loan eligibility' | 'Investment'
  blurb: string
  /** Related loan landing page, if any. */
  loanSlug?: string
  defaults: { amount: number; rate: number; years: number }
}

const emi = (
  id: string,
  title: string,
  loanSlug: string,
  amount: number,
  rate: number,
  years: number,
): CalculatorDef => ({
  id,
  title,
  kind: 'emi',
  icon: 'emi-calculator.svg',
  group: 'Loan EMI',
  blurb: 'Estimate your monthly instalment, total interest and repayment.',
  loanSlug,
  defaults: { amount, rate, years },
})

export const CALCULATORS: CalculatorDef[] = [
  emi('personal-loan-emi', 'Personal Loan EMI Calculator', 'personal-loan', 500000, 12, 3),
  emi('home-loan-emi', 'Home Loan EMI Calculator', 'home-loan', 4000000, 8.5, 20),
  emi('business-loan-emi', 'Business Loan EMI Calculator', 'business-loan', 1000000, 15, 3),
  emi('lap-emi', 'Loan Against Property EMI Calculator', 'loan-against-property', 5000000, 10, 10),
  emi('gold-loan-emi', 'Gold Loan EMI Calculator', 'gold-loan', 200000, 11, 1),
  emi('car-loan-emi', 'Car Loan EMI Calculator', 'car-loan', 800000, 9.5, 5),
  {
    id: 'personal-loan-eligibility',
    title: 'Personal Loan Eligibility Calculator',
    kind: 'eligibility',
    icon: 'calculator.svg',
    group: 'Loan eligibility',
    blurb: 'Rough estimate of the loan amount your income could support.',
    loanSlug: 'personal-loan',
    defaults: { amount: 60000, rate: 12, years: 3 },
  },
  {
    id: 'home-loan-eligibility',
    title: 'Home Loan Eligibility Calculator',
    kind: 'eligibility',
    icon: 'calculator.svg',
    group: 'Loan eligibility',
    blurb: 'Rough estimate of the home loan your income could support.',
    loanSlug: 'home-loan',
    defaults: { amount: 100000, rate: 8.5, years: 20 },
  },
  {
    id: 'fd',
    title: 'Fixed Deposit Calculator',
    kind: 'fd',
    icon: 'fixed-deposit.svg',
    group: 'Investment',
    blurb: 'See the maturity value of a deposit with quarterly compounding.',
    defaults: { amount: 100000, rate: 7, years: 5 },
  },
  {
    id: 'sip',
    title: 'SIP Calculator',
    kind: 'sip',
    icon: 'investment-calculator.svg',
    group: 'Investment',
    blurb: 'Project the value of a monthly SIP at an assumed return.',
    defaults: { amount: 5000, rate: 12, years: 10 },
  },
  {
    id: 'gst',
    title: 'GST Calculator',
    kind: 'gst',
    icon: 'calculators_icon.svg',
    group: 'Investment',
    blurb: 'Add or remove GST from an amount.',
    defaults: { amount: 10000, rate: 18, years: 0 },
  },
]

export const findCalculator = (id: string) => CALCULATORS.find((c) => c.id === id)
