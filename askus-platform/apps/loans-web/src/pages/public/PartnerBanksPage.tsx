import React from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import { LENDERS } from '../../constants/banks'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { AuthModal } from '../../components/auth/AuthModal'

export const PartnerBanksPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
      <Navbar />
      <AuthModal />

      {/* Header */}
      <section className="bg-slate-900 text-white py-14 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1 border border-blue-400/30">
              <Building2 size={14} />
              <span>10 Leading Financial Institutions</span>
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Banking & NBFC Partners
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Transparent rate comparisons, published salaried documentation requirements, and verified cash salary treatments across India's premier lenders.
            </p>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-24 space-y-12">
        <div className="space-y-6">
          {LENDERS.map((bank) => (
            <div
              key={bank.id}
              id={bank.id}
              className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs hover:shadow-md transition space-y-6"
            >
              {/* Top Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-extrabold text-slate-950">{bank.name}</h3>
                    <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                      {bank.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{bank.tagline}</p>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    to={`/apply?lender=${bank.id}`}
                    className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 shadow-sm transition active:scale-95"
                  >
                    Apply with {bank.code}
                  </Link>

                  <a
                    href={bank.publicReferenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition"
                    title="Official bank documentation page"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Interest Rates</span>
                  <span className="font-extrabold text-sm text-blue-700 mt-0.5 block">Check official site</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Maximum Amount</span>
                  <span className="font-extrabold text-sm text-slate-900 mt-0.5 block">Set by lender</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Max Tenure</span>
                  <span className="font-extrabold text-sm text-slate-900 mt-0.5 block">Set by lender</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Turnaround Time</span>
                  <span className="font-extrabold text-sm text-emerald-700 mt-0.5 block">
                    Set by lender
                  </span>
                </div>
              </div>

              {/* Document Checklists & Cash Salary Note */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                {/* Bank checklist */}
                <div className="space-y-2">
                  <strong className="text-slate-900 text-xs uppercase tracking-wider block">
                    Standard Salaried Checklist:
                  </strong>
                  <ul className="space-y-1.5 text-slate-600">
                    {bank.bankSalaryChecklist.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 size={14} className="text-blue-600 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Cash note */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-600" />
                    <strong className="text-amber-950 text-xs uppercase tracking-wider">
                      Cash Salary Policy: {bank.cashSalaryAccepted}
                    </strong>
                  </div>
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 leading-relaxed">
                    {bank.cashSalaryNote}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}
