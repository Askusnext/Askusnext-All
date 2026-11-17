import React, { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { CheckCircle2, Clock, FileStack, Hourglass, Percent, TimerReset, UserPlus, Users } from 'lucide-react'
import type { AdminQuoteApplication } from '../../services/api/loansApi'
import { QUOTE_STEP_ORDER, stepIndex } from '../../constants/quoteSteps'
import { STATUS_INFO, STATUS_ORDER, type QuoteStatus } from '../../constants/quoteStatus'
import { findLender } from '../../constants/quotesData'
import { QUOTE_TYPE_NAMES } from '../../constants/quotesTypes'
import { formatAmountLabel } from '../../utils/quotes'

const DAY = 24 * 60 * 60 * 1000
const STATUS_COLORS: Record<QuoteStatus, string> = {
  in_progress: '#f59e0b', submitted: '#60a5fa', under_review: '#3b82f6', documents_required: '#fb923c',
  approved: '#22c55e', disbursed: '#14b8a6', rejected: '#f43f5e', closed: '#64748b',
}
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6']
const tooltipStyle = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 12, color: '#e2e8f0' }

const Kpi: React.FC<{ icon: React.ReactNode; label: string; value: string; hint?: string; tone: string }> = ({ icon, label, value, hint, tone }) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
    </div>
    <p className="mt-2 text-2xl font-extrabold text-white">{value}</p>
    {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
  </div>
)

const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className = '' }) => (
  <section className={`rounded-2xl border border-slate-800 bg-slate-950 p-5 ${className}`}>
    <h3 className="text-sm font-bold text-white">{title}</h3>
    {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </section>
)

const time = (iso?: string) => {
  const t = iso ? new Date(iso).getTime() : NaN
  return Number.isNaN(t) ? 0 : t
}

interface Props {
  apps: AdminQuoteApplication[]
  /** Total registered customers (everyone who has logged in). */
  totalCustomers: number
  /** Time the data was loaded, used for "last 14 days" and "stalled". */
  now: number
}

/** Headline numbers and charts for the loan-quote journeys. */
export const QuoteAnalytics: React.FC<Props> = ({ apps, totalCustomers, now }) => {
  const data = useMemo(() => {
    const started = apps.length
    const submitted = apps.filter((a) => a.status !== 'in_progress')
    const inProgress = apps.filter((a) => a.status === 'in_progress')
    const awaiting = apps.filter((a) => a.status === 'submitted' || a.status === 'under_review').length
    const approved = apps.filter((a) => a.status === 'approved' || a.status === 'disbursed').length
    const rejected = apps.filter((a) => a.status === 'rejected').length
    const decided = approved + rejected
    const customersStarted = new Set(apps.map((a) => a.uid)).size
    const stalled = inProgress.filter((a) => now - time(a.updatedAt) > 3 * DAY).length
    const requested = submitted.reduce((sum, a) => sum + a.amount, 0)

    const funnel = QUOTE_STEP_ORDER.map((s, i) => {
      const count = apps.filter((a) => stepIndex(a.step) >= i + 1).length
      return { name: s.short, count, pct: started ? Math.round((count / started) * 100) : 0 }
    })

    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now - (13 - i) * DAY)
      d.setHours(0, 0, 0, 0)
      return { key: d.toDateString(), label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), started: 0, submitted: 0 }
    })
    const byDay = new Map(days.map((d) => [d.key, d]))
    for (const a of apps) {
      const c = new Date(time(a.createdAt)).toDateString()
      if (byDay.has(c) && time(a.createdAt)) byDay.get(c)!.started += 1
      if (a.status !== 'in_progress') {
        const s = new Date(time(a.submittedAt)).toDateString()
        if (byDay.has(s) && time(a.submittedAt)) byDay.get(s)!.submitted += 1
      }
    }

    const typeCounts = new Map<string, number>()
    const lenderCounts = new Map<string, number>()
    for (const a of apps) {
      typeCounts.set(a.loanType, (typeCounts.get(a.loanType) ?? 0) + 1)
      lenderCounts.set(a.lenderId, (lenderCounts.get(a.lenderId) ?? 0) + 1)
    }
    const pipeline = STATUS_ORDER.map((st) => ({ key: st, name: STATUS_INFO[st].label, value: apps.filter((a) => a.status === st).length }))
    const types = [...typeCounts].map(([k, v]) => ({ name: QUOTE_TYPE_NAMES[k] ?? k, value: v }))
    const lenders = [...lenderCounts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => ({ name: findLender(k)?.name ?? k, value: v }))

    return { started, submitted: submitted.length, awaiting, approved, decided, pipeline, inProgress: inProgress.length, customersStarted, stalled, requested, funnel, days, types, lenders }
  }, [apps, now])

  const rate = data.started ? Math.round((data.submitted / data.started) * 100) : 0
  const approvalRate = data.decided ? Math.round((data.approved / data.decided) * 100) : 0
  const reach = totalCustomers ? Math.round((data.customersStarted / totalCustomers) * 100) : 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Users size={16} />} label="Registered" value={String(totalCustomers)} hint="Customers who logged in" tone="bg-slate-800 text-slate-300" />
        <Kpi icon={<UserPlus size={16} />} label="Started a loan" value={String(data.customersStarted)} hint={`${reach}% of registered`} tone="bg-blue-500/15 text-blue-300" />
        <Kpi icon={<FileStack size={16} />} label="Applications" value={String(data.started)} hint={`${rate}% were submitted`} tone="bg-violet-500/15 text-violet-300" />
        <Kpi icon={<Clock size={16} />} label="Drafts" value={String(data.inProgress)} hint="Not yet submitted" tone="bg-amber-500/15 text-amber-300" />
        <Kpi icon={<Hourglass size={16} />} label="Awaiting review" value={String(data.awaiting)} hint="Submitted or under review" tone="bg-sky-500/15 text-sky-300" />
        <Kpi icon={<CheckCircle2 size={16} />} label="Approved" value={String(data.approved)} hint={data.requested ? `${formatAmountLabel(data.requested)} requested in total` : 'No submissions yet'} tone="bg-emerald-500/15 text-emerald-300" />
        <Kpi icon={<Percent size={16} />} label="Approval rate" value={data.decided ? `${approvalRate}%` : '-'} hint={`${data.decided} decided`} tone="bg-teal-500/15 text-teal-300" />
        <Kpi icon={<TimerReset size={16} />} label="Stalled drafts" value={String(data.stalled)} hint="Idle for 3+ days" tone="bg-rose-500/15 text-rose-300" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Journey funnel" subtitle="Applications that reached each step. The drop between bars shows where customers stop.">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.funnel} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid stroke="#1e293b" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} />
                <YAxis type="category" dataKey="name" width={92} stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} formatter={(v, _n, p) => [`${v} (${(p.payload as { pct: number }).pct}%)`, 'Applications']} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {data.funnel.map((_, i) => <Cell key={i} fill={i === data.funnel.length - 1 ? '#22c55e' : '#3b82f6'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Last 14 days" subtitle="Applications started and submitted each day.">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.days} margin={{ left: -16, right: 8 }}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} interval={1} />
                <YAxis allowDecimals={false} stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Bar dataKey="started" name="Started" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="submitted" name="Submitted" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Review pipeline" subtitle="Where every application is right now.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.pipeline} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid stroke="#1e293b" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} />
                <YAxis type="category" dataKey="name" width={118} stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="value" name="Applications" radius={[0, 6, 6, 0]}>
                  {data.pipeline.map((p) => <Cell key={p.key} fill={STATUS_COLORS[p.key]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="By loan type">
          {data.types.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">No data yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.types} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="none">
                    {data.types.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Most chosen lenders" subtitle="Where customers choose to apply.">
          {data.lenders.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">No data yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.lenders} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} />
                  <YAxis type="category" dataKey="name" width={110} stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                  <Bar dataKey="value" name="Applications" fill="#a855f7" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
