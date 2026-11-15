import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageShell, Breadcrumbs } from '../../components/layout/PageShell'
import { findTopic, assetUrl } from '../../constants/navigation'

const humanize = (slug: string) =>
  slug
    .split('-')
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')

/** Landing page for navigation topics that do not have a dedicated product page. */
export const ExploreTopicPage: React.FC = () => {
  const { slug = '' } = useParams()
  const topic = findTopic(slug)
  const label = topic?.label ?? humanize(slug)
  const siblings = topic?.siblings.slice(0, 8) ?? []
  const loanish = /loan/i.test(label)

  return (
    <PageShell>
      <section className="bg-gradient-to-b from-[#f2f7ff] to-white">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, ...(topic ? [{ label: topic.menu }] : []), { label }]} />
          <h1 className="mt-4 text-3xl font-bold text-[#052f5f] sm:text-4xl">{label}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            We are still preparing our guide for {label.toLowerCase()}. Until then, use the tools below, and confirm product terms, eligibility and charges directly with the provider before you decide.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {loanish ? (
              <Link to="/loans" className="inline-flex items-center gap-2 rounded-full bg-[#0066ff] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0052cc]">
                Explore loan products <ArrowRight size={16} />
              </Link>
            ) : (
              <Link to="/calculators" className="inline-flex items-center gap-2 rounded-full bg-[#0066ff] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0052cc]">
                Open calculators <ArrowRight size={16} />
              </Link>
            )}
            <Link to="/cibil-check" className="rounded-full border border-[#0066ff] px-6 py-3 text-sm font-semibold text-[#0066ff] hover:bg-[#f2f7ff]">Credit score information</Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-10 px-4 pb-16 sm:px-6">
        {siblings.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-[#052f5f]">More in {topic?.group}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {siblings.map((s) => (
                <li key={s.to}>
                  <Link to={s.to} className="flex items-center justify-between rounded-xl border border-[#e4e4e3] px-4 py-2.5 text-sm text-[#1c1d1f] hover:border-[#0066ff] hover:bg-[#f2f7ff]">
                    {s.label} <span className="text-[#0066ff]">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="text-base font-semibold text-[#052f5f]">Browse the marketplace</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ['Personal Loan', '/loans/personal-loan', 'personal_loan.svg'],
              ['Home Loan', '/loans/home-loan', 'home_loan.svg'],
              ['Business Loan', '/loans/business-loan', 'business_loan.svg'],
              ['Loan Against Property', '/loans/loan-against-property', 'lap_icon.svg'],
              ['Calculators', '/calculators', 'calculators_icon.svg'],
              ['Credit Score', '/cibil-check', 'credit_score.svg'],
            ].map(([l, to, icon]) => (
              <Link key={to} to={to} className="flex items-center gap-3 rounded-xl bg-[#f7f8fa] px-3 py-3 text-sm font-medium hover:bg-[#f2f7ff]">
                <img src={assetUrl(icon)} alt="" width={24} height={24} /> {l}
              </Link>
            ))}
          </div>
        </section>
        <p className="text-[11px] text-slate-400">Askus Fin does not provide investment, tax or credit advice.</p>
      </div>
    </PageShell>
  )
}
