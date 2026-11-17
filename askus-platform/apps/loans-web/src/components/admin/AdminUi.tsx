import React from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2 } from 'lucide-react'

import { PAGE_SIZE } from './paging'

export const LoadingBlock: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
  <div role="status" className="flex items-center justify-center gap-2 px-5 py-14 text-sm text-slate-400">
    <Loader2 size={18} className="animate-spin" /> {label}
  </div>
)

export const ErrorBlock: React.FC<{ message?: string; onRetry?: () => void }> = ({ message = 'Could not load this data.', onRetry }) => (
  <div role="alert" className="flex flex-col items-center gap-3 px-5 py-12 text-center">
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/15 text-rose-400"><AlertTriangle size={22} /></span>
    <p className="max-w-sm text-sm text-slate-300">{message}</p>
    {onRetry && (
      <button type="button" onClick={onRetry} className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500">
        Try again
      </button>
    )}
  </div>
)

export const EmptyBlock: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-slate-500">
    <Inbox size={26} />
    <p className="text-sm">{text}</p>
  </div>
)

interface PagerProps {
  page: number
  total: number
  pageSize?: number
  onPage: (page: number) => void
}

/** Previous / next controls with a range summary. Renders nothing for a single page. */
export const Pager: React.FC<PagerProps> = ({ page, total, pageSize = PAGE_SIZE, onPage }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const from = page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  const btn = 'flex h-10 items-center gap-1 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-slate-800 px-4 py-3">
      <span className="text-[11px] text-slate-400">{from}-{to} of {total}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} disabled={page <= 0} onClick={() => onPage(page - 1)}><ChevronLeft size={14} /> Prev</button>
        <span className="text-[11px] text-slate-400">{page + 1} / {pages}</span>
        <button type="button" className={btn} disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next <ChevronRight size={14} /></button>
      </div>
    </nav>
  )
}

interface ConfirmProps {
  title: string
  message: React.ReactNode
  confirmLabel?: string
  tone?: 'primary' | 'danger'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmation for sensitive admin actions: a bottom sheet on phones, a centred dialog on larger screens. */
export const ConfirmDialog: React.FC<ConfirmProps> = ({ title, message, confirmLabel = 'Confirm', tone = 'primary', busy, onConfirm, onCancel }) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-t-2xl border border-slate-700 bg-slate-900 p-5 pb-6 shadow-2xl sm:rounded-2xl">
        <h3 className="text-base font-bold text-white">{title}</h3>
        <div className="mt-2 text-sm leading-relaxed text-slate-300">{message}</div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={onCancel} className="h-11 rounded-xl border border-slate-600 px-5 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`h-11 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50 ${tone === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-blue-600 hover:bg-blue-500'}`}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
