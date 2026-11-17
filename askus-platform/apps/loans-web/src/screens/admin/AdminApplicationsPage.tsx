import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  ArrowRight
} from 'lucide-react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { fetchAllApplications } from '../../services/api/loansApi'
import { formatINR, formatDate } from '../../utils/formatters'
import { ErrorBlock, EmptyBlock, LoadingBlock, Pager } from '../../components/admin/AdminUi'
import { PAGE_SIZE, clampPage, type LoadState } from '../../components/admin/paging'
import type { LoanApplication } from '../../types'

export const AdminApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<LoanApplication[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [state, setState] = useState<LoadState>('loading')
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void fetchAllApplications()
      .then((apps) => {
        if (!active) return
        setApplications(apps)
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

  const filtered = applications.filter((a) => {
    const matchSearch =
      a.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.userMobile.includes(searchTerm)
    if (statusFilter === 'all') return matchSearch
    return matchSearch && a.status === statusFilter
  })

  const current = clampPage(page, filtered.length)
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <AdminLayout
      title="Application Directory"
      subtitle="Comprehensive view of all customer applications across services."
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search reference, name, mobile..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(0) }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-3 text-base sm:py-2 sm:text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
              className="min-w-0 flex-1 sm:flex-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-base sm:p-2 sm:text-xs text-white"
            >
              <option value="all">All Statuses ({applications.length})</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="documents_required">Documents Required</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="disbursed">Disbursed</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-xs">
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
          {state === 'error' && <ErrorBlock message="Could not load applications. Check your connection and permissions." onRetry={retry} />}
          {state === 'ready' && filtered.length === 0 && <EmptyBlock text={applications.length === 0 ? 'No applications yet.' : 'No applications match your search.'} />}
          <Pager page={current} total={filtered.length} onPage={setPage} />
        </div>
      </div>
    </AdminLayout>
  )
}
