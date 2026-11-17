import React, { useState } from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import type { AdminQuoteApplication } from '../../services/api/loansApi'
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

export interface CustomerGroup {
  uid: string
  user?: UserProfile
  apps: AdminQuoteApplication[]
}

interface Props {
  groups: CustomerGroup[]
  now: number
  /** Expand every customer (used while searching or filtering). */
  forceOpen: boolean
  onSelect: (app: AdminQuoteApplication) => void
}

/** Statuses the team has to act on. */
const NEEDS_TEAM: QuoteStatus[] = ['submitted', 'under_review']

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'

/**
 * Customers as a tree: each customer is a row that expands into every loan
 * they applied for, so several loans from one person stay together.
 */
export const QuoteCustomerTree: React.FC<Props> = ({ groups, now, forceOpen, onSelect }) => {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [allOpen, setAllOpen] = useState(false)

  const isOpen = (uid: string) => forceOpen || allOpen || open.has(uid)
  const toggle = (uid: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })

  if (groups.length === 0) {
    return <p className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-10 text-center text-xs text-slate-500">No customers match.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => { setAllOpen((v) => !v); setOpen(new Set()) }} className="text-xs font-semibold text-blue-400 hover:underline">
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {groups.map((g) => {
        const name = g.user?.displayName || 'Unnamed customer'
        const expanded = isOpen(g.uid)
        const counts = new Map<QuoteStatus, number>()
        for (const a of g.apps) counts.set(a.status, (counts.get(a.status) ?? 0) + 1)
        const attention = g.apps.filter((a) => NEEDS_TEAM.includes(a.status)).length
        const waiting = g.apps.filter((a) => a.status === 'documents_required').length
        const latest = g.apps.reduce((m, a) => (String(a.updatedAt ?? '') > m ? String(a.updatedAt ?? '') : m), '')

        return (
          <section key={g.uid} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => toggle(g.uid)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-900/60 focus-visible:bg-slate-900/60 focus-visible:outline-none"
            >
              <ChevronRight size={16} className={`shrink-0 text-slate-500 transition ${expanded ? 'rotate-90' : ''}`} />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-300">{initials(name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{name}</span>
                <span className="block truncate text-[11px] text-slate-500">{g.user?.mobileNumber || g.uid}{g.user?.email ? ` · ${g.user.email}` : ''}</span>
              </span>
              <span className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
                {attention > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                    <AlertTriangle size={10} /> {attention} to review
                  </span>
                )}
                {waiting > 0 && <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-300">{waiting} waiting on customer</span>}
                {[...counts]
                  .filter(([st]) => !NEEDS_TEAM.includes(st) && st !== 'documents_required')
                  .map(([st, n]) => (
                    <span key={st} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONE_CLASSES[STATUS_INFO[st].tone].admin}`}>{n} {STATUS_INFO[st].label.toLowerCase()}</span>
                  ))}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-xs font-bold text-slate-200">{g.apps.length === 0 ? 'No loans yet' : `${g.apps.length} loan${g.apps.length === 1 ? '' : 's'}`}</span>
                <span className="block text-[10px] text-slate-500">{latest ? when(latest) : '-'}</span>
              </span>
            </button>

            {expanded && (
              <div className="border-t border-slate-800 bg-slate-900/30 px-4 py-3">
                {g.apps.length === 0 ? (
                  <p className="py-2 pl-12 text-xs text-slate-500">This customer has logged in but has not started a loan yet.</p>
                ) : (
                  <ul className="ml-[17px] space-y-2 border-l border-slate-700 pl-5">
                    {g.apps.map((a) => {
                      const lender = findLender(a.lenderId)
                      const idx = stepIndex(a.step)
                      const stalled = a.status === 'in_progress' && now - new Date(a.updatedAt ?? 0).getTime() > 3 * DAY
                      const info = STATUS_INFO[a.status] ?? STATUS_INFO.in_progress
                      return (
                        <li key={a.id} className="relative">
                          <span aria-hidden className="absolute -left-5 top-1/2 h-px w-5 bg-slate-700" />
                          <button
                            type="button"
                            onClick={() => onSelect(a)}
                            className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-left transition hover:border-blue-500/50 hover:bg-slate-900 focus-visible:border-blue-500 focus-visible:outline-none"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white p-1">
                              {lender && <img alt="" className="h-full w-full object-contain" src={`/assets/images/lenders/${lender.logo}.png`} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-slate-100">{QUOTE_TYPE_NAMES[a.loanType] ?? a.loanType} &middot; {lender?.name ?? a.lenderId}</span>
                              <span className="block text-[11px] text-slate-500">{formatAmountLabel(a.amount)} / {a.tenureMonths}m{a.referenceNumber ? ` · ${a.referenceNumber}` : ''}</span>
                            </span>
                            <span className="hidden items-center gap-2 md:flex" title={stepLabel(a.step)}>
                              <span className="flex gap-0.5" aria-hidden>
                                {QUOTE_STEP_ORDER.map((s, i) => <span key={s.step} className={`h-1.5 w-4 rounded-full ${i < idx ? (a.status !== 'in_progress' ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-slate-700'}`} />)}
                              </span>
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stalled ? 'bg-rose-500/15 text-rose-300' : TONE_CLASSES[info.tone].admin}`}>{stalled ? 'Stalled draft' : info.label}</span>
                              {(a.resubmissions ?? 0) > 0 && a.status === 'submitted' && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300">Resubmitted</span>}
                            </span>
                            <span className="w-24 shrink-0 text-right text-[11px] text-slate-500">{when(a.updatedAt)}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
