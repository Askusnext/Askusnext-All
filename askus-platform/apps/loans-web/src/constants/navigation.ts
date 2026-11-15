// Marketplace navigation model used by the desktop mega-menu, the mobile drawer,
// the footer and the /explore topic pages.
//
// Every link resolves to a real route:
//   - /loans/:slug       product landing pages (src/constants/loanProducts.ts)
//   - /calculators/:id   calculators (src/constants/calculators.ts)
//   - /explore/:slug     topic pages for everything else
//   - /cibil-check, /apply, ... existing pages

export interface NavLinkItem {
  label: string
  to: string
  badge?: string
}

export interface NavColumn {
  title: string
  icon?: string
  links: NavLinkItem[]
}

export interface NavTab {
  id: string
  label: string
  icon: string
  columns: NavColumn[]
}

export interface NavMenu {
  id: string
  label: string
  /** Optional landing route when the trigger itself is clicked on desktop. */
  to?: string
  columns?: NavColumn[]
  tabs?: NavTab[]
}

export const assetUrl = (file: string) => `/assets/pb/${file}`

export const slugify = (label: string) =>
  label
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const topic = (label: string, badge?: string): NavLinkItem => ({ label, to: `/explore/${slugify(label)}`, badge })
const loan = (label: string, slug: string, query = ''): NavLinkItem => ({ label, to: `/loans/${slug}${query}` })
const quote = (label: string, type: string, amount?: number): NavLinkItem => ({
  label,
  to: `/loans/quotes?type=${type}${amount ? `&amount=${amount}` : ''}`,
})
const calc = (label: string, id: string): NavLinkItem => ({ label, to: `/calculators/${id}` })


export const NAV_MENUS: NavMenu[] = [
  {
    id: 'credit-score',
    label: 'Credit Score',
    columns: [
      {
        title: 'Know Your Score',
        icon: 'credit-score.svg',
        links: [
          { label: 'Credit Score Information', to: '/cibil-check' },
          topic('CIBIL Score'),
          topic('Experian Score'),
          topic('Equifax Score'),
          topic('CRIF Score'),
          topic('CIBIL Score Check by PAN Number'),
          topic('How to Increase CIBIL Score'),
          topic('CIBIL Score for Personal Loan'),
          topic('How to Raise and Resolve CIBIL Dispute'),
        ],
      },
    ],
  },
  {
    id: 'loans',
    label: 'Loans',
    to: '/loans/quotes',
    tabs: [
      {
        id: 'personal',
        label: 'Personal Loan',
        icon: 'personal_loan.svg',
        columns: [
          {
            title: 'Overview',
            icon: 'overview.svg',
            links: [
              quote('Personal Loan', 'personal-loan'),
              quote('Instant Personal Loan', 'instant-personal-loan'),
              calc('Personal Loan Interest Rates', 'personal-loan-emi'),
              topic('Personal Loan Low CIBIL Score'),
              topic('Personal Loan Balance Transfer'),
              topic('Loan on Credit Card'),
            ],
          },
          {
            title: 'By Amount',
            icon: 'by-amount.svg',
            links: [5, 10, 20, 30, 40, 50].map((n) => quote(`${n} Lakh Personal Loan`, 'personal-loan', n * 100000)),
          },
          {
            title: 'By Type',
            icon: 'by-type.svg',
            links: [
              topic('Loan for Salaried Employees'),
              topic('Loan for Self Employed'),
              topic('Loan for Senior Citizens'),
              topic('Loan for Students'),
              topic('Loan for Doctors'),
              topic('Loan for Women'),
            ],
          },
          {
            title: 'By Need',
            icon: 'by-need.svg',
            links: [
              topic('Medical Loan'),
              topic('Travel Loan'),
              topic('Debt Consolidation Loan'),
              topic('Wedding Loan'),
              topic('Overdraft Loan'),
              topic('Short Term Loan'),
            ],
          },
        ],
      },
      {
        id: 'business',
        label: 'Business Loan',
        icon: 'business_loan.svg',
        columns: [
          {
            title: 'Overview',
            icon: 'overview.svg',
            links: [
              quote('Business Loan', 'business-loan'),
              calc('Business Loan Interest Rates', 'business-loan-emi'),
              topic('Business Loan Low CIBIL Score'),
              topic('MSME Loan'),
            ],
          },
          {
            title: 'By Schemes',
            icon: 'by-schemes.svg',
            links: [
              topic('Small Business Loan'),
              topic('Startups Loan'),
              topic('Professional Loan'),
              topic('Dairy Farming Loan'),
              topic('Poultry Farm Loan'),
              topic('Goat Farming Loan'),
            ],
          },
          {
            title: 'By Need',
            icon: 'by-need.svg',
            links: [
              topic('Mudra Loan'),
              topic('PMEGP Loan'),
              topic('CGTMSE Loan'),
              topic('Letter of Credit'),
              topic('Working Capital Loan'),
            ],
          },
          {
            title: 'By Profession',
            icon: 'by-type.svg',
            links: [topic('Loan for CA'), topic('Loan for Doctors')],
          },
        ],
      },
      {
        id: 'home',
        label: 'Home Loan',
        icon: 'home_loan.svg',
        columns: [
          {
            title: 'Overview',
            icon: 'overview.svg',
            links: [
              quote('Home Loan', 'home-loan'),
              calc('Home Loan Interest Rates', 'home-loan-emi'),
              topic('Home Loan Balance Transfer'),
              topic('Home Loan Low CIBIL Score'),
            ],
          },
          {
            title: 'By Amount',
            icon: 'by-amount.svg',
            links: [
              quote('20 Lakh Home Loan', 'home-loan', 20 * 100000),
              quote('40 Lakh Home Loan', 'home-loan', 40 * 100000),
              quote('60 Lakh Home Loan', 'home-loan', 60 * 100000),
              quote('1 Crore Home Loan', 'home-loan', 100 * 100000),
              quote('2 Crore Home Loan', 'home-loan', 200 * 100000),
              quote('5 Crore Home Loan', 'home-loan', 500 * 100000),
            ],
          },
          {
            title: 'By Schemes',
            icon: 'by-schemes.svg',
            links: [
              topic('Home Renovation Loan'),
              topic('Plot Loan'),
              topic('Top up Home Loan'),
              topic('Home Construction Loan'),
              topic('NRI Home Loan'),
              topic('Home Extension Loan'),
            ],
          },
          {
            title: 'By Profession',
            icon: 'by-type.svg',
            links: [topic('Home Loan for Self Employed'), topic('Home Loan for Women')],
          },
        ],
      },
      {
        id: 'other',
        label: 'Other Loans',
        icon: 'other_loans.svg',
        columns: [
          {
            title: 'Loan Types',
            icon: 'by-amount.svg',
            links: [
              quote('Loan Against Property', 'loan-against-property'),
              loan('Car Loan', 'car-loan'),
              loan('Two Wheeler Loan', 'two-wheeler-loan'),
              loan('Gold Loan', 'gold-loan'),
              loan('Education Loan', 'education-loan'),
              topic('Loan Against Car'),
              topic('Micro Loan'),
              { label: 'Credit Cards', to: '/explore/credit-card' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'credit-cards',
    label: 'Credit Cards',
    to: '/explore/credit-card',
    columns: [
      {
        title: 'Overview',
        icon: 'credit_cards.svg',
        links: [
          topic('Credit Card'),
          topic('Best Credit Cards'),
          topic('Best RuPay Credit Cards'),
          topic('Credit Card Eligibility'),
          topic('Compare Credit Cards'),
          topic('Business Credit Cards'),
          topic('Student Credit Cards'),
          topic('Visa Credit Cards'),
          topic('CIBIL Score for Credit Card'),
        ],
      },
      {
        title: 'By Category',
        icon: 'card.svg',
        links: [
          topic('Lifetime Free Credit Cards'),
          topic('Lifetime Free RuPay Credit Cards'),
          topic('Secured Credit Cards'),
          topic('FD Credit Cards'),
          topic('Rewards Credit Cards'),
          topic('Cashback Credit Cards'),
          topic('Travel Credit Cards'),
          topic('Fuel Credit Cards'),
          topic('Virtual Credit Cards'),
          topic('Credit Card Lounge Access'),
          topic('Zero Forex Markup Credit Cards'),
        ],
      },
    ],
  },
  {
    id: 'investment',
    label: 'Investment',
    columns: [
      {
        title: 'Bonds',
        icon: 'bonds.svg',
        links: [
          topic('Bonds'),
          topic('Corporate Bonds'),
          topic('Government Bonds'),
          topic('Tax Free Bonds'),
          topic('Floating Rate Bonds'),
          topic('Sovereign Gold Bonds'),
          topic('How to Invest in Bonds'),
        ],
      },
      {
        title: 'Fixed Deposit',
        icon: 'fixed-deposit.svg',
        links: [
          topic('Fixed Deposit'),
          topic('Fixed Deposit Interest Rates'),
          topic('Senior Citizen FD Rates'),
          topic('Loan Against Fixed Deposit'),
          topic('FD vs Mutual Funds'),
          topic('FD vs RD'),
          topic('Recurring Deposit'),
        ],
      },
      {
        title: 'Mutual Funds',
        icon: 'mutual-funds.svg',
        links: [
          topic('Invest in Mutual Funds'),
          topic('Daily SIP'),
          topic('Equity Mutual Funds'),
          topic('Debt Mutual Funds'),
          topic('Hybrid Mutual Funds'),
          topic('Best SIP Plans in India'),
        ],
      },
    ],
  },
  {
    id: 'calculators',
    label: 'Calculators',
    to: '/calculators',
    columns: [
      {
        title: 'Loan EMI Calculators',
        icon: 'emi-calculator.svg',
        links: [
          calc('Personal Loan EMI Calculator', 'personal-loan-emi'),
          calc('Home Loan EMI Calculator', 'home-loan-emi'),
          calc('Business Loan EMI Calculator', 'business-loan-emi'),
          calc('Loan Against Property EMI Calculator', 'lap-emi'),
          calc('Gold Loan EMI Calculator', 'gold-loan-emi'),
          calc('Car Loan EMI Calculator', 'car-loan-emi'),
        ],
      },
      {
        title: 'Loan Eligibility Calculators',
        icon: 'calculator.svg',
        links: [
          calc('Personal Loan Eligibility Calculator', 'personal-loan-eligibility'),
          calc('Home Loan Eligibility Calculator', 'home-loan-eligibility'),
        ],
      },
      {
        title: 'Investment Calculators',
        icon: 'investment-calculator.svg',
        links: [
          calc('Fixed Deposit Calculator', 'fd'),
          calc('SIP Calculator', 'sip'),
          calc('GST Calculator', 'gst'),
        ],
      },
    ],
  },
  {
    id: 'learn',
    label: 'Learn',
    columns: [
      {
        title: 'Learn',
        icon: 'overview.svg',
        links: [
          { label: 'Document Guide', to: '/document-guide' },
          { label: 'Partner Banks', to: '/partner-banks' },
          topic('Aadhaar Card'),
          topic('PAN Card'),
          topic('PPF (Public Provident Fund)'),
          topic('EPF (Employee Provident Fund)'),
          topic('Income Tax'),
          topic('FAQs'),
        ],
      },
      {
        title: 'Insurance and Investments',
        icon: 'secure.svg',
        links: [
          topic('Health Insurance'),
          topic('Term Life Insurance'),
          topic('Car Insurance'),
          topic('Investment Plan'),
          topic('NPS (National Pension Scheme)'),
          topic('Retirement Plans'),
        ],
      },
    ],
  },
]

// ---- Flat index used by /explore/:slug --------------------------------------

export interface TopicEntry {
  slug: string
  label: string
  menu: string
  group: string
  siblings: NavLinkItem[]
}

const index = new Map<string, TopicEntry>()

const visit = (menu: NavMenu, columns: NavColumn[]) => {
  for (const col of columns) {
    for (const link of col.links) {
      if (!link.to.startsWith('/explore/')) continue
      const slug = link.to.replace('/explore/', '')
      if (!index.has(slug)) {
        index.set(slug, {
          slug,
          label: link.label,
          menu: menu.label,
          group: col.title,
          siblings: col.links.filter((l) => l.to !== link.to),
        })
      }
    }
  }
}

for (const menu of NAV_MENUS) {
  if (menu.columns) visit(menu, menu.columns)
  menu.tabs?.forEach((tab) => visit({ ...menu, label: tab.label }, tab.columns))
}

export const findTopic = (slug: string) => index.get(slug)
export const allTopics = () => Array.from(index.values())

export const MOBILE_SHORTCUTS: { label: string; icon: string; to: string }[] = [
  { label: 'Credit Score', icon: 'credit-score.svg', to: '/cibil-check' },
  { label: 'Personal Loan', icon: 'personal_loan.svg', to: '/loans/personal-loan' },
  { label: 'Credit Cards', icon: 'credit_cards.svg', to: '/explore/credit-card' },
  { label: 'Business Loan', icon: 'business_loan.svg', to: '/loans/business-loan' },
  { label: 'Home Loan', icon: 'home_loan.svg', to: '/loans/home-loan' },
  { label: 'Bonds', icon: 'bonds_icon.svg', to: '/explore/bonds' },
  { label: 'Fixed Deposit', icon: 'fixed_deposit.svg', to: '/explore/fixed-deposit' },
  { label: 'Mutual Funds', icon: 'mutual_funds.svg', to: '/explore/invest-in-mutual-funds' },
  { label: 'Calculators', icon: 'calculators_icon.svg', to: '/calculators' },
  { label: 'Other Loans', icon: 'other_loans.svg', to: '/loans' },
]
