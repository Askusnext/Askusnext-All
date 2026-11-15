export interface PromoSlide {
  title: string
  highlight?: string
  bullets: string[]
  cta: string
  to: string
  icon: string
  gradient: string
}

export const PROMO_SLIDES: PromoSlide[] = [
  {
    title: 'Plan your personal loan',
    highlight: 'Check EMI in seconds',
    bullets: ['Pick amount and tenure', 'Readiness check, nothing submitted'],
    cta: 'Plan Now',
    to: '/loans/personal-loan',
    icon: 'personal_loan.svg',
    gradient: 'from-[#3b0764] via-[#581c87] to-[#7e22ce]'
  },
  {
    title: 'Know before you apply',
    highlight: 'Credit score basics',
    bullets: ['What affects your score', 'How to read a bureau report'],
    cta: 'Read Guide',
    to: '/cibil-check',
    icon: 'credit_score.svg',
    gradient: 'from-[#052f5f] via-[#0a3d78] to-[#0052cc]'
  },
  {
    title: 'Get your documents ready',
    highlight: 'Company-wise checklist',
    bullets: ['Bank salary vs cash salary', 'Lender-specific guidance'],
    cta: 'View Guide',
    to: '/document-guide',
    icon: 'overview.svg',
    gradient: 'from-[#064e3b] via-[#065f46] to-[#047857]'
  }
]

