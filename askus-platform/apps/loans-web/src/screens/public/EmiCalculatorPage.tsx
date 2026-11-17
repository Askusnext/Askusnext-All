import React from 'react'
import { Calculator } from 'lucide-react'
import { EmiCalculator } from '../../components/common/EmiCalculator'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { AuthModal } from '../../components/auth/AuthModal'

export const EmiCalculatorPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
      <Navbar />
      <AuthModal />

      {/* Header */}
      <section className="bg-slate-900 text-white py-14 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1 border border-blue-400/30">
              <Calculator size={14} />
              <span>Standard Reducing Balance Method</span>
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Personal Loan & EMI Calculator
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Calculate your precise monthly reducing-balance EMI, overall interest liability, and full amortization schedule across any principal and tenure.
            </p>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-24 space-y-12">
        <EmiCalculator initialAmount={0} initialRate={10.5} initialTenure={4} />

        {/* Informative Guidance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-900 text-sm">Reducing Balance Formula</h3>
            <p className="leading-relaxed">
              Unlike flat-rate loans where interest is calculated on the initial principal throughout, reducing-balance EMIs recompute interest monthly on your remaining outstanding principal.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-900 text-sm">Tenure vs Interest Tradeoff</h3>
            <p className="leading-relaxed">
              Longer tenures reduce your monthly installment but increase the total interest paid over the life of the loan. Choose an EMI that does not exceed 40-50% of your net monthly income.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-900 text-sm">Zero Upfront Surprise</h3>
            <p className="leading-relaxed">
              Always review the one-time processing fee and GST quoted by the lending bank before signing the sanction agreement. Askus Fin charges zero upfront advisory fees.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
