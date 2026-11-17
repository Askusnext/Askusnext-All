import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardCheck } from 'lucide-react'
import type { LoanProduct } from '../../constants/loanProducts'
import { calculateEMI } from '../../utils/emiCalculator'
import { formatINR } from '../../utils/formatters'
import { SliderField } from './SliderField'
import { formatLakhCrore, formatTenure } from '../../utils/loanFormat'
import { ReadinessJourney } from './ReadinessJourney'
import { applyLink } from '../../utils/loanLinks'

interface LoanPlannerProps {
  product: LoanProduct
  initialAmount?: number
  compact?: boolean
}

/** Amount + tenure selection with a live EMI estimate and the readiness journey. */
export const LoanPlanner: React.FC<LoanPlannerProps> = ({ product, initialAmount, compact }) => {
  const p = product.planning
  const clamp = (v: number) => Math.min(p.max, Math.max(p.min, v))
  const [amount, setAmount] = useState(clamp(initialAmount ?? p.defaultAmount))
  const [months, setMonths] = useState(p.defaultMonths)
  const [rate, setRate] = useState(product.illustrativeRate)
  const [journeyOpen, setJourneyOpen] = useState(false)

  const emi = useMemo(() => calculateEMI(amount, rate, months / 12), [amount, rate, months])
  const href = applyLink(product, amount, months)

  const tenurePresets = [p.minMonths, p.defaultMonths, p.maxMonths]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((v) => ({ label: formatTenure(v), value: v }))

  return (
    <div className="rounded-2xl border border-[#e4e4e3] bg-white p-5 shadow-[0_10px_30px_-12px_rgba(5,47,95,0.25)] sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <img src={`/assets/pb/${product.icon}`} alt="" width={32} height={32} />
        <div>
          <h3 className="text-base font-semibold text-[#052f5f]">Plan your {product.title}</h3>
          <p className="text-[11px] text-slate-500">Indicative only — the lender sets the final terms.</p>
        </div>
      </div>

      <div className="space-y-5">
        <SliderField label="Loan amount" value={amount} min={p.min} max={p.max} step={p.step} onChange={setAmount} format={formatLakhCrore} />
        <SliderField label="Tenure" value={months} min={p.minMonths} max={p.maxMonths} step={compact ? 6 : 1} onChange={setMonths} format={formatTenure} presets={tenurePresets} />
        <div>
          <label htmlFor={`rate-${product.slug}`} className="mb-1 block text-xs font-medium text-slate-600">
            Assumed interest rate (% p.a.) — editable
          </label>
          <input
            id={`rate-${product.slug}`}
            type="number"
            min={1}
            max={40}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Math.min(40, Math.max(0, Number(e.target.value) || 0)))}
            className="w-28 rounded-lg border border-[#e4e4e3] px-3 py-1.5 text-sm focus:border-[#0066ff] focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-[#f2f7ff] p-3 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Monthly EMI</p>
          <p className="text-base font-bold text-[#052f5f]">{formatINR(emi.monthlyEmi)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Total interest</p>
          <p className="text-sm font-semibold text-slate-700">{formatINR(emi.totalInterest)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Total payable</p>
          <p className="text-sm font-semibold text-slate-700">{formatINR(emi.totalRepayment)}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setJourneyOpen(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#0066ff] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0052cc]"
        >
          <ClipboardCheck size={16} /> Check readiness
        </button>
        {href && (
          <Link to={href} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#0066ff] px-5 py-3 text-sm font-semibold text-[#0066ff] transition hover:bg-[#f2f7ff]">
            Start application <ArrowRight size={16} />
          </Link>
        )}
      </div>

      {journeyOpen && <ReadinessJourney product={product} amount={amount} months={months} rate={rate} onClose={() => setJourneyOpen(false)} />}
    </div>
  )
}
