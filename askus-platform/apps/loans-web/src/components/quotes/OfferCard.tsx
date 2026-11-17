import React from 'react'
import { formatLimit } from '../../constants/quotesData'
import { formatRoi, formatRupee, type PricedLender } from '../../utils/quotes'
import { ApprovalMeter } from './ApprovalMeter'

interface OfferCardProps {
  lender: PricedLender
  cta: 'Resume' | 'Apply Now'
  onCta: (l: PricedLender) => void
  onKfs: (l: PricedLender) => void
  /** Extra text after the limit, e.g. the loan type. */
  tag?: string
  /** Shows a small "Remove" link (used for in-progress applications). */
  onDiscard?: () => void
  /** Used by the horizontal carousel, which gives each card a slide wrapper. */
  className?: string
}

const Logo: React.FC<{ lender: PricedLender; tag?: string }> = ({ lender, tag }) => (
  <div className="flex min-w-0 max-w-[inherit] items-center gap-3 md:flex-col md:items-start">
    <div className="rounded-[4px] border border-[#E4E4E3] p-[4px]">
      <img alt="" className="h-[24px] w-[24px] shrink-0 md:h-[32px] md:w-[32px]" loading="lazy" src={`/assets/images/lenders/${lender.logo}.png`} />
    </div>
    <div className="min-w-0 max-w-[inherit]">
      <h3 className="truncate font-poppins text-[12px] font-bold leading-[24px] text-[#052F5F] md:text-[16px] md:leading-[22px]">{lender.name}</h3>
      <p className="font-poppins text-[11px] font-medium leading-[22px] text-[#1A50A6] md:text-[12px] md:leading-[18px]">{formatLimit(lender.maxAmount)}{tag ? ` · ${tag}` : ''}</p>
    </div>
  </div>
)

const Stats: React.FC<{ lender: PricedLender; onKfs: () => void; gap: string }> = ({ lender, onKfs, gap }) => (
  <>
    <div className="min-w-0 flex-[1_1_0%]">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-poppins text-[10px] font-medium leading-[15px] text-[#8F9194]">ROI Starting at</span>
          <span className="font-poppins whitespace-nowrap text-[14px] font-bold leading-[27px] text-[#052F5F]">{formatRoi(lender.roi)}</span>
        </div>
        <p className="font-poppins text-[8px] leading-[12px] text-[#253858E3] md:text-[10px] md:leading-[14px]">
          <button type="button" onClick={onKfs} className="whitespace-nowrap font-medium text-[#0066FF] underline decoration-[#0066FF] underline-offset-2">
            Provisional KFS &amp; Charges
          </button>
        </p>
      </div>
    </div>
    <div className="min-w-0 flex-[1_1_0%]">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-poppins text-[10px] font-medium leading-[15px] text-[#8F9194]">Monthly EMI</span>
        <span className="font-poppins whitespace-nowrap text-[14px] font-bold leading-[27px] text-[#052F5F]">{formatRupee(lender.emi)}</span>
      </div>
    </div>
    <div className="min-w-0 flex-[1_1_0%]">
      <div className={`flex w-full min-w-0 ${gap} flex-col items-stretch text-center md:max-w-full md:items-start md:text-left`}>
        <ApprovalMeter level={lender.approval} />
      </div>
    </div>
  </>
)

export const OfferCard: React.FC<OfferCardProps> = ({ lender, cta, onCta, onKfs, tag, onDiscard, className = '' }) => {
  const button =
    cta === 'Resume'
      ? 'bg-[#24B24A] text-white hover:bg-[#24B24A]/90 md:min-w-[120px] md:max-w-[120px] min-w-[100px] max-w-[100px]'
      : 'bg-[#0066ff] text-white hover:bg-[#0066ff]/90 min-w-[140px] max-w-[140px]'
  const base =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b5fff] disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <article className={`relative flex w-full flex-col overflow-visible rounded-xl border-x-[0.5px] border-b-[0.5px] border-t-[3px] border-[#A4D1FF] bg-white shadow-[0_4px_8px_0_rgba(0,0,0,0.08)] md:rounded-[12px] ${className}`}>
      {/* Mobile layout */}
      <div className="flex flex-col px-4 py-4 md:hidden">
        <div className="flex items-center justify-between gap-3 border-b border-dashed border-[#E8EDF3] pb-4">
          <Logo lender={lender} tag={tag} />
          <button type="button" onClick={() => onCta(lender)} className={`${base} h-[40px] rounded-lg px-4 py-2 font-poppins text-[12px] font-semibold leading-[20px] ${button}`}>
            {cta}
          </button>
        </div>
        <div className="flex w-full min-w-0 flex-nowrap items-start gap-x-3 pt-4 sm:gap-x-4">
          <Stats lender={lender} onKfs={() => onKfs(lender)} gap="max-w-[88px]" />
        </div>
        {onDiscard && (
          <button type="button" onClick={onDiscard} className="mt-3 self-end font-poppins text-[11px] text-[#6A6D71] underline underline-offset-2 hover:text-rose-600">Remove</button>
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden min-w-0 md:flex md:flex-row md:items-center md:justify-between md:gap-6 md:px-5 md:py-5">
        <div className="flex min-w-[min(100%,10rem)] max-w-[min(100%,10rem)] shrink-0">
          <Logo lender={lender} tag={tag} />
        </div>
        <div className="flex min-w-0 flex-1 flex-nowrap items-start justify-between gap-4 lg:gap-8">
          <Stats lender={lender} onKfs={() => onKfs(lender)} gap="" />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1.5 self-center pl-2">
          <button type="button" onClick={() => onCta(lender)} className={`${base} h-10 rounded-lg px-8 py-2.5 font-poppins text-[14px] font-semibold leading-5 shadow-sm ${button}`}>
            {cta}
          </button>
          {onDiscard && (
            <button type="button" onClick={onDiscard} className="font-poppins text-[11px] text-[#6A6D71] underline underline-offset-2 hover:text-rose-600">Remove</button>
          )}
        </div>
      </div>
    </article>
  )
}
