import React, { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ChevronDown, FileText, ShieldCheck } from 'lucide-react'
import { PageShell, Breadcrumbs } from '../../components/layout/PageShell'
import { LoanPlanner } from '../../components/loans/LoanPlanner'
import { findLoanProduct, LOAN_PRODUCTS } from '../../constants/loanProducts'
import { findCalculator } from '../../constants/calculators'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'features', label: 'Features' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'documents', label: 'Documents' },
  { id: 'process', label: 'How it works' },
  { id: 'faqs', label: 'FAQs' },
]

export const LoanProductPage: React.FC = () => {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const product = findLoanProduct(slug)

  if (!product) return <Navigate to="/loans" replace />

  const amountParam = Number(params.get('amount'))
  const initialAmount = Number.isFinite(amountParam) && amountParam > 0 ? amountParam : undefined
  const instant = params.get('variant') === 'instant'
  const calc = findCalculator(product.calculatorId)
  const others = LOAN_PRODUCTS.filter((p) => p.slug !== product.slug).slice(0, 4)

  return (
    <PageShell>
      <section className="border-b border-[#e4e4e3] bg-gradient-to-b from-[#f2f7ff] to-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-12">
          <div>
            <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Loans', to: '/loans' }, { label: product.title }]} />
            <h1 className="mt-4 text-3xl font-bold leading-tight text-[#052f5f] sm:text-4xl">
              {instant ? 'Instant ' : ''}
              {product.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">{product.short}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {product.categories.map((c) => (
                <span key={c} className="rounded-full border border-[#d9e8ff] bg-white px-3 py-1 text-xs font-medium text-[#052f5f]">{c}</span>
              ))}
            </div>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {product.highlights.map((h) => (
                <li key={h.title} className="flex gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-[#e4e4e3]">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#00a86b]" />
                  <div>
                    <p className="text-sm font-semibold text-[#052f5f]">{h.title}</p>
                    <p className="text-xs leading-relaxed text-slate-600">{h.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <LoanPlanner key={product.slug + String(initialAmount)} product={product} initialAmount={initialAmount} />
        </div>
      </section>

      <nav aria-label="On this page" className="sticky top-[60px] z-20 border-b border-[#e4e4e3] bg-white/95 backdrop-blur lg:top-[68px]">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-xs font-medium text-slate-600 hover:border-[#0066ff] hover:text-[#0066ff]">
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-4xl space-y-14 px-4 py-12 sm:px-6">
        <section id="overview" className="scroll-mt-32">
          <h2 className="text-xl font-semibold text-[#052f5f]">About {product.title.toLowerCase()}</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
            {product.overview.map((p) => <p key={p}>{p}</p>)}
          </div>
        </section>

        <section id="features" className="scroll-mt-32">
          <h2 className="text-xl font-semibold text-[#052f5f]">Types and categories</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {product.categories.map((c) => (
              <Link key={c} to={`/explore/${c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${product.slug}`} className="group flex items-center justify-between rounded-xl border border-[#e4e4e3] px-4 py-3 text-sm font-medium text-[#1c1d1f] transition hover:border-[#0066ff] hover:bg-[#f2f7ff]">
                {c} {product.title.toLowerCase()}
                <span className="text-[#0066ff] transition group-hover:translate-x-0.5">→</span>
              </Link>
            ))}
          </div>
        </section>

        <section id="eligibility" className="scroll-mt-32">
          <h2 className="text-xl font-semibold text-[#052f5f]">Eligibility criteria</h2>
          <p className="mt-1 text-xs text-slate-500">General guidance. Each lender sets its own criteria.</p>
          <ul className="mt-4 space-y-2">
            {product.eligibility.map((e) => (
              <li key={e} className="flex gap-2 text-sm text-slate-700"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#0066ff]" />{e}</li>
            ))}
          </ul>
        </section>

        <section id="documents" className="scroll-mt-32">
          <h2 className="text-xl font-semibold text-[#052f5f]">Documents usually required</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {product.documents.map((d) => (
              <li key={d} className="flex items-center gap-2 rounded-lg bg-[#f7f8fa] px-3 py-2 text-sm text-slate-700"><FileText size={15} className="text-[#0066ff]" />{d}</li>
            ))}
          </ul>
          <Link to="/document-guide" className="mt-3 inline-block text-xs font-semibold text-[#0066ff] hover:underline">See the company-wise document guide →</Link>
        </section>

        <section id="process" className="scroll-mt-32">
          <h2 className="text-xl font-semibold text-[#052f5f]">How it works</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2">
            {product.steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-[#e4e4e3] p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d9e8ff] text-xs font-bold text-[#0066ff]">{i + 1}</span>
                <p className="mt-3 text-sm font-semibold text-[#052f5f]">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="faqs" className="scroll-mt-32">
          <h2 className="text-xl font-semibold text-[#052f5f]">Frequently asked questions</h2>
          <div className="mt-4 divide-y divide-[#e4e4e3] rounded-2xl border border-[#e4e4e3]">
            {product.faqs.map((f, i) => {
              const open = openFaq === i
              return (
                <div key={f.q}>
                  <button type="button" aria-expanded={open} onClick={() => setOpenFaq(open ? null : i)} className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-medium text-[#1c1d1f]">
                    {f.q}
                    <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && <p className="px-4 pb-4 text-sm leading-relaxed text-slate-600">{f.a}</p>}
                </div>
              )
            })}
          </div>
        </section>

        {calc && (
          <Link to={`/calculators/${calc.id}`} className="flex items-center justify-between rounded-2xl bg-[#052f5f] p-5 text-white transition hover:bg-[#0a3d78]">
            <span>
              <span className="block text-sm font-semibold">{calc.title}</span>
              <span className="text-xs text-blue-200">Compare tenures and see the full amortisation schedule.</span>
            </span>
            <span aria-hidden>→</span>
          </Link>
        )}

        <section>
          <h2 className="text-base font-semibold text-[#052f5f]">Explore other loans</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((o) => (
              <Link key={o.slug} to={`/loans/${o.slug}`} className="flex items-center gap-3 rounded-xl border border-[#e4e4e3] p-3 text-sm font-medium transition hover:border-[#0066ff]">
                <img src={`/assets/pb/${o.icon}`} alt="" width={24} height={24} /> {o.title}
              </Link>
            ))}
          </div>
        </section>

        <p className="rounded-xl bg-[#f7f8fa] p-4 text-[11px] leading-relaxed text-slate-500">
          Askus Fin does not lend money. Rates, fees, eligibility, limits and approvals are determined by the lender. Figures on this page are planning aids using values you control.
        </p>
      </div>
    </PageShell>
  )
}
