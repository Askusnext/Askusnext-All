import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Clock,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Search,
  CheckCircle2,
  XCircle,
  BadgeCheck,
  Route
} from 'lucide-react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { fetchAllApplications } from '../../services/api/loansApi'
import { fetchAllUsers, fetchAuditLogs, fetchAllQuoteApplications } from '../../services/api/loansApi'
import { ErrorBlock, EmptyBlock, LoadingBlock, Pager } from '../../components/admin/AdminUi'
import { PAGE_SIZE, clampPage, type LoadState } from '../../components/admin/paging'
import { formatINR, formatDate, formatDateTime } from '../../utils/formatters'
import type { LoanApplication, UserProfile, AuditLog } from '../../types'

export const AdminDashboard: React.FC = () => {
  const [applications, setApplications] = useState<LoanApplication[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [journeys, setJourneys] = useState({ total: 0, draft: 0, toReview: 0, waiting: 0 })
  const [state, setState] = useState<LoadState>('loading')
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void Promise.all([fetchAllApplications(), fetchAllUsers(), fetchAuditLogs(5), fetchAllQuoteApplications()])
      .then(([apps, customerRows, logRows, quotes]) => {
        if (!active) return
        setApplications(apps)
        setUsers(customerRows)
        setAuditLogs(logRows as AuditLog[])
        setJourneys({
          total: quotes.length,
          draft: quotes.filter((q) => q.status === 'in_progress').length,
          toReview: quotes.filter((q) => q.status === 'submitted' || q.status === 'under_review').length,
          waiting: quotes.filter((q) => q.status === 'documents_required').length,
        })
        setState('ready')
      })
      .catch(() => active && setState('error'))
    return () => {
      active = false
    }
  }, [attempt])

  const retry = () => {
    setState('loading')
    setAttempt((n) => n + 1)
  }

  const pendingCount = applications.filter(
    (a) => a.status === 'under_review' || a.status === 'submitted' || a.status === 'verification_pending'
  ).length
  const docsRequiredCount = applications.filter((a) => a.status === 'documents_required').length
  const approvedCount = applications.filter((a) => a.status === 'approved').length
  const rejectedCount = applications.filter((a) => a.status === 'rejected').length
  const completedCount = applications.filter((a) => a.status === 'disbursed').length
  const totalVolume = applications.reduce((sum, a) => sum + (a.loanAmount || 0), 0)

  const filtered = applications.filter(
    (a) =>
      a.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.userMobile.includes(searchTerm)
  )

  const current = clampPage(page, filtered.length)
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <AdminLayout
      title="Operations Lead Dashboard"
      subtitle="Executive overview of customer applications, underwriting queues, and credit pipeline."
    >
      <div className="space-y-8">
        {/* KPI STATS TILES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 shadow-xs">
            <span className="text-slate-400 text-xs font-semibold uppercase block">Total Customers</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-white">{state === 'ready' ? users.length : '-'}</span>
              <Users className="text-blue-500 h-5 w-5" />
            </div>
            <span className="text-[11px] text-emerald-400 mt-1 block">100% Mobile OTP Verified</span>
          </div>

          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 shadow-xs">
            <span className="text-slate-400 text-xs font-semibold uppercase block">Under Review</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-blue-400">{state === 'ready' ? pendingCount : '-'}</span>
              <Clock className="text-blue-500 h-5 w-5" />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Awaiting underwriter check</span>
          </div>

          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 shadow-xs">
            <span className="text-slate-400 text-xs font-semibold uppercase block">Docs Required Queue</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-400">{state === 'ready' ? docsRequiredCount : '-'}</span>
              <AlertTriangle className="text-amber-500 h-5 w-5" />
            </div>
            <span className="text-[11px] text-amber-400/80 mt-1 block">Awaiting customer re-upload</span>
          </div>

          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 shadow-xs">
            <span className="text-slate-400 text-xs font-semibold uppercase block">Total Pipeline Value</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-400">{state === 'ready' ? formatINR(totalVolume) : '-'}</span>
              <TrendingUp className="text-emerald-500 h-5 w-5" />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">{state === 'ready' ? applications.length + ' loan requests' : 'Not loaded'}</span>
          </div>
        </div>

        {state === 'error' && (
          <div className="rounded-2xl border border-rose-900/60 bg-slate-950">
            <ErrorBlock message="Could not load dashboard data, so the numbers above may be incomplete." onRetry={retry} />
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Total Applications', value: applications.length, icon: Route, tone: 'text-white' },
            { label: 'Approved', value: approvedCount, icon: CheckCircle2, tone: 'text-emerald-400' },
            { label: 'Rejected', value: rejectedCount, icon: XCircle, tone: 'text-rose-400' },
            { label: 'Completed (disbursed)', value: completedCount, icon: BadgeCheck, tone: 'text-sky-400' },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
              <span className="block text-[11px] font-semibold uppercase text-slate-400">{k.label}</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className={`text-2xl font-black ${k.tone}`}>{state === 'ready' ? k.value : '-'}</span>
                <k.icon className={`h-5 w-5 ${k.tone}`} />
              </div>
            </div>
          ))}
        </div>

        <Link to="/admin/applications" className="block rounded-2xl border border-blue-800/50 bg-blue-950/30 p-4 transition hover:border-blue-500/60">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Loan journeys from the offers page</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {state === 'loading' ? 'Loading...' : `${journeys.total} total \u00b7 ${journeys.toReview} to review \u00b7 ${journeys.waiting} waiting on customers \u00b7 ${journeys.draft} drafts`}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-blue-300">Open <ArrowRight size={14} /></span>
          </div>
        </Link>

        {/* QUICK SEARCH & ACTIVE APPLICATIONS */}
        <div className="rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-xs">
          <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white">Underwriting Application Queue</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review applicant profiles, inspect submitted documents, and update statuses.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search reference, name, mobile..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0) }}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3 py-3 text-base sm:py-2 sm:text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="rtable w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Reference ID</th>
                  <th className="py-3.5 px-6">Applicant</th>
                  <th className="py-3.5 px-6">Service & Lender</th>
                  <th className="py-3.5 px-6">Amount</th>
                  <th className="py-3.5 px-6">Salary Mode</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {visible.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-900/60 transition">
                    <td data-label="Reference" className="py-4 px-6 font-mono font-bold text-white">
                      {app.referenceNumber}
                      <span className="block text-[10px] text-slate-400 font-sans font-normal">
                        {formatDate(app.createdAt)}
                      </span>
                    </td>

                    <td data-label="Applicant" className="py-4 px-6">
                      <span className="font-bold text-white block">{app.fullName}</span>
                      <span className="text-slate-400 font-mono text-[11px]">{app.userMobile}</span>
                    </td>

                    <td data-label="Service" className="py-4 px-6">
                      <span className="font-semibold text-slate-200 block">{app.serviceName}</span>
                      <span className="text-slate-400">{app.lenderName}</span>
                    </td>

                    <td data-label="Amount" className="py-4 px-6 font-bold text-white">
                      {formatINR(app.loanAmount)}
                      <span className="block text-[10px] text-slate-400 font-normal">
                        {app.tenureMonths} Mo
                      </span>
                    </td>

                    <td data-label="Salary" className="py-4 px-6">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          app.salaryPaymentMode === 'cash'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                            : 'bg-blue-950/80 text-blue-300 border border-blue-800/50'
                        }`}
                      >
                        {app.salaryPaymentMode === 'cash' ? 'Cash Salary' : 'Bank Salary'}
                      </span>
                    </td>

                    <td data-label="Status" className="py-4 px-6">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${
                          app.status === 'approved' || app.status === 'disbursed'
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50'
                            : app.status === 'documents_required'
                            ? 'bg-amber-950/70 text-amber-300 border border-amber-800/50'
                            : app.status === 'rejected'
                            ? 'bg-rose-950/70 text-rose-300 border border-rose-800/50'
                            : 'bg-blue-950/70 text-blue-300 border border-blue-800/50'
                        }`}
                      >
                        {app.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td data-label="" className="py-4 px-6 text-right rt-action">
                      <Link
                        to={`/admin/applications/${app.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 font-bold text-[11px] transition shadow-xs"
                      >
                        <span>Review</span>
                        <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state === 'loading' && <LoadingBlock label="Loading applications..." />}
          {state === 'ready' && filtered.length === 0 && <EmptyBlock text={applications.length === 0 ? 'No applications yet.' : 'No applications match your search.'} />}
          <Pager page={current} total={filtered.length} onPage={setPage} />
        </div>

        {/* AUDIT LOG PREVIEW */}
        <div className="rounded-3xl bg-slate-950 border border-slate-800 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">Recent Audit Trail</h3>
            <Link to="/admin/audit-logs" className="text-xs text-blue-400 hover:underline">
              View All Logs →
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            {state === 'ready' && auditLogs.length === 0 && <p className="py-4 text-center text-slate-500">No administrative actions recorded yet.</p>}
            {auditLogs.map((log) => (
              <div key={log.id} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between p-3 rounded-xl bg-slate-900 border border-slate-800/60">
                <div>
                  <span className="font-bold text-blue-400 font-mono text-[11px] block">
                    {log.action}
                  </span>
                  <p className="text-slate-300 mt-0.5">{log.details}</p>
                </div>
                <span className="text-[10px] text-slate-500 font-mono shrink-0 sm:ml-4">
                  {formatDateTime(log.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
