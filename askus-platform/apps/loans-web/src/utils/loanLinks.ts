import type { LoanProduct } from '../constants/loanProducts'

/** Link into the existing /apply wizard, or null when the product is not accepted there. */
export const applyLink = (product: LoanProduct, amount: number, months: number): string | null =>
  product.wizardServiceId ? `/apply?service=${product.wizardServiceId}&amount=${amount}&tenure=${months}` : null
