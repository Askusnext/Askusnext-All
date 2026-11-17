import React from 'react'
import { ChevronDown, Pencil, User } from 'lucide-react'
import { SORT_OPTIONS, type SortKey } from '../../constants/quotesData'
import type { QuoteTab } from '../../constants/quotesTypes'

export type Category = 'small' | 'large'

interface ProfileChipProps {
  authed: boolean
  loading: boolean
  name: string
  /** e.g. "Salaried | Income 8.4 Lakhs a year", or a prompt to complete the profile. */
  subtitle: string
  onEdit: () => void
  onLogin: () => void
  className?: string
}

/** Header chip showing the signed-in customer's real profile details. */
export const ProfileChip: React.FC<ProfileChipProps> = ({ authed, loading, name, subtitle, onEdit, onLogin, className = '' }) => (
  <div className={`flex min-w-0 flex-1 items-center justify-between gap-[12px] border-b border-[#E4E4E3] bg-white py-[8px] pl-[21px] pr-[20px] md:justify-end md:border-0 md:py-0 md:pl-0 md:pr-0 ${className}`}>
    {authed ? (
      <div className="flex min-w-0 items-start gap-2.5">
        <div aria-hidden className="flex shrink-0 items-center justify-center rounded-full bg-[#7EB6FF] p-[4px]">
          <User className="h-[16px] w-[16px] fill-white text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-poppins text-[16px] font-medium leading-[18px] text-[#1C1D1F]">{loading ? 'Loading...' : name}</p>
          <div className="mt-[2px] flex items-end gap-[8px]">
            <p className="font-poppins text-[10px] font-normal leading-[16px] text-[#1C1D1F]">{loading ? '' : subtitle}</p>
            <button type="button" onClick={onEdit} className="shrink-0 font-poppins text-[10px] font-medium leading-[16px] text-[#0066FF] underline underline-offset-2">Edit</button>
          </div>
        </div>
      </div>
    ) : (
      <div className="flex items-center gap-3">
        <p className="font-poppins text-[11px] text-[#6A6D71]">Sign in for offers based on your profile</p>
        <button type="button" onClick={onLogin} className="rounded-md border border-[#0066ff] px-4 py-1.5 font-poppins text-[12px] font-semibold text-[#0066ff] hover:bg-[#f2f7ff]">Login</button>
      </div>
    )}
  </div>
)

interface TileProps {
  label: string
  value: string
  onClick: () => void
  /** Sidebar tiles are cards; the mobile strip tiles are flat. */
  variant: 'card' | 'flat'
}

export const ValueTile: React.FC<TileProps> = ({ label, value, onClick, variant }) =>
  variant === 'card' ? (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="flex h-[54px] w-full max-w-full flex-1 cursor-pointer items-center justify-between gap-2 rounded-[8px] border-t-2 border-[#66A3FF] bg-white px-[16px] py-[16px] text-left shadow-[0_-2px_6px_rgba(61,61,61,0.03),0_10px_20px_rgba(61,61,61,0.12)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b5fff]"
    >
      <div className="flex w-full min-w-0 flex-col gap-0.5">
        <span className="font-poppins text-[12px] font-medium leading-[18px] text-[#25385899]">{label}</span>
        <div className="flex w-[124px] items-center justify-between">
          <span className="flex items-center gap-[8px] truncate font-poppins text-[14px] font-semibold leading-[20px] text-[#1C1D1F]">
            {value}
            <Pencil className="h-[14px] w-[14px] text-[#0066FF]" />
          </span>
        </div>
      </div>
    </button>
  ) : (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="flex h-[56px] w-full min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b5fff]"
    >
      <div className="flex w-full min-w-0 flex-col gap-0.5">
        <span className="font-poppins text-[12px] font-medium leading-[18px] text-[#6A6D71]">{label}</span>
        <div className="flex w-full items-center justify-between">
          <span className="truncate font-poppins text-[14px] font-semibold leading-[20px] text-[#1C1D1F]">{value}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-black" />
        </div>
      </div>
    </button>
  )

export const CategoryTabs: React.FC<{ tabs: QuoteTab[]; value: Category; onChange: (c: Category) => void }> = ({ tabs, value, onChange }) => {
  return (
    <div className="shrink-0">
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-[1367px] items-center gap-3 px-4 pb-[8px] pt-[12px] md:px-[80px] md:pt-[8px]">
          <div className="flex flex-1 justify-center">
            <div className="flex w-max gap-2 rounded-[14px] bg-transparent" role="radiogroup" aria-label="Choose loan category">
              {tabs.map((t) => {
                const on = t.id === value
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onChange(t.id as Category)}
                    className={`relative flex h-[36px] min-h-[44px] w-[160px] flex-1 flex-col items-center justify-center gap-1 rounded-[10px] px-[8px] py-[8px] text-center transition ${
                      on ? 'border-t-[2px] border-[#7CD192] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)]' : 'border border-transparent bg-[#D9E8FF80] hover:bg-[#D9E8FF]'
                    }`}
                  >
                    <span className={`font-poppins text-[10px] font-medium leading-[14px] md:text-[14px] md:leading-[22px] ${on ? 'text-[#06f]' : 'text-[#373A3E]'}`}>{t.title}</span>
                    <span
                      key={on ? 'on' : 'off'}
                      className="flex items-center justify-center gap-1 whitespace-nowrap text-center font-poppins text-[8px] font-medium leading-[12px] text-[#45484D] md:text-[10px] md:leading-[16px]"
                      style={on ? { animation: '0.5s ease-out 0s 1 normal forwards running slideInFromBottom' } : undefined}
                    >
                      {t.sub}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const SortCard: React.FC<{ value: SortKey; onChange: (k: SortKey) => void; titleId?: string }> = ({ value, onChange, titleId = 'sort-title' }) => (
  <aside className="w-[263px] max-w-full shrink-0 rounded-[14px] bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.08)]">
    <h2 id={titleId} className="font-poppins text-[14px] font-bold leading-[20px] text-[#052F5F]">Sort by</h2>
    <SortOptions value={value} onChange={onChange} labelledBy={titleId} />
  </aside>
)

export const SortOptions: React.FC<{ value: SortKey; onChange: (k: SortKey) => void; labelledBy: string }> = ({ value, onChange, labelledBy }) => (
  <div className="mt-5 flex flex-col gap-5" role="radiogroup" aria-labelledby={labelledBy}>
    {SORT_OPTIONS.map((o) => {
      const on = o.key === value
      return (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={on}
          onClick={() => onChange(o.key)}
          className="flex w-full cursor-pointer items-start gap-[10px] rounded-lg text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#0b5fff] focus-visible:ring-offset-2"
        >
          <span aria-hidden className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 bg-white ${on ? 'border-[#0b5fff]' : 'border-[#3d4f66]'}`}>
            {on && <span className="block h-2 w-2 rounded-full bg-[#0b5fff]" />}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className={`font-poppins text-[13px] font-bold leading-[20px] ${on ? 'text-[#0b5fff]' : 'text-[#1A2B49]'}`}>{o.title}</span>
            <span className={`font-poppins text-[11px] font-normal leading-[16px] ${on ? 'text-[#5b8def]' : 'text-[#8b96a8]'}`}>{o.sub}</span>
          </span>
        </button>
      )
    })}
  </div>
)
