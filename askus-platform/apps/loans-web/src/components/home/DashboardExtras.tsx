import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Download, Pencil, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { assetUrl } from '../../constants/navigation'
import { PROMO_SLIDES } from '../../constants/promos'

const EXPLORE = [
  { label: 'Personal Loan', icon: 'personal_loan.svg', to: '/loans/personal-loan' },
  { label: 'Home Loan', icon: 'home_loan.svg', to: '/loans/home-loan' },
  { label: 'Business Loan', icon: 'business_loan.svg', to: '/loans/business-loan' },
  { label: 'Credit Cards', icon: 'credit_cards.svg', to: '/explore/credit-card' },
  { label: 'Fixed Deposit', icon: 'fixed_deposit.svg', to: '/explore/fixed-deposit' },
  { label: 'Mutual Funds', icon: 'mutual_funds.svg', to: '/explore/invest-in-mutual-funds' },
  { label: 'Calculators', icon: 'calculators_icon.svg', to: '/calculators' },
  { label: 'Bonds', icon: 'bonds_icon.svg', to: '/explore/bonds' },
]

export const DashboardExtras: React.FC = () => {
  const { user } = useAuth()
  return (
    <div className="space-y-8">
      {/* Profile summary */}
      <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#d9e8ff] text-[#0066ff]">
            <UserRound size={40} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 font-[Roboto_Serif,serif] text-2xl font-semibold text-[#1c1d1f]">
              <span className="truncate">{user?.displayName || 'Customer'}</span>
              <Link to="/customer/profile" aria-label="Edit profile" className="text-[#0066ff]">
                <Pencil size={16} />
              </Link>
            </h2>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-slate-500">
              {user?.mobileNumber}
              <span className="inline-flex items-center gap-1 rounded bg-[#d6f5e4] px-2 py-0.5 font-[Poppins,sans-serif] text-[10px] font-semibold text-[#0b6b3a]">
                <ShieldCheck size={11} /> Verified
              </span>
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link to="/cibil-check" className="inline-flex items-center gap-2 rounded-full bg-[#0066ff] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0052cc]">
                <Download size={16} /> Credit score info
              </Link>
            </div>
          </div>
          <Link to="/customer/profile" className="flex items-center gap-1 self-start text-sm font-medium text-[#0066ff] hover:underline">
            View Details <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      {/* Recommended */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#1c1d1f]">Recommended products</h2>
        <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-3">
          {PROMO_SLIDES.map((s) => (
            <div key={s.title} className={`relative flex min-h-[200px] w-[88%] shrink-0 snap-start items-center overflow-hidden rounded-2xl bg-gradient-to-br ${s.gradient} p-5 text-white sm:w-[420px]`}>
              <div className="relative z-10 max-w-[65%]">
                <h3 className="font-[Roboto_Serif,serif] text-lg font-semibold italic">{s.title}</h3>
                {s.highlight && <p className="mt-1 text-lg font-bold text-amber-300">{s.highlight}</p>}
                <ul className="mt-2 space-y-0.5 text-[11px]">{s.bullets.map((b) => <li key={b}>• {b}</li>)}</ul>
                <Link to={s.to} className="mt-4 inline-flex items-center gap-1 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-[#1c1d1f]">
                  {s.cta} <ChevronRight size={14} />
                </Link>
              </div>
              <img src={assetUrl(s.icon)} alt="" className="absolute bottom-4 right-4 h-20 w-20 rounded-2xl bg-white/15 p-4" />
            </div>
          ))}
        </div>
      </section>

      {/* Explore more */}
      <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-[#1c1d1f]">Explore more</h2>
        <div className="grid grid-cols-4 gap-4 lg:grid-cols-8">
          {EXPLORE.map((e) => (
            <Link key={e.label} to={e.to} className="group flex flex-col items-center gap-2 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[#e4e4e3] bg-[#f7f8fa] transition group-hover:border-[#0066ff] group-hover:bg-[#f2f7ff]">
                <img src={assetUrl(e.icon)} alt="" width={26} height={26} />
              </span>
              <span className="text-[11px] font-medium leading-tight text-[#1c1d1f] group-hover:text-[#0066ff]">{e.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
