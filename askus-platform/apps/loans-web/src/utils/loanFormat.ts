export const formatLakhCrore = (n: number): string => {
  if (n >= 10000000) return `₹${+(n / 10000000).toFixed(2)} Cr`
  if (n >= 100000) return `₹${+(n / 100000).toFixed(2)} L`
  return `₹${n.toLocaleString('en-IN')}`
}

export const formatTenure = (months: number): string => {
  if (months < 12) return `${months} mo`
  const y = Math.floor(months / 12)
  const m = months % 12
  return m ? `${y} yr ${m} mo` : `${y} yr`
}
