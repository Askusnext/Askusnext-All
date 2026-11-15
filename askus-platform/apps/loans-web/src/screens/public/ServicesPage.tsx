import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap,
  CheckCircle2,
  ChevronRight,
  Filter
} from 'lucide-react'
import { FINANCIAL_SERVICES } from '../../constants/services'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { AuthModal } from '../../components/auth/AuthModal'

export const ServicesPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'direct' | 'cards'>('all')

  const filtered = FINANCIAL_SERVICES.filter((s) => {
    if (filter === 'direct') return s.isDirectApplication
    if (filter === 'cards') return s.id.includes('credit-card')
    return true
  })

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
      <Navbar />
      <AuthModal />

      {/* Header */}
      <section className="bg-slate-900 text-white py-14 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1 border border-blue-400/30">
              <Zap size={14} />
              <span>Full Portfolio of Retail Credit</span>
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Financial Services & Loan Solutions
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Explore transparent, verified loan facilities and credit management services tailored to salaried employees, professionals, and MSME business owners in India.
            </p>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
            <Filter size={14} className="text-blue-600" />
            <span>Filter Category:</span>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === 'all'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-white border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Services ({FINANCIAL_SERVICES.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('direct')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === 'direct'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-white border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Loan Applications
            </button>
            <button
              type="button"
              onClick={() => setFilter('cards')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === 'cards'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-white border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Credit Card Services
            </button>
          </div>

          <Link
            to="/document-guide"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
          >
            Check Required Documents →
          </Link>
        </div>
      </div>

      {/* Services List */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((srv) => (
            <div
              key={srv.id}
              className="rounded-3xl bg-white border border-slate-200 p-7 flex flex-col justify-between shadow-xs hover:shadow-xl hover:border-blue-400 transition-all group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border ${srv.badgeColor}`}>
                    {srv.badge}
                  </span>
                  {srv.minRate !== undefined && srv.minRate > 0 && (
                    <span className="text-xs font-black text-blue-700">
                      From {srv.minRate}% p.a.
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {srv.title}
                </h3>

                <p className="text-xs text-slate-500 leading-relaxed">
                  {srv.fullDesc}
                </p>

                {/* Highlights */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  <strong className="block text-[11px] font-bold uppercase text-slate-800 tracking-wider">
                    Key Features:
                  </strong>
                  {srv.highlights.map((h, i) => (
                    <p key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      <span>{h}</span>
                    </p>
                  ))}
                </div>

                {/* Eligibility */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                  <strong className="text-slate-800 text-[11px] block">Eligibility Criteria:</strong>
                  <ul className="text-slate-600 text-[11px] space-y-0.5">
                    {srv.eligibility.map((el, idx) => (
                      <li key={idx}>• {el}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-semibold block">Limits</span>
                  <span className="text-xs font-extrabold text-slate-900">{srv.maxAmountText}</span>
                </div>

                <Link
                  to={srv.route}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 flex items-center gap-1.5 shadow-xs transition active:scale-95"
                >
                  <span>{srv.isDirectApplication ? 'Apply Now' : 'Explore Service'}</span>
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}
