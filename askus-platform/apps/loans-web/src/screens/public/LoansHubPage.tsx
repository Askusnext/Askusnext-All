import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageShell, Breadcrumbs } from '../../components/layout/PageShell'
import { LOAN_PRODUCTS } from '../../constants/loanProducts'
import { formatLakhCrore } from '../../utils/loanFormat'

export const LoansHubPage: React.FC = () => (
  <PageShell>
    <section className="bg-gradient-to-b from-[#f2f7ff] to-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Loans' }]} />
        <h1 className="mt-4 text-3xl font-bold text-[#052f5f] sm:text-4xl">Explore loans</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Pick a product to plan the amount and tenure, review general eligibility and documents, and continue to the application workflow where available.
        </p>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {LOAN_PRODUCTS.map((p) => (
          <Link key={p.slug} to={`/loans/${p.slug}`} className="group flex flex-col rounded-2xl border border-[#e4e4e3] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#0066ff] hover:shadow-lg">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f2f7ff]">
              <img src={`/assets/pb/${p.icon}`} alt="" width={28} height={28} />
            </span>
            <h2 className="mt-4 text-base font-semibold text-[#052f5f]">{p.title}</h2>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-600">{p.short}</p>
            <p className="mt-3 text-[11px] text-slate-500">Planning range {formatLakhCrore(p.planning.min)} – {formatLakhCrore(p.planning.max)}</p>
            <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#0066ff]">
              View details <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
            </span>
            {!p.wizardServiceId && <span className="mt-2 text-[10px] text-slate-400">Planning and information only</span>}
          </Link>
        ))}
      </div>
    </section>
  </PageShell>
)
