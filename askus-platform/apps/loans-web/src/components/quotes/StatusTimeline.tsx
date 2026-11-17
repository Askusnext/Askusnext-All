import React from 'react'
import type { QuoteHistoryEntry } from '../../services/api/loansApi'
import { STATUS_INFO, TONE_CLASSES, type QuoteStatus } from '../../constants/quoteStatus'

const when = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const headline = (e: QuoteHistoryEntry): string => {
  if (e.event === 'submitted') return 'Application submitted'
  if (e.event === 'resubmitted') return 'You resubmitted your documents'
  const info = STATUS_INFO[e.to as QuoteStatus]
  return info ? info.customerLabel : e.to
}

/** What happened to the application, newest first, with the message the reviewer left. */
export const StatusTimeline: React.FC<{ entries: QuoteHistoryEntry[] }> = ({ entries }) => {
  if (entries.length === 0) return null
  const list = [...entries].reverse()
  return (
    <section className="rounded-xl border border-[#E4E4E3] bg-white p-4">
      <h2 className="text-[14px] font-semibold text-[#052F5F]">Application timeline</h2>
      <ol className="mt-3 space-y-4">
        {list.map((e, i) => {
          const tone = STATUS_INFO[e.to as QuoteStatus]?.tone ?? 'slate'
          return (
            <li key={e.id} className="relative flex gap-3">
              {i < list.length - 1 && <span aria-hidden className="absolute left-[7px] top-5 h-[calc(100%+4px)] w-px bg-[#E4E4E3]" />}
              <span className={`relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full ring-4 ring-white ${TONE_CLASSES[tone].customer.split(' ')[0]} border border-current ${TONE_CLASSES[tone].customer.split(' ')[1]}`} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#1C1D1F]">{headline(e)}</p>
                <p className="text-[11px] text-[#8F9194]">{when(e.at)}</p>
                {e.message && e.actor === 'admin' && <p className="mt-1 rounded-lg bg-[#F7F8FA] p-2.5 text-[12px] leading-[18px] text-[#45484D]">{e.message}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
