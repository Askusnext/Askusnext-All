import React, { useId, useState } from 'react'
import { Info } from 'lucide-react'
import { APPROVAL_COLORS, APPROVAL_LABELS, type ApprovalLevel } from '../../constants/quotesData'

/** Five-segment approval-chance meter with the label colour of the active level. */
export const ApprovalMeter: React.FC<{ level: ApprovalLevel }> = ({ level }) => {
  const [tip, setTip] = useState(false)
  const tipId = useId()
  const label = APPROVAL_LABELS[level]
  const color = APPROVAL_COLORS[level - 1]

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center gap-1 font-poppins text-[10px] font-medium leading-[15px] text-[#8F9194]">
        <span>Approval Chance</span>
        <button
          type="button"
          aria-label="About approval chance"
          aria-describedby={tip ? tipId : undefined}
          onMouseEnter={() => setTip(true)}
          onMouseLeave={() => setTip(false)}
          onFocus={() => setTip(true)}
          onBlur={() => setTip(false)}
          onClick={() => setTip((v) => !v)}
          className="rounded-full"
        >
          <Info className="h-[10px] w-[10px] text-[#0165fd] transition-colors hover:text-[#0052cc]" />
        </button>
        {tip && (
          <span id={tipId} role="tooltip" className="absolute left-1/2 top-full z-20 mt-1 w-[180px] -translate-x-1/2 rounded-md bg-[#1C1D1F] px-2.5 py-2 text-left text-[10px] font-normal leading-[14px] text-white shadow-lg">
            A demo estimate of how likely a lender is to approve your profile. Real lenders decide on their own policies.
          </span>
        )}
      </div>
      <div role="meter" aria-valuemin={1} aria-valuemax={5} aria-valuenow={level} aria-valuetext={label} aria-label={`Approval chance ${label}`} className="mt-1 w-full">
        <div className="flex h-2 w-full gap-[2px]">
          {APPROVAL_COLORS.map((c, i) => (
            <div
              key={c}
              className={`h-full min-w-0 flex-1 ${i === 0 ? 'rounded-l-[4px]' : i === 4 ? 'rounded-r-[4px]' : 'rounded-[1px]'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex w-full gap-[2px]">
          {APPROVAL_COLORS.map((c, i) => (
            <div key={c} className="flex min-w-0 flex-1 justify-center">
              {i + 1 === level ? (
                <span aria-hidden className="mt-[2px] h-0 w-0 border-x-[4px] border-b-[5px] border-x-transparent" style={{ borderBottomColor: color }} />
              ) : (
                <span aria-hidden className="mt-[2px] h-[5px]" />
              )}
            </div>
          ))}
        </div>
      </div>
      <span className="text-center font-poppins text-[12px] font-semibold" style={{ color }}>{label}</span>
    </div>
  )
}
