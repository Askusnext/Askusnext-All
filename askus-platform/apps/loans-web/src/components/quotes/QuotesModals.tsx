import React, { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { QuotesModal } from './QuotesModal'
import { SortOptions } from './QuotesControls'
import type { SortKey } from '../../constants/quotesData'
import { formatAmountLabel, formatRoi, formatRupee, type PricedLender } from '../../utils/quotes'

const primary = 'rounded-lg bg-[#0066ff] px-6 py-2.5 font-poppins text-[14px] font-semibold text-white hover:bg-[#0052cc] disabled:opacity-50'
const input = 'w-full rounded-lg border border-[#E4E4E3] px-3 py-2.5 font-poppins text-[14px] text-[#1C1D1F] focus:border-[#0066ff] focus:outline-none focus:ring-2 focus:ring-[#d9e8ff]'

interface EditValueProps {
  kind: 'amount' | 'tenure'
  value: number
  min: number
  max: number
  step: number
  presets: number[]
  onApply: (v: number) => void
  onClose: () => void
}

export const EditValueModal: React.FC<EditValueProps> = ({ kind, value, min, max, step, presets, onApply, onClose }) => {
  const [v, setV] = useState(value)
  const fmt = (n: number) => (kind === 'amount' ? formatAmountLabel(n) : `${n} Months`)
  const pct = ((v - min) / (max - min)) * 100
  return (
    <QuotesModal title={kind === 'amount' ? 'Loan Amount' : 'Tenure'} onClose={onClose}>
      <p className="font-poppins text-[22px] font-semibold text-[#1C1D1F]">{fmt(v)}</p>
      <input
        aria-label={kind === 'amount' ? 'Loan amount' : 'Tenure in months'}
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        style={{ background: `linear-gradient(to right,#0066ff ${pct}%,#e4e4e3 ${pct}%)` }}
        className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#0066ff]"
      />
      <div className="mt-1 flex justify-between font-poppins text-[11px] text-[#8F9194]">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p} type="button" onClick={() => setV(p)} className={`rounded-full border px-3 py-1 font-poppins text-[12px] font-medium ${v === p ? 'border-[#0066ff] bg-[#f2f7ff] text-[#0066ff]' : 'border-[#E4E4E3] text-[#373A3E]'}`}>
            {fmt(p)}
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <button type="button" className={primary} onClick={() => { onApply(v); onClose() }}>Apply</button>
      </div>
    </QuotesModal>
  )
}

export const KfsModal: React.FC<{ lender: PricedLender; amount: number; months: number; onClose: () => void }> = ({ lender, amount, months, onClose }) => {
  const principal = Math.min(amount, lender.maxAmount)
  const total = lender.emi * months
  const interest = Math.max(0, total - principal)
  const fee = Math.round(principal * 0.02)
  const rows: [string, string][] = [
    ['Loan amount', formatRupee(principal)],
    ['Interest rate (ROI)', formatRoi(lender.roi)],
    ['Tenure', `${months} months`],
    ['Monthly EMI', formatRupee(lender.emi)],
    ['Total interest', formatRupee(interest)],
    ['Total payable', formatRupee(total)],
    ['Processing fee (sample 2%)', formatRupee(fee)],
    ['Prepayment / foreclosure', 'Set by lender'],
  ]
  return (
    <QuotesModal title={`Provisional KFS & Charges — ${lender.name}`} onClose={onClose}>
      <p className="mb-3 rounded-lg bg-[#FFF7F2] p-2.5 font-poppins text-[11px] text-[#995C00]">Sample figures for demonstration. A real Key Fact Statement comes from the lender.</p>
      <dl className="divide-y divide-[#F0F0EF] font-poppins text-[13px]">
        {rows.map(([k, val]) => (
          <div key={k} className="flex justify-between gap-4 py-2">
            <dt className="text-[#6A6D71]">{k}</dt>
            <dd className="font-semibold text-[#1C1D1F]">{val}</dd>
          </div>
        ))}
      </dl>
    </QuotesModal>
  )
}

export const SortSheet: React.FC<{ value: SortKey; onChange: (k: SortKey) => void; onClose: () => void }> = ({ value, onChange, onClose }) => (
  <QuotesModal title="Sort by" onClose={onClose}>
    <SortOptions value={value} onChange={(k) => { onChange(k); onClose() }} labelledBy="sort-sheet-title" />
    <span id="sort-sheet-title" className="sr-only">Sort by</span>
  </QuotesModal>
)

export const CallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [done, setDone] = useState(false)
  const phoneOk = /^[6-9]\d{9}$/.test(phone)
  const nameOk = name.trim().length >= 2
  const [touched, setTouched] = useState(false)
  return (
    <QuotesModal title="Request a Call" onClose={onClose}>
      {done ? (
        <div className="py-4 text-center font-poppins">
          <CheckCircle2 className="mx-auto text-[#24B24A]" size={40} />
          <p className="mt-3 text-[14px] font-semibold text-[#052F5F]">Thanks, {name.trim()}!</p>
          <p className="mt-1 text-[12px] text-[#6A6D71]">This is a demo, so no request was sent and nothing was stored.</p>
          <button type="button" onClick={onClose} className={`${primary} mt-5`}>Close</button>
        </div>
      ) : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); if (nameOk && phoneOk) setDone(true) }} className="space-y-4">
          <p className="rounded-lg bg-[#F7F8FA] p-2.5 font-poppins text-[11px] text-[#6A6D71]">Demo only. Do not enter real details; nothing is sent.</p>
          <label className="block font-poppins text-[12px] font-medium text-[#6A6D71]">
            Name
            <input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            {touched && !nameOk && <span role="alert" className="text-[11px] text-rose-600">Enter your name.</span>}
          </label>
          <label className="block font-poppins text-[12px] font-medium text-[#6A6D71]">
            Mobile number
            <input className={`${input} mt-1`} inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit number" />
            {touched && !phoneOk && <span role="alert" className="text-[11px] text-rose-600">Enter a valid 10-digit mobile number.</span>}
          </label>
          <div className="flex justify-end"><button type="submit" className={primary}>Request call</button></div>
        </form>
      )}
    </QuotesModal>
  )
}
