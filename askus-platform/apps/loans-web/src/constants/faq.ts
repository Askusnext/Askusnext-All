export interface FaqItem {
  question: string
  answer: string
  category: 'general' | 'documents' | 'cash_salary' | 'loans'
}

export const FAQS: FaqItem[] = [
  {
    category: 'general',
    question: 'What is Askus Financial Services and how does it work?',
    answer: 'Askus Financial Services provides lender reference links and an application workflow. Current lender terms must be checked directly with the lender. Application assistance does not guarantee eligibility, approval, or disbursal.'
  },
  {
    category: 'cash_salary',
    question: 'Can I get a personal loan if I receive my salary in cash?',
    answer: 'Cash salary acceptance and required evidence depend on the lender and product. Confirm directly with the lender before applying and submit only authentic documents. Askus Financial Services cannot promise approval.'
  },
  {
    category: 'documents',
    question: 'What documents are required for salaried applicants receiving salary in a bank account?',
    answer: 'Document requirements vary by lender, product, and applicant. Use the lender’s official information source to confirm its current checklist.'
  },
  {
    category: 'general',
    question: 'Does using Askus Financial Services or checking my CIBIL score harm my credit score?',
    answer: 'The EMI calculator does not request a credit report. Askus Financial Services does not currently provide a bureau check. Use the bureau’s official channel to access your report and ask the lender how its application process affects your credit file.'
  },
  {
    category: 'loans',
    question: 'What is the reducing-balance EMI method used on Askus Financial Services?',
    answer: 'The calculator estimates installments using a reducing-balance formula and an illustrative rate. It is not a lender quote or approval decision. The lender sets the actual rate, fees, and repayment schedule.'
  },
  {
    category: 'general',
    question: 'Why is mobile OTP verification mandatory on Askus Financial Services?',
    answer: 'Customer routes require a mobile number verified with a one-time code (OTP). Google and WhatsApp sign-in are not available.'
  },
  {
    category: 'loans',
    question: 'Does Askus Financial Services charge any upfront fee for loan assistance?',
    answer: 'Askus Financial Services does not currently collect payments through this website. Lender fees and taxes, if any, are set by the lender and must be confirmed in its official terms.'
  },
  {
    category: 'loans',
    question: 'How fast can I get a personal loan disbursed?',
    answer: 'Processing and disbursal times are determined by the lender and depend on its checks. Ask the selected lender for a current estimate.'
  }
]
