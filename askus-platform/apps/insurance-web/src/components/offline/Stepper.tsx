import { Check } from 'lucide-react'
import type { OfflineForm } from '../../lib/offline'
import { rupees } from '../../lib/idv'
import { formatReg } from '../../lib/vehicle'
import { cn } from '../../ui'
import { STEPS } from './parts'

const NAMES = ['Vehicle & documents', 'Vehicle & policy details', 'IDV & owner'] as const

/**
 * Navy progress card for wide screens: a cover summary on top and a ticked timeline of the three steps underneath,
 * each showing what has been entered so far. Purely presentational: it only reads the form.
 */
export default function Stepper({ step, f, cashback, onJump }: { step: number; f: OfflineForm; cashback: string; onJump: (i: number) => void }) {
  const year = (f.registrationDate || f.manufactureMonth).slice(0, 4)
  const idv = Number(f.idv) >= 10000 ? rupees(Number(f.idv)) : ''
  const lines: (string | false)[][] = [
    [f.isNew ? 'Brand-new vehicle' : f.regNumber.trim() ? formatReg(f.regNumber) : false],
    [f.makeModel.trim() || false, [f.fuel, year].filter(Boolean).join(' · ') || false, f.prevInsurer ? `Previous insurer: ${f.prevInsurer}` : false],
    [idv ? `IDV ${idv}` : false, f.name.trim() || false],
  ]
  const summary = (label: string, value: string | false) => value ? (
    <div className="flex items-baseline justify-between gap-3 text-[13px]"><dt className="text-white/65">{label}</dt><dd className="min-w-0 truncate text-right font-semibold">{value}</dd></div>
  ) : null

  return (
    <aside aria-label="Progress" className="rounded-2xl bg-[var(--pb-navy)] p-5 text-white shadow-[0_10px_30px_rgba(2,52,126,.25)]">
      <section>
        <h2 className="text-[15px] font-semibold">Your cover</h2>
        <span aria-hidden className="mt-1.5 block h-[3px] w-9 rounded-full bg-white" />
        <dl className="mt-4 space-y-2">
          {summary('Plan type', f.policyType === 'Limited Third Party' ? 'Third Party' : f.policyType)}
          {summary('IDV', f.policyType === 'Comprehensive' && idv)}
          {summary('NCB', !f.isNew && step >= 1 && f.ncb)}
          <div className="flex items-baseline justify-between gap-3 border-t border-white/15 pt-3 text-[13px]">
            <dt className="text-white/65">Cashback up to</dt><dd className="text-lg font-bold text-yellow-300">{cashback}</dd>
          </div>
        </dl>
      </section>

      <ol className="mt-6">
        {NAMES.map((name, i) => {
          const done = i < step, now = i === step
          const shown = lines[i].filter(Boolean) as string[]
          return (
            <li key={name} className={cn('relative pl-9', i < NAMES.length - 1 && 'pb-6')}>
              {i < NAMES.length - 1 && <span aria-hidden className={cn('absolute left-[11px] top-6 h-[calc(100%-1rem)] w-0.5', done ? 'bg-emerald-400' : 'bg-white/25')} />}
              <span aria-hidden className={cn('absolute left-0 top-0 grid size-6 place-items-center rounded-full ring-4 ring-[var(--pb-navy)]',
                done ? 'bg-emerald-400 text-white' : now ? 'bg-white' : 'bg-white/30')}>
                {done ? <Check size={14} strokeWidth={3} /> : now ? <span className="size-2.5 rounded-full bg-indigo-600" /> : <span className="text-[11px] font-semibold text-white/80">{i + 1}</span>}
              </span>
              <button type="button" disabled={!done} onClick={() => onJump(i)} aria-current={now ? 'step' : undefined} aria-label={`${STEPS[i]}: ${name}`}
                className={cn('block text-left text-[15px] leading-6', now ? 'font-semibold' : done ? 'font-medium hover:underline' : 'cursor-default font-medium text-white/60')}>{name}</button>
              {shown.length > 0 && (done || now) && <p className="mt-1 space-y-0.5 text-[13px] leading-snug text-white/75">{shown.map((l) => <span key={l} className="block truncate">{l}</span>)}</p>}
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
