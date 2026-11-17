import React, { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { fetchAuditLogs } from '../../services/api/loansApi'
import { formatDateTime } from '../../utils/formatters'
import { ErrorBlock, EmptyBlock, LoadingBlock, Pager } from '../../components/admin/AdminUi'
import { PAGE_SIZE, clampPage, type LoadState } from '../../components/admin/paging'
import type { AuditLog } from '../../types'

export const AdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [state, setState] = useState<LoadState>('loading')
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void fetchAuditLogs()
      .then((items) => {
        if (!active) return
        setLogs(items as AuditLog[])
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

  const filtered = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.referenceNumber && l.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const current = clampPage(page, filtered.length)
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <AdminLayout
      title="Administrative Audit Trail Logs"
      subtitle="Immutable event logs recording all status changes, document verifications, and underwriter notes."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by action, reference, details..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(0) }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-3 text-base sm:py-2 sm:text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <span className="text-xs text-slate-400">Total Entries: {logs.length}</span>
        </div>

        <div className="rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="rtable w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Timestamp</th>
                  <th className="py-3.5 px-6">Action Type</th>
                  <th className="py-3.5 px-6">Admin UID</th>
                  <th className="py-3.5 px-6">Reference No</th>
                  <th className="py-3.5 px-6">Event Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {visible.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/60 transition">
                    <td data-label="Time" className="py-4 px-6 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>

                    <td data-label="Action" className="py-4 px-6 font-mono font-bold text-blue-400">
                      {log.action}
                    </td>

                    <td data-label="Admin" className="py-4 px-6 font-mono text-slate-400">
                      {log.adminId}
                    </td>

                    <td data-label="Reference" className="py-4 px-6 font-mono font-semibold text-white">
                      {log.referenceNumber || 'N/A'}
                    </td>

                    <td data-label="Details" className="py-4 px-6 text-slate-300 leading-relaxed max-w-md rt-stack">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state === 'loading' && <LoadingBlock label="Loading audit trail..." />}
          {state === 'error' && <ErrorBlock message="Could not load the audit trail. Check your connection and permissions." onRetry={retry} />}
          {state === 'ready' && filtered.length === 0 && <EmptyBlock text={logs.length === 0 ? 'No administrative actions have been recorded yet.' : 'No entries match your search.'} />}
          <Pager page={current} total={filtered.length} onPage={setPage} />
        </div>
      </div>
    </AdminLayout>
  )
}
