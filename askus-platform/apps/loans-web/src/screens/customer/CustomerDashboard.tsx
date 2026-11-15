import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  ArrowRight
} from 'lucide-react'
import { QuoteApplicationsList } from '../../components/home/QuoteApplicationsList'
import { DashboardExtras } from '../../components/home/DashboardExtras'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { useAuth } from '../../contexts/AuthContext'
import { fetchUserApplications } from '../../services/api/loansApi'
import { useQuoteApplications } from '../../hooks/useQuoteApplications'
import { formatINR, formatDate } from '../../utils/formatters'
import type { LoanApplication, ApplicationStatus } from '../../types'

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth()
  const [applications, setApplications] = useState<LoanApplication[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)
  const { apps: quoteApps } = useQuoteApplications(user?.uid)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(false)
    if (!user?.uid) {
      setApplications([])
      setLoading(false)
      return () => { active = false }
    }

    void fetchUserApplications(user.uid).then((apps) => {
      if (active) setApplications(apps)
    }).catch((err) => {
      console.error('Failed to load apps:', err)
      if (active) {
        setApplications([])
        setLoadError(true)
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [user?.uid, reloadCount])

  const statusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'approved':
      case 'disbursed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5 text-[11px] font-bold">
            <CheckCircle2 size={12} />
            <span className="capitalize">{status}</span>
          </span>
        )
      case 'documents_required':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 px-2.5 py-0.5 text-[11px] font-bold">
            <AlertTriangle size={12} />
            <span>Docs Required</span>
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-0.5 text-[11px] font-bold">
            <span>Rejected</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-0.5 text-[11px] font-bold">
            <Clock size={12} />
            <span className="capitalize">{status.replace('_', ' ')}</span>
          </span>
        )
    }
  }

  // Counts cover both kinds of application: the full form and the ones started from the offers page.
  const submittedQuotes = quoteApps.filter((a) => a.status !== 'in_progress')
  const totalCount = applications.length + submittedQuotes.length
  const approvedCount =
    applications.filter((a) => a.status === 'approved' || a.status === 'disbursed').length +
    submittedQuotes.filter((a) => a.status === 'approved' || a.status === 'disbursed').length
  const pendingCount =
    applications.filter((a) => a.status === 'under_review' || a.status === 'submitted' || a.status === 'verification_pending').length +
    submittedQuotes.filter((a) => a.status === 'under_review' || a.status === 'submitted').length
  const formActionRequired = applications.filter((a) => a.status === 'documents_required').length
  const actionRequiredCount = formActionRequired + submittedQuotes.filter((a) => a.status === 'documents_required').length

  return (
    <DashboardLayout
      title={`Welcome! ${(user?.displayName || 'Customer').split(' ')[0]}`}
      subtitle="Track your loan applications, review document checklists, and monitor lender decisions."
    >
      <div className="space-y-8">
        <DashboardExtras />
        <QuoteApplicationsList />
        {/* KPI OVERVIEW CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
            <span className="text-slate-400 text-xs font-semibold uppercase block">Total Applications</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{totalCount}</span>
              <FileText className="text-blue-600 h-5 w-5" />
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Active loan requests</span>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
            <span className="text-slate-400 text-xs font-semibold uppercase block">Under Review</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-blue-700">{pendingCount}</span>
              <Clock className="text-blue-500 h-5 w-5" />
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Lender credit verification</span>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
            <span className="text-slate-400 text-xs font-semibold uppercase block">Sanctioned / Approved</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-600">{approvedCount}</span>
              <CheckCircle2 className="text-emerald-500 h-5 w-5" />
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Ready for disbursement</span>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
            <span className="text-slate-400 text-xs font-semibold uppercase block">Action Required</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-600">{actionRequiredCount}</span>
              <AlertTriangle className="text-amber-500 h-5 w-5" />
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Documents pending upload</span>
          </div>
        </div>

        {/* ACTION REQUIRED BANNER (If any) */}
        {formActionRequired > 0 && (
          <div className="rounded-2xl bg-amber-50 border border-amber-300 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-950">
                  Documents Required on Your Application
                </h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  The credit underwriting team has requested re-upload or additional documentation to finalize sanction.
                </p>
              </div>
            </div>
            <Link
              to={`/customer/applications/${applications.find((a) => a.status === 'documents_required')?.id}`}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-4 shrink-0 shadow-sm transition"
            >
              Upload Documents Now
            </Link>
          </div>
        )}

        {/* MY APPLICATIONS TABLE */}
        <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">My Loan Applications</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time tracking of submitted personal loan requests.
              </p>
            </div>

            <Link
              to="/apply"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
            >
              <PlusCircle size={14} />
              <span>New Loan</span>
            </Link>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading your applications...</div>
          ) : loadError ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-sm font-bold text-rose-700">We couldn’t load your applications.</p>
              <p className="text-xs text-slate-500">Your submitted application may still be saved. Try loading the list again.</p>
              <button
                type="button"
                onClick={() => setReloadCount((count) => count + 1)}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5"
              >
                Retry
              </button>
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <FileText className="mx-auto h-10 w-10 text-slate-300" />
              <h4 className="text-sm font-bold text-slate-800">No applications yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                You haven't initiated any personal loan assistance requests. Start by comparing rates and checking eligibility.
              </p>
              <div className="pt-2">
                <Link
                  to="/apply"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 inline-block"
                >
                  Apply for Loan
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="rtable rt-light w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-6">Reference No</th>
                    <th className="py-3.5 px-6">Service & Lender</th>
                    <th className="py-3.5 px-6">Amount & Tenure</th>
                    <th className="py-3.5 px-6">Salary Mode</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50 transition">
                      <td data-label="Reference" className="py-4 px-6">
                        <span className="font-mono font-bold text-slate-900 block">
                          {app.referenceNumber}
                        </span>
                        <span className="text-[11px] text-slate-400">{formatDate(app.createdAt)}</span>
                      </td>

                      <td data-label="Service" className="py-4 px-6">
                        <span className="font-bold text-slate-900 block">{app.serviceName}</span>
                        <span className="text-slate-500">{app.lenderName}</span>
                      </td>

                      <td data-label="Amount" className="py-4 px-6">
                        <span className="font-extrabold text-slate-900 block">
                          {formatINR(app.loanAmount)}
                        </span>
                        <span className="text-slate-500">
                          {app.tenureMonths} Mo ({formatINR(app.calculatedEmi)}/mo)
                        </span>
                      </td>

                      <td data-label="Salary" className="py-4 px-6">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            app.salaryPaymentMode === 'cash'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {app.salaryPaymentMode === 'cash' ? 'Cash Salary' : 'Bank Transfer'}
                        </span>
                      </td>

                      <td data-label="Status" className="py-4 px-6">{statusBadge(app.status)}</td>

                      <td data-label="" className="py-4 px-6 text-right rt-action">
                        <Link
                          to={`/customer/applications/${app.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/50 px-3 py-1.5 font-bold text-slate-700 hover:text-blue-700 transition"
                        >
                          <span>View Details</span>
                          <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
