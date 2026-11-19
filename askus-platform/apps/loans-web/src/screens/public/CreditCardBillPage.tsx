import React, { useState } from 'react'
import {
  Receipt,
  Lock
} from 'lucide-react'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { AuthModal } from '../../components/auth/AuthModal'
import { formatINR } from '../../utils/formatters'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export const CreditCardBillPage: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useAuth()
  const { showToast } = useToast()

  const [cardNumber, setCardNumber] = useState('')
  const [billAmount, setBillAmount] = useState<number>(0)
  const [cardIssuer, setCardIssuer] = useState('HDFC Bank')

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      showToast({
        type: 'info',
        title: 'Authentication Required',
        message: 'Sign in with your verified mobile number to settle card bills.'
      })
      openAuthModal('phone')
      return
    }

    showToast({
      type: 'info',
      title: 'BBPS Gateway Integration Notice',
      message: 'Credit card bill payment routes through Bharat Bill Payment System (BBPS) API. Direct settlement is initiated upon connecting BBPS agent credentials in your environment configuration.'
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
      <Navbar />
      <AuthModal />

      {/* Header */}
      <section className="bg-slate-900 text-white py-14 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 border border-emerald-400/30">
              <Receipt size={14} />
              <span>Payment unavailable</span>
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Credit Card Bill Payment
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Credit card bill payment is not available through Askus Financial Services. Use your card issuer’s official payment channel.
            </p>
          </div>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-24 space-y-8">
        <div className="rounded-3xl bg-white border border-slate-200 p-7 sm:p-10 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Card Payment Details</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                This page does not connect to a payment provider.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Unavailable
            </span>
          </div>

          <form onSubmit={handlePay} className="space-y-5">
            <fieldset disabled className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Card Issuer *
                </label>
                <select
                  value={cardIssuer}
                  onChange={(e) => setCardIssuer(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="HDFC Bank">HDFC Bank Credit Card</option>
                  <option value="SBI Card">SBI Card</option>
                  <option value="ICICI Bank">ICICI Bank Credit Card</option>
                  <option value="Axis Bank">Axis Bank Credit Card</option>
                  <option value="Kotak Mahindra">Kotak Mahindra Bank</option>
                  <option value="IndusInd Bank">IndusInd Bank</option>
                  <option value="RBL Bank">RBL Bank</option>
                  <option value="Standard Chartered">Standard Chartered</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  16-Digit Card Number *
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  placeholder="1234 5678 9876 5432"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-mono font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Bill Payment Amount (₹) *
              </label>
              <input
                type="number"
                required
                min={100}
                value={billAmount || ''}
                onChange={(e) => setBillAmount(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-base font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Card Bill Due:</span>
                <span className="font-bold text-slate-900">{formatINR(billAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Convenience Fee:</span>
                <span className="font-bold text-slate-500">Not quoted</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Payable Amount:</span>
                <span className="text-sm text-slate-500">Not available</span>
              </div>
            </div>

            <button
              type="button"
              disabled
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition active:scale-98"
            >
              <Lock size={16} />
              <span>Payment unavailable</span>
            </button>
            </fieldset>
          </form>

          <div className="rounded-xl bg-slate-100 p-3 text-[11px] text-slate-500 text-center">
            No BBPS or Razorpay payment integration is currently connected. No payment details are accepted here.
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
