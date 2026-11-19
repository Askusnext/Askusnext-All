import React, { useEffect, useRef, useState } from 'react'
import { Check, FileText, Loader2, ShieldCheck, UserSearch, X } from 'lucide-react'
import type { QuoteLender } from '../../constants/quotesData'

const REASONS = [
  'To verify your information',
  'To assess your loan eligibility',
  'To process and disburse your loan',
  'To offer you relevant loan products',
]

interface ConsentModalProps {
  lender: QuoteLender
  loading: boolean
  error?: string
  onAgree: () => void
  onClose: () => void
}

/**
 * Consent dialog shown before the application is submitted. "I Agree & Continue"
 * stays disabled until the customer ticks the consent box.
 */
export const ConsentModal: React.FC<ConsentModalProps> = ({ lender, loading, error, onAgree, onClose }) => {
  const [agreed, setAgreed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !loading && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus()
    }
  }, [onClose, loading])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && !loading && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className="relative max-h-[94dvh] w-full max-w-[460px] overflow-y-auto rounded-[20px] bg-white px-5 pb-5 pt-8 font-poppins shadow-2xl outline-none sm:px-6"
      >
        <button type="button" aria-label="Close" disabled={loading} onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 text-[#45484D] hover:bg-[#F5F5F5] disabled:opacity-40">
          <X size={20} />
        </button>

        <div className="flex items-center justify-center gap-2">
          <img alt={lender.name} className="h-9 w-auto max-w-[180px] object-contain" src={`/assets/images/lenders/${lender.logo}.png`} />
          <span className="text-[16px] font-semibold text-[#052F5F]">{lender.name}</span>
        </div>

        <h2 id="consent-title" className="mt-5 text-center text-[20px] font-semibold leading-7 text-[#1C1D1F]">Your Consent is Important</h2>
        <p className="mt-2 text-center text-[13px] leading-5 text-[#45484D]">
          To proceed with your loan application, we need your consent to collect, process and share your data with the lender you chose.
        </p>

        <div className="mt-4 rounded-2xl bg-[#F2F7FF] p-4">
          <h3 className="text-[14px] font-semibold text-[#1C1D1F]">Why do we need your consent?</h3>
          <div className="mt-3 flex items-center gap-3">
            <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white text-[#0066FF] shadow-sm">
              <ShieldCheck size={34} />
              <FileText size={18} className="absolute bottom-1.5 left-1.5 text-[#7EB6FF]" />
            </span>
            <ul className="min-w-0 space-y-2">
              {REASONS.map((r) => (
                <li key={r} className="flex items-center gap-2 text-[13px] text-[#1C1D1F]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#14803F] text-white"><Check size={12} strokeWidth={3.5} /></span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-4 text-[13px] text-[#6A6D71]">Your data will be shared with</p>
        <div className="mt-2 flex items-start gap-3 rounded-xl border border-[#E4E4E3] p-3">
          <img alt="" className="mt-0.5 h-8 w-8 shrink-0 object-contain" src={`/assets/images/lenders/${lender.logo}.png`} />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#1C1D1F]">{lender.name}</p>
            <p className="text-[12px] leading-[18px] text-[#6A6D71]">Your data will be shared only for the purpose of processing your loan application with {lender.name}.</p>
          </div>
        </div>

        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[#E4E4E3] p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#0066FF]"><UserSearch size={18} /></span>
          <span className="min-w-0 flex-1 text-[13px] leading-5 text-[#1C1D1F]">
            By ticking this box, I confirm that I have read and agree to the Askus Financial Services <a href="#terms" className="text-[#0066FF] hover:underline">Terms of Use</a> &amp; <a href="#privacy" className="text-[#0066FF] hover:underline">Privacy Policy</a>, and I consent to Askus Financial Services collecting my details and uploaded documents and sharing them with {lender.name} to process this application.
          </span>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#0066FF]" aria-label="I agree to the terms and consent to share my data" />
        </label>

        <p className="mt-3 flex items-start gap-2 text-[12px] leading-[18px] text-[#6A6D71]">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#14803F]" />
          Your documents are stored privately and your details are shared only with the lender you chose, for this application.
        </p>

        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2.5 text-[12px] text-rose-700">{error}</p>}

        <button
          type="button"
          disabled={!agreed || loading}
          onClick={onAgree}
          className={`mt-4 flex h-[48px] w-full items-center justify-center gap-2 rounded-lg text-[16px] font-medium transition ${
            agreed && !loading ? 'bg-[#0066ff] text-white hover:bg-[#0052cc]' : 'cursor-not-allowed bg-[#E4E6EA] text-[#6A6D71]'
          }`}
        >
          {loading && <Loader2 size={18} className="animate-spin" />} I Agree &amp; Continue
        </button>
      </div>
    </div>
  )
}
