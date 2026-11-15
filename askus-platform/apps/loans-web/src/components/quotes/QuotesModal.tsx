import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface QuotesModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Render as a bottom sheet on small screens (default) */
  maxWidth?: string
}

/** Accessible dialog: Esc and backdrop close, focus moves in and returns, page scroll locked. */
export const QuotesModal: React.FC<QuotesModalProps> = ({ title, onClose, children, maxWidth = 'max-w-md' }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90dvh] w-full ${maxWidth} overflow-y-auto rounded-t-[20px] bg-white p-5 font-poppins shadow-2xl outline-none sm:rounded-[16px]`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-[16px] font-semibold leading-6 text-[#052F5F]">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1 text-[#6A6D71] hover:bg-[#F5F5F5]">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
