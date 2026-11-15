import React, { useEffect, useMemo, useState } from 'react'
import { Search, ChevronRight } from 'lucide-react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { QuoteAnalytics } from '../../components/admin/QuoteAnalytics'
import { QuoteCustomerTree, type CustomerGroup } from '../../components/admin/QuoteCustomerTree'
import { QuoteApplicationDrawer } from '../../components/admin/QuoteApplicationDrawer'
import { fetchAllQuoteApplications, fetchAllUsers, type AdminQuoteApplication } from '../../services/api/loansApi'
import { QUOTE_STEP_ORDER, stepIndex, stepLabel } from '../../constants/quoteSteps'
import { STATUS_INFO, TONE_CLASSES, type QuoteStatus } from '../../constants/quoteStatus'
import { findLender } from '../../constants/quotesData'
import { QUOTE_TYPE_NAMES } from '../../constants/quotesTypes'
import { formatAmountLabel } from '../../utils/quotes'
import type { UserProfile } from '../../types'

const DAY = 24 * 60 * 60 * 1000

const when = (iso?: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

type Quick = 'all' | QuoteStatus | 'stalled'

// Lower number = needs the team sooner.
const PRIORITY: Record<QuoteStatus, number> = { submitted: 0, under_review: 1, documents_required: 2, approved: 3, in_progress: 4, rejected: 5, disbursed: 6, closed: 7 }
type Tab = 'customers' | 'applications' | 'overview'

/**
 * Every customer's loan-quote journey, including applications left halfway,
 * with analytics for the team and a detail panel for each application.
 */
export const AdminQuoteApplicationsPage: React.FC = () => {
  const [apps, setApps] = useState<AdminQuoteApplication[]>([])
  const [users, setUsers] = useState<Record<string, UserProfile>>({})
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(0)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('customers')
  const [search, setSearch] = useState('')
  const [quick, setQuick] = useState<Quick>('all')
  const [sortBy, setSortBy] = useState<'attention' | 'latest'>('attention')
  const [version, setVersion] = useState(0)
  const [includeEmpty, setIncludeEmpty] = useState(false)
  const [type, setType] = useState('all')
  const [step, setStep] = useState('all')
  const [selected, setSelected] = useState<AdminQuoteApplication | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([fetchAllQuoteApplications(), fetchAllUsers(500)])
      .then(([a, u]) => {
        if (!active) return
        setApps(a)
        setNow(Date.now())
        setUsers(Object.fromEntries(u.map((x) => [x.uid, x])))
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Could not load applications.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [version])

  const isStalled = (a: AdminQuoteApplication) => a.status === 'in_progress' && now - new Date(a.updatedAt ?? 0).getTime() > 3 * DAY

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: apps.length, stalled: 0 }
    for (const a of apps) {
      c[a.status] = (c[a.status] ?? 0) + 1
      if (a.status === 'in_progress' && now - new Date(a.updatedAt ?? 0).getTime() > 3 * DAY) c.stalled += 1
    }
    return c
  }, [apps, now])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return apps.filter((a) => {
      if (quick === 'stalled') {
        if (!(a.status === 'in_progress' && now - new Date(a.updatedAt ?? 0).getTime() > 3 * DAY)) return false
      } else if (quick !== 'all' && a.status !== quick) return false
      if (type !== 'all' && a.loanType !== type) return false
      if (step !== 'all' && a.step !== step) return false
      if (!q) return true
      const u = users[a.uid]
      const lender = findLender(a.lenderId)?.name ?? ''
      return [u?.displayName, u?.mobileNumber, u?.email, lender, a.referenceNumber, a.loanType].some((v) => v?.toLowerCase().includes(q))
    })
  }, [apps, users, search, quick, type, step, now])

  const sorted = useMemo(() => {
    const list = [...rows]
    list.sort((a, b) => {
      if (sortBy === 'attention' && PRIORITY[a.status] !== PRIORITY[b.status]) return PRIORITY[a.status] - PRIORITY[b.status]
      return String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))
    })
    return list
  }, [rows, sortBy])

  const filtering = search.trim() !== '' || quick !== 'all' || type !== 'all' || step !== 'all'

  const groups = useMemo<CustomerGroup[]>(() => {
    const byUser = new Map<string, AdminQuoteApplication[]>()
    for (const a of sorted) byUser.set(a.uid, [...(byUser.get(a.uid) ?? []), a])
    const list: CustomerGroup[] = [...byUser].map(([uid, list2]) => ({ uid, user: users[uid], apps: list2 }))
    if (includeEmpty && !filtering) {
      for (const u of Object.values(users)) if (!byUser.has(u.uid)) list.push({ uid: u.uid, user: u, apps: [] })
    }
    // Customers who need the team first, then the most recently active.
    const rank = (g: CustomerGroup) => (sortBy === 'attention' ? Math.min(...g.apps.map((a) => PRIORITY[a.status]), 99) : 0)
    const latest = (g: CustomerGroup) => g.apps.reduce((m, a) => (String(a.updatedAt ?? '') > m ? String(a.updatedAt ?? '') : m), '')
    return list.sort((a, b) => rank(a) - rank(b) || latest(b).localeCompare(latest(a)))
  }, [sorted, users, includeEmpty, filtering, sortBy])

  const customersWithoutLoans = Object.keys(users).length - new Set(apps.map((a) => a.uid)).size

  const chip = (key: Quick, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setQuick(key)}
      className={`rounded-full border px-3.5 py-2 sm:py-1.5 text-xs font-semibold transition ${quick === key ? 'border-blue-500 bg-blue-500/15 text-blue-200' : 'border-slate-700 text-slate-400 hover:text-white'}`}
    >
      {label} <span className="ml-1 text-slate-500">{counts[key] ?? 0}</span>
    </button>
  )

  const select = 'min-w-0 flex-1 sm:flex-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-base sm:py-2 sm:text-xs text-white focus:border-blue-500 focus:outline-none'

  return (
    <AdminLayout title="Applications" subtitle="Every loan a customer starts, grouped by customer, including ones left halfway.">
      <div className="space-y-5">
        <div role="tablist" className="flex w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-1 sm:inline-flex sm:w-auto">
          {(['customers', 'applications', 'overview'] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`shrink-0 grow whitespace-nowrap rounded-lg px-3 py-2.5 text-xs font-semibold transition sm:grow-0 sm:px-4 sm:py-1.5 ${tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t === 'customers' ? `By customer (${new Set(apps.map((a) => a.uid)).size})` : t === 'applications' ? `All loans (${apps.length})` : 'Analytics'}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="rounded-xl bg-rose-950/50 p-3 text-xs text-rose-300">{error}</p>}
        {loading && <p className="text-xs text-slate-500">Loading...</p>}

        {!loading && tab === 'overview' && <QuoteAnalytics apps={apps} totalCustomers={Object.keys(users).length} now={now} />}

        {!loading && (tab === 'applications' || tab === 'customers') && (
          <>
            <div className="flex flex-wrap items-center gap-2">{chip('all', 'All')}{(['submitted', 'under_review', 'documents_required', 'approved', 'disbursed', 'rejected', 'closed', 'in_progress'] as QuoteStatus[]).map((st) => chip(st, STATUS_INFO[st].label))}{chip('stalled', 'Stalled drafts')}</div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, mobile, lender, reference..." className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none" />
              </div>
              <select value={type} onChange={(e) => setType(e.target.value)} className={select} aria-label="Loan type">
                <option value="all">All loan types</option>
                {Object.entries(QUOTE_TYPE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={step} onChange={(e) => setStep(e.target.value)} className={select} aria-label="Step reached">
                <option value="all">Any step</option>
                {QUOTE_STEP_ORDER.map((s) => <option key={s.step} value={s.step}>{s.label}</option>)}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'attention' | 'latest')} className={select} aria-label="Sort">
                <option value="attention">Needs attention first</option>
                <option value="latest">Latest activity</option>
              </select>
              {tab === 'customers' && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={includeEmpty} onChange={(e) => setIncludeEmpty(e.target.checked)} className="accent-blue-500" />
                  Include customers with no loans ({customersWithoutLoans})
                </label>
              )}
              <span className="ml-auto text-xs text-slate-500">{rows.length} loan{rows.length === 1 ? '' : 's'}{tab === 'customers' ? ', ' + groups.length + ' customer' + (groups.length === 1 ? '' : 's') : ''} shown</span>
            </div>

            {tab === 'customers' && <QuoteCustomerTree groups={groups} now={now} forceOpen={filtering} onSelect={setSelected} />}

            {tab === 'applications' && (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
              <div className="overflow-x-auto">
                <table className="rtable w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900 font-bold text-slate-400">
                    <tr>
                      <th className="px-5 py-3.5">Customer</th>
                      <th className="px-5 py-3.5">Loan</th>
                      <th className="px-5 py-3.5">Amount</th>
                      <th className="px-5 py-3.5">Progress</th>
                      <th className="px-5 py-3.5">Last activity</th>
                      <th className="px-5 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {sorted.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">No applications match.</td></tr>}
                    {sorted.map((a) => {
                      const u = users[a.uid]
                      const lender = findLender(a.lenderId)
                      const idx = stepIndex(a.step)
                      return (
                        <tr key={`${a.uid}/${a.id}`} tabIndex={0} onClick={() => setSelected(a)} onKeyDown={(e) => e.key === 'Enter' && setSelected(a)} className="cursor-pointer hover:bg-slate-900/70 focus-visible:bg-slate-900/70 focus-visible:outline-none">
                          <td data-label="Customer" className="px-5 py-3">
                            <p className="font-semibold text-slate-100">{u?.displayName || 'Unnamed customer'}</p>
                            <p className="text-[11px] text-slate-500">{u?.mobileNumber || a.uid}</p>
                          </td>
                          <td data-label="Loan" className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white p-1">{lender && <img alt="" className="h-full w-full object-contain" src={`/assets/images/lenders/${lender.logo}.png`} />}</span>
                              <div>
                                <p className="text-slate-200">{lender?.name ?? a.lenderId}</p>
                                <p className="text-[11px] text-slate-500">{QUOTE_TYPE_NAMES[a.loanType] ?? a.loanType}</p>
                              </div>
                            </div>
                          </td>
                          <td data-label="Amount" className="px-5 py-3 text-slate-300">{formatAmountLabel(a.amount)} <span className="text-slate-500">/ {a.tenureMonths}m</span></td>
                          <td data-label="Progress" className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-0.5" aria-hidden>
                                {QUOTE_STEP_ORDER.map((s, i) => <span key={s.step} className={`h-1.5 w-4 rounded-full ${i < idx ? (a.status !== 'in_progress' ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-slate-700'}`} />)}
                              </div>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isStalled(a) ? 'bg-rose-500/15 text-rose-300' : TONE_CLASSES[STATUS_INFO[a.status].tone].admin}`}>
                                {isStalled(a) ? 'Stalled draft' : STATUS_INFO[a.status].label}
                              </span>
                              {(a.resubmissions ?? 0) > 0 && a.status === 'submitted' && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300">Resubmitted</span>}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">{stepLabel(a.step)}</p>
                          </td>
                          <td data-label="Last activity" className="px-5 py-3 text-slate-400">{when(a.updatedAt)}</td>
                          <td data-label="" className="px-5 py-3 text-right"><ChevronRight size={16} className="inline text-slate-500" /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </>
        )}
      </div>

      {selected && <QuoteApplicationDrawer app={selected} user={users[selected.uid]} onClose={() => setSelected(null)} onChanged={() => setVersion((v) => v + 1)} />}
    </AdminLayout>
  )
}
