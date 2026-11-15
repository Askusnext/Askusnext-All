import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileCheck2,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
  Search,
  CheckCircle2
} from 'lucide-react'
import { LENDERS } from '../../constants/banks'
import { JOB_PROFILES } from '../../constants/jobProfiles'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { AuthModal } from '../../components/auth/AuthModal'

export const DocumentGuidePage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'bank' | 'cash'>('all')

  const filteredLenders = LENDERS.filter((l) => {
    const matchName = l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.code.toLowerCase().includes(searchTerm.toLowerCase())
    if (selectedFilter === 'cash') {
      return matchName && (l.cashSalaryAccepted === 'Case-by-case basis' || l.cashSalaryAccepted === 'Prior confirmation required')
    }
    return matchName
  })

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
      <Navbar />
      <AuthModal />

      {/* HEADER BANNER */}
      <section className="bg-slate-900 text-white py-14 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1 border border-blue-400/30">
              <FileCheck2 size={14} />
              <span>India Salaried Applicants Guide</span>
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Personal Loan Company-Wise Document Guide
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              A factual, practical reference for checking personal-loan documentation by lender. Verified against published checklists as of 02 November 2026 for both bank-credited salary and cash-salary applicant profiles.
            </p>
          </div>
        </div>
      </section>

      {/* JUMP LINKS */}
      <div className="sticky top-20 z-30 bg-white border-b border-slate-200 px-4 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto text-xs font-semibold text-slate-600 space-x-6">
          <div className="flex items-center space-x-6 shrink-0">
            <a href="#company-wise" className="hover:text-blue-600 transition">
              1. Company-Wise Checklists
            </a>
            <a href="#bank-salary" className="hover:text-blue-600 transition">
              2. Bank Account Salary
            </a>
            <a href="#cash-salary" className="hover:text-blue-600 transition text-amber-700 font-bold">
              3. Cash Salary Notes
            </a>
            <a href="#job-profiles" className="hover:text-blue-600 transition">
              4. Job-Wise Matrix
            </a>
            <a href="#checks" className="hover:text-blue-600 transition">
              5. Checks Before Applying
            </a>
            <a href="#official-links" className="hover:text-blue-600 transition">
              6. Official Bank Links
            </a>
          </div>

          <Link
            to="/apply"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold shrink-0 transition"
          >
            <span>Apply with Checklist</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* ================= SECTION 1: COMPANY-WISE TABLE ================= */}
        <section id="company-wise" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest block mb-1">
                Section 1
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Company-Wise Document Requirements
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Overview of published checklists and cash-salary policies across top 10 Indian financial institutions.
              </p>
            </div>

            {/* Search & Filter */}
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by bank..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-3 text-base sm:py-2 sm:text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as 'all' | 'bank' | 'cash')}
                className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-3 py-3 text-base sm:py-2 sm:text-xs font-semibold text-slate-700 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Lenders</option>
                <option value="cash">Considers Cash Salary</option>
              </select>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="rtable rt-light w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-4 px-6 w-1/5">Company / Bank</th>
                    <th className="py-4 px-6 w-2/5">Common Documents / Public Checklist</th>
                    <th className="py-4 px-6 w-2/5">Cash-Salary Note & Policy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLenders.map((bank) => (
                    <tr key={bank.id} className="hover:bg-slate-50/70 transition-colors">
                      <td data-label="Bank" className="py-4 px-6 align-top rt-stack">
                        <div className="font-extrabold text-sm text-slate-900">{bank.name}</div>
                        <span className="inline-block mt-1 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {bank.code}
                        </span>
                        <a className="mt-2 inline-block text-[11px] text-blue-700 font-medium underline" href={bank.publicReferenceUrl} target="_blank" rel="noreferrer">
                          Check current lender information
                        </a>
                      </td>

                      <td data-label="Documents" className="py-4 px-6 align-top space-y-1.5 text-slate-700 rt-stack">
                        <ul className="space-y-1">
                          {bank.bankSalaryChecklist.map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <CheckCircle2 size={13} className="text-blue-600 mt-0.5 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                          {bank.bankSalaryChecklist.length === 0 && <li>Check the lender's official site for current documentation requirements.</li>}
                        </ul>
                      </td>

                      <td data-label="Cash-salary policy" className="py-4 px-6 align-top space-y-2 rt-stack">
                        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 text-slate-700 leading-relaxed">
                          <span className="font-bold text-amber-900 block mb-1">
                            Status: {bank.cashSalaryAccepted}
                          </span>
                          {bank.cashSalaryNote}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ================= SECTION 2: DOCUMENTS - BANK SALARY ================= */}
        <section id="bank-salary" className="rounded-3xl bg-white border border-slate-200 p-8 sm:p-10 shadow-xs space-y-6">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest block mb-1">
              Section 2
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
              Documents Required — Bank Account Salary
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Checklist for applicants receiving salary through automated bank transfer or company NEFT/RTGS.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 block text-sm">1. KYC Identity Proof</strong>
              <p className="text-slate-600">
                Identity and tax documents requested by the selected lender. Confirm accepted document types through its official channel.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 block text-sm">2. Residential Address Proof</strong>
              <p className="text-slate-600">
                Address evidence accepted by the lender for the selected product. Requirements vary.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 block text-sm">3. Income Proof (Salary Slips)</strong>
              <p className="text-slate-600">
                Income evidence requested by the lender. Do not alter or create income records.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 block text-sm">4. Operative Bank Account Statements</strong>
              <p className="text-slate-600">
                Bank statements requested by the lender. The required period and format vary.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 block text-sm">5. Employment Verification Proof</strong>
              <p className="text-slate-600">
                Employment evidence requested by the lender. Confirm accepted formats directly.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 block text-sm">6. Tax Documentation (Where Requested)</strong>
              <p className="text-slate-600">
                Tax evidence may be requested depending on the applicant and product. Confirm directly with the lender.
              </p>
            </div>
          </div>
        </section>

        {/* ================= SECTION 3: DOCUMENTS - CASH SALARY ================= */}
        <section id="cash-salary" className="rounded-3xl bg-amber-50/70 border-2 border-amber-300 p-8 sm:p-10 shadow-xs space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="text-xs font-bold text-amber-900 uppercase tracking-widest">
                Section 3 • Crucial Compliance Guide
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-amber-950">
              Documents Required — Cash Salary Profile
            </h2>
            <div className="mt-3 p-4 rounded-2xl bg-white border border-amber-200 text-xs text-amber-900 leading-relaxed">
              <strong className="text-amber-950 block mb-1">Compliance & Advisory Warning:</strong>
              Cash salary is not automatically accepted by every bank or NBFC. The standard published salaried-loan checklists commonly require salary slips and/or bank statements showing salary credits. Before submitting an application, confirm in writing which alternative income proofs the lender will accept. Never create or alter salary slips, bank entries, employer letters or cash receipts. Submit only genuine documents.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white border border-amber-200/80 space-y-1.5">
              <strong className="text-slate-900 block text-sm">1. KYC Identity Proof</strong>
              <p className="text-slate-600">
                PAN card and Aadhaar / valid Government photo ID and current address verification proof.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-amber-200/80 space-y-1.5">
              <strong className="text-slate-900 block text-sm">2. Employer Salary Certificate</strong>
              <p className="text-slate-600">
                Ask the lender which genuine employer-issued income evidence it accepts for cash-paid salary.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-amber-200/80 space-y-1.5">
              <strong className="text-slate-900 block text-sm">3. Legitimate Wage Vouchers / Receipts</strong>
              <p className="text-slate-600">
                Ask the lender whether it accepts employer-maintained wage records. Submit only authentic documents.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-amber-200/80 space-y-1.5">
              <strong className="text-slate-900 block text-sm">4. Work & Appointment Proof</strong>
              <p className="text-slate-600">
                Employment evidence accepted for this applicant is determined by the lender.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-amber-200/80 space-y-1.5">
              <strong className="text-slate-900 block text-sm">5. Operative Bank Statement (6 Months)</strong>
              <p className="text-slate-600">
                The lender determines whether bank statements or other income evidence are required.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-amber-200/80 space-y-1.5">
              <strong className="text-slate-900 block text-sm">6. ITR / Form 16 (Where Available)</strong>
              <p className="text-slate-600">
                Confirm any tax or employer documents directly with the lender.
              </p>
            </div>
          </div>
        </section>

        {/* ================= SECTION 4: JOB-WISE PROFILE CHECKLIST ================= */}
        <section id="job-profiles" className="space-y-6">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest block mb-1">
              Section 4
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
              Employment Sectors
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Document requirements vary by lender and product. Confirm the current checklist with the lender.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {JOB_PROFILES.map((prof, i) => (
              <div
                key={i}
                className="rounded-3xl bg-white border border-slate-200 p-6 flex flex-col justify-between space-y-4 shadow-2xs hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                      Sector {i + 1}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{prof.label}</h3>

                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-xs text-slate-700">
                    <strong className="block text-slate-900 text-[11px] uppercase tracking-wider">
                      Lender requirements:
                    </strong>
                    <p className="text-slate-600">Confirm the current requirements with your chosen lender.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 italic">
                  {prof.notes}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ================= SECTION 5: IMPORTANT CHECKS ================= */}
        <section id="checks" className="rounded-3xl bg-slate-900 text-white p-8 sm:p-10 space-y-6">
          <div>
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest block mb-1">
              Section 5
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Important Checks Before Applying
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Fundamental verification checklist recommended by fintech underwriting standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1">
              <strong className="text-white block text-sm">1. Check Age & Minimum Net Salary</strong>
              <p>Confirm the lender's current age, employment, income and tenure criteria for the product you are considering.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1">
              <strong className="text-white block text-sm">2. Check Bureau Score & Repayment Trail</strong>
              <p>Review your own credit report through the bureau's official channel. Each lender applies its own assessment.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1">
              <strong className="text-white block text-sm">3. Compare Total Repayment & APR</strong>
              <p>Compare the lender's current interest rate, all fees and taxes, tenure, and repayment terms from official sources.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1">
              <strong className="text-white block text-sm">4. Fraud & Cybersecurity Protection</strong>
              <p>Use only official bank channels or verified partners. Never share OTPs, UPI PINs, ATM PINs, or net banking passwords with anyone.</p>
            </div>
          </div>
        </section>

        {/* ================= SECTION 6: OFFICIAL REFERENCE PAGES ================= */}
        <section id="official-links" className="rounded-3xl bg-white border border-slate-200 p-8 sm:p-10 space-y-6">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest block mb-1">
              Section 6
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
              Official Reference Pages
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Direct links to official public lender documentation and eligibility guidelines.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {LENDERS.map((bank) => (
              <a
                key={bank.id}
                href={bank.publicReferenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 flex min-w-0 items-center justify-between transition group"
              >
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 group-hover:text-blue-700 block">
                    {bank.name} — Personal Loan
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono truncate max-w-xs block">
                    {bank.publicReferenceUrl}
                  </span>
                </div>
                <ExternalLink size={14} className="text-slate-400 group-hover:text-blue-600 shrink-0 ml-2" />
              </a>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 text-[11px] text-slate-500 italic leading-relaxed">
            Disclaimer: This page provides official lender source links, not verified current rates, eligibility, or documentation policies. Confirm the latest requirements with the lender before applying or collecting documents.
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
