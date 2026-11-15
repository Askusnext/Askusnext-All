import React, { useState } from 'react'
import {
  ArrowLeftRight,
  AlertTriangle,
  Lock
} from 'lucide-react'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { AuthModal } from '../../components/auth/AuthModal'
import { formatINR } from '../../utils/formatters'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export const CreditCardCashPage: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useAuth()
  const { showToast } = useToast()

  const [transferAmount, setTransferAmount] = useState<number>(0)
  const [beneficiaryUpiOrAccount, setBeneficiaryUpiOrAccount] = useState('')
  const [cardLast4, setCardLast4] = useState('')


  const handleInitiate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      showToast({
        type: 'info',
        title: 'Authentication Required',
        message: 'Please complete verified mobile sign-in before initiating transfer.'
      })
      openAuthModal('phone')
      return
    }

    // Honest Integration Notice as per prompt requirement
    showToast({
      type: 'info',
      title: 'Payment Gateway Integration Notice',
      message: 'Card-to-Bank transfer requires an active production merchant gateway (e.g. Razorpay/Cashfree/PayU) with BBPS authorization. Connect the gateway credentials in the server configuration.'
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
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 border border-amber-400/30">
              <ArrowLeftRight size={14} />
              <span>Assisted Card Liquidity Service</span>
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Credit Card Cash Transfer
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Explore card-to-bank liquidity and emergency funding assistance through verified payment aggregator channels at transparent convenience charges.
            </p>
          </div>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-24 space-y-8">
        {/* Compliance Notice Card */}
        <div className="rounded-2xl bg-amber-50 border border-amber-300 p-5 flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-950 block mb-1">
              Important Regulatory & Integration Policy:
            </strong>
            No payment gateway or transfer service is connected. Do not enter card, bank, or beneficiary details.
          </div>
        </div>

        {/* Transfer Form Card */}
        <div className="rounded-3xl bg-white border border-slate-200 p-7 sm:p-10 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Transfer Parameters</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                No transfer or payment processing is available.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Unavailable
            </span>
          </div>

          <form onSubmit={handleInitiate} className="space-y-5">
            <fieldset disabled className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Transfer Amount (₹) *
                </label>
                <input
                  type="number"
                  min={1000}
                  max={500000}
                  step={1000}
                  value={transferAmount || ''}
                  onChange={(e) => setTransferAmount(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-base font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Card Last 4 Digits
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="e.g. 4812"
                  value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-base font-mono font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Destination UPI ID or Bank Account *
              </label>
              <input
                type="text"
                required
                value={beneficiaryUpiOrAccount}
                onChange={(e) => setBeneficiaryUpiOrAccount(e.target.value)}
                placeholder="e.g. yourname@okhdfcbank or 50100234567890"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Fee Breakdown Box */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Principal Cash Amount:</span>
                <span className="font-bold text-slate-800">{formatINR(transferAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Service charge:</span>
                <span className="font-bold text-slate-500">Not configured</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Settlement Speed:</span>
                <span className="font-bold text-slate-500">Unavailable</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Total Card Charge:</span>
                <span className="text-sm text-slate-500">Unavailable</span>
              </div>
            </div>

            <button
              type="button"
              disabled
              className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-amber-600/25 flex items-center justify-center gap-2 transition active:scale-98"
            >
              <Lock size={16} />
              <span>Transfer unavailable</span>
            </button>
            </fieldset>
          </form>

          {/* Integration Status Footer */}
          <div className="rounded-xl bg-slate-100 p-3 text-[11px] text-slate-500 text-center">
            Payment processing is not connected. No card, bank or beneficiary details are accepted here.
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
