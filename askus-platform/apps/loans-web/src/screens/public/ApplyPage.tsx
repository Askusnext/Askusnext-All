import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApplicationWizard } from '../../components/applications/ApplicationWizard'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { AuthModal } from '../../components/auth/AuthModal'

export const ApplyPage: React.FC = () => {
  const [searchParams] = useSearchParams()

  const serviceId = searchParams.get('service') || 'personal-loan'
  const lenderId = searchParams.get('lender') || 'hdfc-bank'
  const amountParam = searchParams.get('amount')
  const parsedAmount = amountParam === null ? 0 : Number(amountParam)
  const amount = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0
  const tenure = Number(searchParams.get('tenure')) || 36

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
      <Navbar />
      <AuthModal />

      {/* Header */}
      <section className="bg-slate-900 text-white py-10 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest block">
              Multi-Step Application System
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Personal Loan Assistance Application
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Complete your personal, employment, and document requirements. Progress is automatically saved as draft.
            </p>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <ApplicationWizard
          initialServiceId={serviceId}
          initialLenderId={lenderId}
          initialAmount={amount}
          initialTenureMonths={tenure}
        />
      </main>

      <Footer />
    </div>
  )
}
