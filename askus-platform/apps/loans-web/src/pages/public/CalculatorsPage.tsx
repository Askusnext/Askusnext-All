import React, { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PageShell, Breadcrumbs } from '../../components/layout/PageShell'
import { EmiCalculator } from '../../components/common/EmiCalculator'
import { SliderField } from '../../components/loans/SliderField'
import { formatLakhCrore } from '../../utils/loanFormat'
import { CALCULATORS, findCalculator, type CalculatorDef } from '../../constants/calculators'
import { formatINR } from '../../utils/formatters'

const Stat: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="rounded-xl bg-[#f2f7ff] p-4">
    <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-1 ${strong ? 'text-2xl font-bold text-[#052f5f]' : 'text-lg font-semibold text-slate-800'}`}>{value}</p>
  </div>
)

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid gap-8 rounded-2xl border border-[#e4e4e3] bg-white p-5 shadow-sm sm:p-8 lg:grid-cols-2">{children}</div>
)

const EligibilityCalc: React.FC<{ def: CalculatorDef }> = ({ def }) => {
  const [income, setIncome] = useState(def.defaults.amount)
  const [existing, setExisting] = useState(0)
  const [rate, setRate] = useState(def.defaults.rate)
  const [years, setYears] = useState(def.defaults.years)
  const [ratio, setRatio] = useState(50)

  const out = useMemo(() => {
    const room = Math.max(0, (income * ratio) / 100 - existing)
    const r = rate / 12 / 100
    const n = years * 12
    const principal = r === 0 ? room * n : (room * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n))
    return { room, principal: Math.round(principal) }
  }, [income, existing, rate, years, ratio])

  return (
    <Card>
      <div className="space-y-6">
        <SliderField label="Monthly income" value={income} min={10000} max={1000000} step={5000} onChange={setIncome} format={formatLakhCrore} />
        <SliderField label="Existing monthly EMIs" value={existing} min={0} max={500000} step={1000} onChange={setExisting} format={formatLakhCrore} />
        <SliderField label="Assumed rate (% p.a.)" value={rate} min={5} max={30} step={0.1} onChange={setRate} format={(v) => `${v}%`} />
        <SliderField label="Tenure (years)" value={years} min={1} max={30} step={1} onChange={setYears} format={(v) => `${v} yr`} />
        <SliderField label="Max share of income for EMIs" value={ratio} min={30} max={60} step={5} onChange={setRatio} format={(v) => `${v}%`} />
      </div>
      <div className="space-y-4 self-center">
        <Stat label="Indicative loan amount" value={formatINR(out.principal)} strong />
        <Stat label="EMI room each month" value={formatINR(Math.round(out.room))} />
        <p className="text-xs leading-relaxed text-slate-500">A rule-of-thumb estimate from the values you enter. Lenders apply their own policies, credit checks and documents. Not an offer or approval.</p>
      </div>
    </Card>
  )
}

const SipCalc: React.FC<{ def: CalculatorDef }> = ({ def }) => {
  const [monthly, setMonthly] = useState(def.defaults.amount)
  const [rate, setRate] = useState(def.defaults.rate)
  const [years, setYears] = useState(def.defaults.years)
  const out = useMemo(() => {
    const r = rate / 12 / 100
    const n = years * 12
    const fv = r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r)
    const invested = monthly * n
    return { fv: Math.round(fv), invested, gain: Math.round(fv - invested) }
  }, [monthly, rate, years])
  return (
    <Card>
      <div className="space-y-6">
        <SliderField label="Monthly investment" value={monthly} min={500} max={200000} step={500} onChange={setMonthly} format={formatLakhCrore} />
        <SliderField label="Assumed annual return (%)" value={rate} min={1} max={30} step={0.5} onChange={setRate} format={(v) => `${v}%`} />
        <SliderField label="Period (years)" value={years} min={1} max={40} step={1} onChange={setYears} format={(v) => `${v} yr`} />
      </div>
      <div className="space-y-4 self-center">
        <Stat label="Projected value" value={formatINR(out.fv)} strong />
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Invested" value={formatINR(out.invested)} />
          <Stat label="Estimated gain" value={formatINR(out.gain)} />
        </div>
        <p className="text-xs text-slate-500">Returns are assumptions, not forecasts or guarantees. Market-linked investments can lose value.</p>
      </div>
    </Card>
  )
}

const FdCalc: React.FC<{ def: CalculatorDef }> = ({ def }) => {
  const [principal, setPrincipal] = useState(def.defaults.amount)
  const [rate, setRate] = useState(def.defaults.rate)
  const [years, setYears] = useState(def.defaults.years)
  const out = useMemo(() => {
    const maturity = principal * Math.pow(1 + rate / 400, 4 * years)
    return { maturity: Math.round(maturity), interest: Math.round(maturity - principal) }
  }, [principal, rate, years])
  return (
    <Card>
      <div className="space-y-6">
        <SliderField label="Deposit amount" value={principal} min={5000} max={10000000} step={5000} onChange={setPrincipal} format={formatLakhCrore} />
        <SliderField label="Interest rate (% p.a.)" value={rate} min={1} max={12} step={0.05} onChange={setRate} format={(v) => `${v}%`} />
        <SliderField label="Tenure (years)" value={years} min={1} max={10} step={1} onChange={setYears} format={(v) => `${v} yr`} />
      </div>
      <div className="space-y-4 self-center">
        <Stat label="Maturity value" value={formatINR(out.maturity)} strong />
        <Stat label="Interest earned" value={formatINR(out.interest)} />
        <p className="text-xs text-slate-500">Assumes quarterly compounding. Actual rates and payout rules depend on the bank.</p>
      </div>
    </Card>
  )
}

const GstCalc: React.FC<{ def: CalculatorDef }> = ({ def }) => {
  const [amount, setAmount] = useState(def.defaults.amount)
  const [rate, setRate] = useState(def.defaults.rate)
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const out = useMemo(() => {
    const base = mode === 'add' ? amount : amount / (1 + rate / 100)
    const gst = base * (rate / 100)
    return { base: Math.round(base * 100) / 100, gst: Math.round(gst * 100) / 100, total: Math.round((base + gst) * 100) / 100 }
  }, [amount, rate, mode])
  return (
    <Card>
      <div className="space-y-6">
        <div className="flex gap-2" role="radiogroup" aria-label="GST mode">
          {(['add', 'remove'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-full border px-4 py-1.5 text-xs font-medium ${mode === m ? 'border-[#0066ff] bg-[#f2f7ff] text-[#0066ff]' : 'border-[#e4e4e3] text-slate-600'}`}>
              {m === 'add' ? 'Add GST' : 'Remove GST'}
            </button>
          ))}
        </div>
        <SliderField label="Amount" value={amount} min={100} max={10000000} step={100} onChange={setAmount} format={formatLakhCrore} />
        <div className="flex flex-wrap gap-2">
          {[5, 12, 18, 28].map((r) => (
            <button key={r} type="button" onClick={() => setRate(r)} className={`rounded-full border px-4 py-1.5 text-xs font-medium ${rate === r ? 'border-[#0066ff] bg-[#f2f7ff] text-[#0066ff]' : 'border-[#e4e4e3] text-slate-600'}`}>{r}%</button>
          ))}
        </div>
      </div>
      <div className="space-y-4 self-center">
        <Stat label="Total" value={formatINR(out.total)} strong />
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Net amount" value={formatINR(out.base)} />
          <Stat label="GST" value={formatINR(out.gst)} />
        </div>
      </div>
    </Card>
  )
}

export const CalculatorPage: React.FC = () => {
  const { id = '' } = useParams()
  const def = findCalculator(id)
  if (!def) return <Navigate to="/calculators" replace />
  const related = CALCULATORS.filter((c) => c.id !== def.id && c.group === def.group).slice(0, 5)

  return (
    <PageShell>
      <section className="bg-gradient-to-b from-[#f2f7ff] to-white">
        <div className="mx-auto max-w-5xl px-4 pb-6 pt-10 sm:px-6">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Calculators', to: '/calculators' }, { label: def.title }]} />
          <h1 className="mt-4 text-3xl font-bold text-[#052f5f]">{def.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{def.blurb}</p>
        </div>
      </section>
      <div className="mx-auto max-w-5xl space-y-8 px-4 pb-16 sm:px-6">
        {def.kind === 'emi' && (
          <EmiCalculator key={def.id} initialAmount={def.defaults.amount} initialRate={def.defaults.rate} initialTenure={def.defaults.years} showApplyButton={false} />
        )}
        {def.kind === 'eligibility' && <EligibilityCalc def={def} />}
        {def.kind === 'sip' && <SipCalc def={def} />}
        {def.kind === 'fd' && <FdCalc def={def} />}
        {def.kind === 'gst' && <GstCalc def={def} />}

        {def.loanSlug && (
          <Link to={`/loans/${def.loanSlug}`} className="flex items-center justify-between rounded-2xl bg-[#052f5f] p-5 text-white hover:bg-[#0a3d78]">
            <span className="text-sm font-semibold">Plan this loan and check readiness →</span>
          </Link>
        )}
        {related.length > 0 && (
          <div>
            <h2 className="mb-3 text-base font-semibold text-[#052f5f]">Related calculators</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {related.map((r) => (
                <Link key={r.id} to={`/calculators/${r.id}`} className="rounded-xl border border-[#e4e4e3] px-4 py-2.5 text-sm hover:border-[#0066ff] hover:bg-[#f2f7ff]">{r.title}</Link>
              ))}
            </div>
          </div>
        )}
        <p className="text-[11px] text-slate-500">Results are estimates from the values you enter. They are not offers, advice or guarantees. Check calculated figures against lender documents.</p>
      </div>
    </PageShell>
  )
}

export const CalculatorsHubPage: React.FC = () => {
  const groups = Array.from(new Set(CALCULATORS.map((c) => c.group)))
  return (
    <PageShell>
      <section className="bg-gradient-to-b from-[#f2f7ff] to-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Calculators' }]} />
          <h1 className="mt-4 text-3xl font-bold text-[#052f5f] sm:text-4xl">Financial calculators</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Loan EMI, eligibility and investment calculators. All calculations run in your browser.</p>
        </div>
      </section>
      <div className="mx-auto max-w-7xl space-y-10 px-4 pb-16 sm:px-6">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="mb-3 text-base font-semibold text-[#052f5f]">{g} calculators</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CALCULATORS.filter((c) => c.group === g).map((c) => (
                <Link key={c.id} to={`/calculators/${c.id}`} className="group flex gap-3 rounded-2xl border border-[#e4e4e3] bg-white p-4 transition hover:border-[#0066ff] hover:shadow-md">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f2f7ff]"><img src={`/assets/pb/${c.icon}`} alt="" width={24} height={24} /></span>
                  <span>
                    <span className="block text-sm font-semibold text-[#052f5f]">{c.title}</span>
                    <span className="text-xs text-slate-500">{c.blurb}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  )
}
