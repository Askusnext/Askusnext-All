// Homepage product-tile sections, modelled on the reference marketplace layout.
// Icons live in /public/assets/pb. Tiles with a `lottie` file play a looping
// animation (same behaviour as the reference); the others get a hover motion.
// Tiles marked `soon` have no live product/flow yet and say so.

export interface ProductTile {
  label: string
  to: string
  icon: string
  lottie?: string
  badge?: string
  soon?: boolean
}

export interface ProductSection {
  title: string
  tiles: ProductTile[]
}

export const PRODUCT_SECTIONS: ProductSection[] = [
  {
    title: 'Loans and Cards',
    tiles: [
      { label: 'Personal Loan', to: '/loans/quotes?type=personal-loan', icon: 'personalLoanTile.png', lottie: 'lottie/personal-loan.json', badge: 'Popular' },
      { label: 'Credit Cards', to: '/explore/credit-card', icon: 'creditCardTile.png', lottie: 'lottie/credit-cards.json', badge: 'Guide' },
      { label: 'Business Loan', to: '/loans/quotes?type=business-loan', icon: 'products/business-loan.svg' },
      { label: 'Home Loan', to: '/loans/quotes?type=home-loan', icon: 'products/home-loan.svg' },
      { label: 'Loan Against\nProperty', to: '/loans/quotes?type=loan-against-property', icon: 'products/loan-against-property.svg' },
      { label: 'FD\nCredit Cards', to: '/explore/fd-credit-cards', icon: 'CCFD_icon.png' },
      { label: 'Instant\nPersonal Loan', to: '/loans/quotes?type=instant-personal-loan', icon: 'products/instant-personal-loan.svg' },
      { label: 'Consumer\nDurable Loan', to: '/loans/quotes?type=consumer-durable-loan', icon: 'durableLoan.svg' },
    ],
  },
  {
    title: 'Credit Score & Bill Payments',
    tiles: [
      { label: 'CIBIL Score\nCheck', to: '/cibil-check', icon: 'creditScoreTileFree.png', lottie: 'lottie/cibil-score-check.json', badge: 'Info' },
      { label: 'Credit Health\nPro', to: '/explore/credit-health-pro', icon: 'products/credit-health-pro.svg' },
      { label: 'Video\nCredit Report', to: '/explore/video-credit-report', icon: 'products/video-credit-report.svg' },
      { label: 'Credit\nCard Bill', to: '/services/credit-card-bill', icon: 'products/credit-card-bill.svg', soon: true },
      { label: 'FASTag\nRecharge', to: '/explore/fastag-recharge', icon: 'products/fastag-recharge.svg', soon: true },
      { label: 'Mobile\nRecharge', to: '/explore/mobile-recharge', icon: 'mobileRecharge.svg', lottie: 'lottie/mobile-recharge.json', soon: true },
      { label: 'Brand\nVouchers', to: '/explore/brand-vouchers', icon: 'vouchersIcon.png', lottie: 'lottie/brand-vouchers.json', soon: true },
      { label: 'Explore More', to: '/calculators', icon: 'products/explore-more.svg' },
    ],
  },
  {
    title: 'Investment & Insurance Products',
    tiles: [
      { label: 'Bonds', to: '/explore/bonds', icon: 'bondsTile.svg', lottie: 'lottie/bonds.json' },
      { label: 'Mutual Funds', to: '/explore/invest-in-mutual-funds', icon: 'mfIcon.png', lottie: 'lottie/mutual-funds.json' },
      { label: 'Daily SIP', to: '/explore/daily-sip', icon: 'dailySIP.png' },
      { label: 'Fixed Deposits', to: '/explore/fixed-deposit', icon: 'products/fixed-deposits.svg' },
      { label: 'Health Insurance', to: '/explore/health-insurance', icon: 'products/health-insurance.svg' },
      { label: 'Term Life\nInsurance', to: '/explore/term-life-insurance', icon: 'products/term-life-insurance.svg' },
      { label: 'National\nPension Scheme', to: '/explore/nps-national-pension-scheme', icon: 'nationalPensionSchemeTile.png' },
      { label: 'All Insurance\nProducts', to: '/explore/all-insurance-products', icon: 'products/all-insurance-products.svg' },
    ],
  },
]
