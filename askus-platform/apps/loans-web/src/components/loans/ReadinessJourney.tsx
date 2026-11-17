import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft, ArrowRight, CheckCircle2, Info, X } from 'lucide-react'
import type { LoanProduct } from '../../constants/loanProducts'
import { calculateEMI } from '../../utils/emiCalculator'
import { formatINR } from '../../utils/formatters'
import { applyLink } from '../../utils/loanLinks'
import { formatTenure } from '../../utils/loanFormat'

interface Props {
  product: LoanProduct
  amount: number
  months: number
  rate: number
  onClose: () => void
}

interface FormValues {
  purpose: string
  employment: string
  monthlyIncome: string
  existingEmi: string
  age: string
}

const PURPOSES = ['Medical', 'Wedding', 'Travel', 'Home / property', 'Business', 'Education', 'Debt consolidation', 'Other']
const EMPLOYMENT = [
  { v: 'salaried', l: 'Salaried' },
  { v: 'self-employed', l: 'Self employed' },
  { v: 'professional', l: 'Self employed professional' },
  { v: 'other', l: 'Other' },
]

// Share of monthly income that may go to total EMIs for this indicative check.
const MAX_OBLIGATION_RATIO = 0.5

/**
 * Local-only readiness check. Nothing here is sent anywhere or stored; it never
 * contacts a lender or credit bureau. The final step hands off to the existing
 * application wizard (when the product is supported) or to calculators.
 */
export const ReadinessJourney: React.FC<Props> = ({ product, amount, months, rate, onClose }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [result, setResult] = useState<{ income: number; existing: number; affordable: number; requested: number; within: boolean } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { purpose: '', employment: '', monthlyIncome: '', existingEmi: '0', age: '' }, mode: 'onTouched' })

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus()
    }
  }, [onClose])

  const next = async () => {
    if (step === 1 && (await trigger(['purpose', 'employment']))) setStep(2)
  }

  const onSubmit = (v: FormValues) => {
    const income = Number(v.monthlyIncome)
    const existing = Number(v.existingEmi) || 0
    const affordable = Math.max(0, income * MAX_OBLIGATION_RATIO - existing)
    const requested = calculateEMI(amount, rate, months / 12).monthlyEmi
    setResult({ income, existing, affordable, requested, within: requested <= affordable })
    setStep(3)
  }

  const href = applyLink(product, amount, months)
  const field = 'w-full rounded-xl border border-[#e4e4e3] px-3.5 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none focus:ring-2 focus:ring-[#d9e8ff]'
  const err = (m?: string) => (m ? <p role="alert" className="mt-1 text-[11px] text-rose-600">{m}</p> : null)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${product.title} readiness check`} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl outline-none sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0066ff]">Step {step} of 3</p>
            <h2 className="text-lg font-semibold text-[#052f5f]">{product.title} readiness check</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="mb-5 flex gap-1.5">{[1, 2, 3].map((n) => <span key={n} className={`h-1 flex-1 rounded-full ${n <= step ? 'bg-[#0066ff]' : 'bg-[#e4e4e3]'}`} />)}</div>

        <p className="mb-4 rounded-xl bg-[#f7f8fa] px-3 py-2 text-xs text-slate-600">
          Planning {formatINR(amount)} over {formatTenure(months)} at an assumed {rate}% p.a. Answers stay in your browser — nothing is submitted or stored.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="rj-purpose">Purpose of loan</label>
                <select id="rj-purpose" className={field} {...register('purpose', { required: 'Select a purpose' })}>
                  <option value="">Select…</option>
                  {PURPOSES.map((p) => <option key={p}>{p}</option>)}
                </select>
                {err(errors.purpose?.message)}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="rj-emp">Employment type</label>
                <select id="rj-emp" className={field} {...register('employment', { required: 'Select employment type' })}>
                  <option value="">Select…</option>
                  {EMPLOYMENT.map((e) => <option key={e.v} value={e.v}>{e.l}</option>)}
                </select>
                {err(errors.employment?.message)}
              </div>
              <button type="button" onClick={next} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0066ff] py-3 text-sm font-semibold text-white hover:bg-[#0052cc]">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="rj-age">Age (years)</label>
                <input id="rj-age" inputMode="numeric" className={field} {...register('age', { required: 'Enter your age', validate: (v) => (Number(v) >= 18 && Number(v) <= 75) || 'Enter an age between 18 and 75' })} />
                {err(errors.age?.message)}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="rj-income">Monthly income (₹)</label>
                <input id="rj-income" inputMode="numeric" className={field} {...register('monthlyIncome', { required: 'Enter your monthly income', validate: (v) => (Number(v) >= 1000 && Number(v) <= 100000000) || 'Enter a valid monthly income' })} />
                {err(errors.monthlyIncome?.message)}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="rj-emi">Existing monthly EMIs (₹)</label>
                <input id="rj-emi" inputMode="numeric" className={field} {...register('existingEmi', { validate: (v) => v === '' || (Number(v) >= 0 && Number.isFinite(Number(v))) || 'Enter a valid amount' })} />
                {err(errors.existingEmi?.message)}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1.5 rounded-full border border-[#e4e4e3] px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="submit" className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#0066ff] py-3 text-sm font-semibold text-white hover:bg-[#0052cc]">
                  See result <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </form>

        {step === 3 && result && (
          <div className="space-y-4">
            <div className={`rounded-2xl p-4 ${result.within ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                {result.within ? <CheckCircle2 size={18} /> : <Info size={18} />}
                {result.within ? 'Within the indicative range' : 'Above the indicative range'}
              </p>
              <p className="mt-1 text-xs leading-relaxed">
                {result.within
                  ? 'Your planned EMI fits inside the rule-of-thumb obligation limit used here.'
                  : 'Your planned EMI is higher than the rule-of-thumb limit. Consider a smaller amount or a longer tenure.'}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-[#f7f8fa] p-3"><dt className="text-slate-500">Planned EMI</dt><dd className="text-sm font-semibold text-[#052f5f]">{formatINR(result.requested)}</dd></div>
              <div className="rounded-xl bg-[#f7f8fa] p-3"><dt className="text-slate-500">Indicative EMI room</dt><dd className="text-sm font-semibold text-[#052f5f]">{formatINR(Math.round(result.affordable))}</dd></div>
            </dl>
            <p className="text-[11px] leading-relaxed text-slate-500">
              This uses a simple rule: total EMIs up to {MAX_OBLIGATION_RATIO * 100}% of monthly income. Real lenders apply their own policies, credit history checks and documents. It is not an offer, approval or credit decision.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {href ? (
                <Link to={href} onClick={onClose} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#0066ff] py-3 text-sm font-semibold text-white hover:bg-[#0052cc]">
                  Continue to application <ArrowRight size={16} />
                </Link>
              ) : (
                <Link to="/partner-banks" onClick={onClose} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#0066ff] py-3 text-sm font-semibold text-white hover:bg-[#0052cc]">
                  Review lender sources <ArrowRight size={16} />
                </Link>
              )}
              <button type="button" onClick={onClose} className="rounded-full border border-[#e4e4e3] px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Close
              </button>
            </div>
            {!href && <p className="text-[11px] text-slate-500">Applications for this product are not accepted here yet.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
