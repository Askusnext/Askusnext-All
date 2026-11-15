import React, { useState, useEffect } from 'react'
import {
  Search,
  CheckCircle2
} from 'lucide-react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { fetchAllUsers } from '../../services/api/loansApi'
import { formatDate } from '../../utils/formatters'
import { ErrorBlock, EmptyBlock, LoadingBlock, Pager } from '../../components/admin/AdminUi'
import { PAGE_SIZE, clampPage, type LoadState } from '../../components/admin/paging'
import type { UserProfile } from '../../types'

export const AdminCustomersPage: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [state, setState] = useState<LoadState>('loading')
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void fetchAllUsers()
      .then((rows) => {
        if (!active) return
        setUsers(rows)
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

  const filtered = users.filter(
    (u) =>
      u.mobileNumber.includes(searchTerm) ||
      (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const current = clampPage(page, filtered.length)
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <AdminLayout
      title="Registered Customers Directory"
      subtitle="All customer accounts have mandatory Indian mobile OTP verification."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by mobile, name, email..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(0) }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-3 text-base sm:py-2 sm:text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <span className="text-xs text-slate-400">Total: {users.length} accounts</span>
        </div>

        <div className="rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="rtable w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Customer Name</th>
                  <th className="py-3.5 px-6">Verified Mobile</th>
                  <th className="py-3.5 px-6">Email / Linked OAuth</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">Registered On</th>
                  <th className="py-3.5 px-6 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {visible.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-900/60 transition">
                    <td data-label="Customer" className="py-4 px-6 font-bold text-white">
                      {u.displayName || 'Unnamed Customer'}
                      <span className="block text-[10px] text-slate-400 font-mono font-normal">
                        UID: {u.uid}
                      </span>
                    </td>

                    <td data-label="Mobile" className="py-4 px-6 font-mono font-bold text-blue-400">
                      {u.mobileNumber}
                    </td>

                    <td data-label="Email" className="py-4 px-6 text-slate-300">
                      {u.email || 'N/A'}
                      {u.googleLinked && (
                        <span className="inline-block ml-1.5 text-[9px] bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded">
                          Google Linked
                        </span>
                      )}
                    </td>

                    <td data-label="Role" className="py-4 px-6">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === 'admin'
                            ? 'bg-purple-950 text-purple-300 border border-purple-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td data-label="Registered" className="py-4 px-6 text-slate-400 font-mono text-[11px]">
                      {formatDate(u.createdAt)}
                    </td>

                    <td data-label="Verification" className="py-4 px-6 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                        <CheckCircle2 size={11} />
                        <span>OTP Verified</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state === 'loading' && <LoadingBlock label="Loading customers..." />}
          {state === 'error' && <ErrorBlock message="Could not load customers. Check your connection and permissions." onRetry={retry} />}
          {state === 'ready' && filtered.length === 0 && <EmptyBlock text={users.length === 0 ? 'No customers have registered yet.' : 'No customers match your search.'} />}
          <Pager page={current} total={filtered.length} onPage={setPage} />
        </div>
      </div>
    </AdminLayout>
  )
}
