import { calculateEMI } from './emiCalculator'
import type { ApprovalLevel, QuoteLender, SortKey } from '../constants/quotesData'
import type { QuoteType } from '../constants/quotesTypes'
import type { QuoteStep } from '../services/api/loansApi'

export const emiFor = (amount: number, roi: number, months: number) => calculateEMI(amount, roi, months / 12).monthlyEmi

export const formatRupee = (n: number) => `₹${n.toLocaleString('en-IN')}`

export const formatAmountLabel = (n: number) => {
  if (n >= 10000000) return `₹ ${+(n / 10000000).toFixed(2)} Crore${n >= 20000000 ? 's' : ''}`
  if (n >= 100000) {
    const l = +(n / 100000).toFixed(2)
    return `₹ ${l} ${l === 1 ? 'Lakh' : 'Lakhs'}`
  }
  return `₹ ${n.toLocaleString('en-IN')}`
}

export const formatRoi = (roi: number) => `${roi}% p.a`

export interface PricedLender extends QuoteLender {
  emi: number
}

export const price = (lenders: QuoteLender[], amount: number, months: number): PricedLender[] =>
  lenders.map((l) => ({ ...l, emi: emiFor(Math.min(amount, l.maxAmount), l.roi, months) }))

export const sortLenders = (list: PricedLender[], key: SortKey): PricedLender[] => {
  const copy = [...list]
  copy.sort((a, b) => {
    switch (key) {
      case 'approval':
        return b.approval - a.approval || a.roi - b.roi
      case 'disbursal':
        return a.disbursalHours - b.disbursalHours || a.roi - b.roi
      case 'emi':
        return a.emi - b.emi
      case 'roi':
        return a.roi - b.roi
    }
  })
  return copy
}

/** Applies a loan type's demo limit scale and rate adjustment to a lender. */
export const adaptLender = (l: QuoteLender, type: QuoteType): QuoteLender => ({
  ...l,
  maxAmount: Math.round((l.maxAmount * type.limitScale) / 1000) * 1000,
  roi: +Math.max(7, l.roi + type.roiDelta).toFixed(2),
})

export interface IncomeProfile {
  monthlyIncome: number | null
  employmentType: string
}

/**
 * Affordability level from the customer's real income: the EMI as a share of
 * monthly income. Returns null when income is unknown.
 */
export const affordabilityLevel = (emi: number, p: IncomeProfile): ApprovalLevel | null => {
  if (!p.monthlyIncome || p.monthlyIncome <= 0) return null
  const strict = p.employmentType === 'self_employed' || p.employmentType === 'professional' ? 1.15 : 1
  const ratio = (emi / p.monthlyIncome) * strict
  if (ratio <= 0.25) return 5
  if (ratio <= 0.35) return 4
  if (ratio <= 0.45) return 3
  if (ratio <= 0.55) return 2
  return 1
}

/**
 * Approval chance blends the (demo) lender friendliness with real affordability.
 * Without income data it falls back to the lender's sample level.
 */
export const approvalFor = (lender: QuoteLender, emi: number, p: IncomeProfile): ApprovalLevel => {
  const a = affordabilityLevel(emi, p)
  if (a === null) return lender.approval
  return Math.min(5, Math.max(1, Math.round((a * 2 + lender.approval) / 3))) as ApprovalLevel
}

/** An in-progress application, priced for display in the on-going carousel. */
export interface OngoingItem extends PricedLender {
  docId: string
  tag: string
  appAmount: number
  appMonths: number
  appType: string
  appPurpose?: string
  appStep: QuoteStep
}
