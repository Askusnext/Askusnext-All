import React from 'react'
import { ArrowLeft, ShieldCheck, UserRound } from 'lucide-react'
import type { QuoteLender } from '../../constants/quotesData'
import { formatAmountLabel } from '../../utils/quotes'
import { QuotesHeaderLogo } from './QuotesSections'

interface FlowShellProps {
  title: string
  lender?: QuoteLender
  /** Loan the customer is applying for; shown in the left panel on desktop. */
  summary?: { typeName: string; amount: number; tenure: number }
  onBack: () => void
  /** Heading, text and icon of the blue panel; defaults to the "get to know you" copy. */
  panel?: { title: string; text: string; icon?: React.ReactNode }
  /** Pinned under the scrolling content (Proceed button etc.). */
  footer?: React.ReactNode
  children: React.ReactNode
}

const REASONS = [
  { icon: 'calculators_icon.svg', text: 'Plan your EMI before you apply' },
  { icon: 'secure.svg', text: 'Details saved once in your profile' },
  { icon: 'trustworthy.svg', text: 'Visible only to you and authorised staff' },
  { icon: 'helpful.svg', text: 'Help available if you get stuck' },
]

/**
 * Layout shared by the application steps. The page is exactly one screen high:
 * the content area scrolls and the footer stays pinned beneath it, so nothing is
 * ever hidden behind the button. On desktop an information panel sits to the left.
 */
export const FlowShell: React.FC<FlowShellProps> = ({ title, lender, summary, onBack, panel, footer, children }) => (
  <div className="flex h-[100dvh] flex-col bg-[#F5F5F5] font-poppins">
    <header className="z-20 shrink-0 border-b border-[#E5E5E5] bg-white">
      <div className="mx-auto flex h-[64px] w-full max-w-[1100px] items-center gap-2 px-4 md:px-6">
        <button type="button" aria-label="Go back" onClick={onBack} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#1C1D1F] hover:bg-[#F5F5F5]">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <QuotesHeaderLogo />
          {lender && <img alt={lender.name} className="h-[29px] w-auto max-w-[120px] object-contain md:h-[36px]" src={`/assets/images/lenders/${lender.logo}.png`} />}
        </div>
      </div>
    </header>

    <div className="mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col md:flex-row md:gap-6 md:px-6 md:py-5">
      {/* Left information panel (desktop) */}
      <aside className="hidden w-[42%] max-w-[440px] shrink-0 flex-col overflow-y-auto rounded-2xl bg-[#F2F7FF] md:flex">
        <div className="relative bg-[#0052cc] px-8 pb-14 pt-7 text-center text-white">
          <span className="mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-full bg-[#0a43a8]">
            {panel?.icon ?? <UserRound size={34} />}
          </span>
          <h2 className="mt-3 text-[22px] font-semibold leading-8">{panel?.title ?? "Let's Get to Know You"}</h2>
          <p className="mx-auto mt-2 max-w-[260px] text-[14px] leading-5 text-blue-100">{panel?.text ?? 'Help us get to know you better for your loan application.'}</p>
        </div>
        <div className="relative -mt-9 px-6">
          <div className="flex items-center gap-3 rounded-full bg-white px-4 py-3 shadow-[0_8px_24px_rgba(0,52,140,0.18)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D9E8FF] text-[#0066FF]">
              <ShieldCheck size={24} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-[#052F5F]">Your details stay private</p>
              <p className="text-[12px] text-[#6A6D71]">Saved to your own profile</p>
            </div>
          </div>
        </div>
        <div className="flex-1 px-8 pb-5 pt-6">
          <p className="text-[12px] uppercase tracking-wide text-[#6A6D71]">Why apply with Askus Financial Services</p>
          <ul className="mt-3 space-y-3">
            {REASONS.map((r) => (
              <li key={r.text} className="flex items-center gap-3 text-[14px] text-[#1C1D1F]">
                <img alt="" width={26} height={26} className="shrink-0" src={`/assets/pb/${r.icon}`} />
                {r.text}
              </li>
            ))}
          </ul>
        </div>
        {summary && (
          <div className="mx-6 mb-5 flex shrink-0 items-center gap-3 rounded-xl bg-white p-4">
            {lender && (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#E4E4E3]">
                <img alt="" className="h-7 w-7 object-contain" src={`/assets/images/lenders/${lender.logo}.png`} />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[#052F5F]">{lender ? `${lender.name} · ${summary.typeName}` : summary.typeName}</p>
              <p className="text-[12px] text-[#6A6D71]">{formatAmountLabel(summary.amount)} over {summary.tenure} months</p>
            </div>
          </div>
        )}
      </aside>

      {/* Form column */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col md:overflow-hidden md:rounded-2xl md:bg-white">
        <h1 className="shrink-0 px-5 pb-3 pt-4 text-[20px] font-semibold leading-7 tracking-[0.01em] text-[#1C1D1F] md:px-8 md:pb-2 md:pt-6 md:text-[24px] md:leading-8">{title}</h1>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-t-[24px] bg-white px-5 pb-6 pt-5 md:rounded-none md:px-8 md:pt-3">{children}</div>
        {footer && <div className="shrink-0 bg-white px-5 pb-4 pt-3 shadow-[0_-8px_16px_rgba(0,0,0,0.04)] md:px-8">{footer}</div>}
      </section>
    </div>
  </div>
)
