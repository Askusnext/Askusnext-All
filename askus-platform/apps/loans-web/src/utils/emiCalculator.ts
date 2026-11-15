import type { EmiCalculationResult } from '../types'

export function calculateEMI(
  principal: number,
  annualInterestRate: number,
  tenureYears: number
): EmiCalculationResult {
  const p = Math.max(0, principal)
  const n = Math.max(1, Math.round(tenureYears * 12))
  const r = annualInterestRate / 12 / 100

  let monthlyEmi = 0
  let totalRepayment = 0
  let totalInterest = 0

  if (p === 0 || n === 0) {
    return {
      monthlyEmi: 0,
      principal: 0,
      totalInterest: 0,
      totalRepayment: 0,
      amortizationPreview: []
    }
  }

  if (annualInterestRate === 0) {
    monthlyEmi = Math.round(p / n)
    totalRepayment = p
    totalInterest = 0
  } else {
    const rateFactor = Math.pow(1 + r, n)
    monthlyEmi = Math.round((p * r * rateFactor) / (rateFactor - 1))
    totalRepayment = monthlyEmi * n
    totalInterest = Math.max(0, totalRepayment - p)
  }

  // Generate yearly amortization breakdown
  const amortizationPreview: EmiCalculationResult['amortizationPreview'] = []
  let balance = p
  const totalYears = Math.ceil(n / 12)

  for (let year = 1; year <= totalYears; year++) {
    let yearPrincipalPaid = 0
    let yearInterestPaid = 0

    const monthsInThisYear = year === totalYears ? n - (year - 1) * 12 : 12

    for (let m = 0; m < monthsInThisYear; m++) {
      if (balance <= 0) break
      const monthlyInterest = annualInterestRate === 0 ? 0 : balance * r
      const monthlyPrincipal = Math.min(balance, monthlyEmi - monthlyInterest)
      yearInterestPaid += monthlyInterest
      yearPrincipalPaid += monthlyPrincipal
      balance = Math.max(0, balance - monthlyPrincipal)
    }

    amortizationPreview.push({
      year,
      principalPaid: Math.round(yearPrincipalPaid),
      interestPaid: Math.round(yearInterestPaid),
      remainingBalance: Math.round(balance)
    })
  }

  return {
    monthlyEmi,
    principal: p,
    totalInterest,
    totalRepayment,
    amortizationPreview
  }
}
