import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronRight, Phone, Zap } from 'lucide-react'
import { ALWAYS_UNMATCHED, STRIP_LOGOS, TESTIMONIALS, type QuoteLender } from '../../constants/quotesData'
import { OfferCard } from './OfferCard'
import { QuotesModal } from './QuotesModal'
import type { OngoingItem, PricedLender } from '../../utils/quotes'

export const QuotesHeaderLogo: React.FC = () => (
  <Link to="/" className="flex items-center gap-2" aria-label="Askus Financial Services home">
    <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-[#0052cc] to-[#0066ff] text-white md:h-[36px] md:w-[36px]">
      <Zap className="h-[18px] w-[18px] fill-current" />
    </span>
    <span className="font-poppins text-[20px] font-bold leading-none tracking-tight text-[#052F5F] md:text-[22px]">
      Askus <span className="block text-[11px] leading-4 text-[#0066FF]">Financial Services</span>
    </span>
  </Link>
)

/* ---------- On going applications carousel ---------- */

interface OngoingProps {
  items: OngoingItem[]
  authed: boolean
  loaded: boolean
  error: boolean
  onLogin: () => void
  onResume: (l: OngoingItem) => void
  onDiscard: (l: OngoingItem) => void
  onKfs: (l: PricedLender) => void
}

export const OngoingCarousel: React.FC<OngoingProps> = ({ items, authed, loaded, error, onLogin, onResume, onDiscard, onKfs }) => {
  const track = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ left: true, right: false })

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    setEdge({ left: el.scrollLeft <= 2, right: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure, items.length])

  const scrollBy = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * (track.current.clientWidth * 0.9), behavior: 'smooth' })

  const arrow = (dir: 1 | -1, disabled: boolean) => (
    <button
      type="button"
      aria-label={dir === 1 ? 'Scroll right' : 'Scroll left'}
      disabled={disabled}
      onClick={() => scrollBy(dir)}
      className={`flex h-[25px] w-[25px] items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#052F5F] ${
        disabled ? 'cursor-not-allowed bg-[#D1D5DB]' : 'bg-[#0b5fff] hover:bg-[#0a54e6] active:bg-[#0948d4]'
      }`}
    >
      {dir === 1 ? <ArrowRight className="h-[14px] w-[14px] text-white" /> : <ArrowLeft className="h-[14px] w-[14px] text-white opacity-80" />}
    </button>
  )

  const showEmpty = items.length === 0
  return (
    <section className="flex w-full min-w-0 max-w-full flex-col gap-[4px]">
      <div className="flex min-w-0 max-w-full items-center justify-between gap-3 sm:gap-4">
        <h2 className="min-w-0 flex-1 truncate pl-[13px] font-poppins text-[14px] font-semibold leading-[20px] text-[#052F5F] sm:text-[18px] sm:leading-[28px] md:pl-0 md:text-lg md:leading-7">
          On Going Applications ({items.length})
        </h2>
        {!showEmpty && (
          <div className="flex shrink-0 gap-2">
            {arrow(-1, edge.left)}
            {arrow(1, edge.right)}
          </div>
        )}
      </div>
      {showEmpty ? (
        <div className="mx-[13px] mt-2 rounded-xl border border-dashed border-[#A4D1FF] bg-white/70 px-4 py-5 font-poppins md:mx-0">
          {!authed ? (
            <>
              <p className="text-[13px] font-semibold text-[#052F5F]">Sign in to see applications you have started</p>
              <p className="mt-1 text-[12px] text-[#6A6D71]">Applications you begin are saved to your account so you can resume them later.</p>
              <button type="button" onClick={onLogin} className="mt-3 rounded-lg bg-[#0066ff] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#0052cc]">Login with OTP</button>
            </>
          ) : !loaded ? (
            <p className="text-[12px] text-[#6A6D71]">Loading your applications...</p>
          ) : error ? (
            <p role="alert" className="text-[12px] text-rose-600">We could not load your applications. Please refresh and try again.</p>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-[#052F5F]">No applications in progress</p>
              <p className="mt-1 text-[12px] text-[#6A6D71]">When you choose Apply Now on an offer and leave before finishing, it will appear here so you can resume it.</p>
            </>
          )}
        </div>
      ) : (
        <div
          ref={track}
          onScroll={measure}
          className="quotes-scroll-none flex h-[220px] w-full min-w-0 max-w-full snap-x snap-mandatory items-center gap-4 overflow-x-auto overflow-y-visible overscroll-x-contain md:h-auto md:px-[16px] md:py-[14px]"
        >
          {items.map((l) => (
            <div key={l.docId} className="quotes-v2-h-slide box-border max-w-full shrink-0 flex-[0_0_85%] snap-center self-center first:ml-[7.5%] last:mr-[7.5%] md:flex-[0_0_min(90%,calc(100%-1.25rem))] md:first:ml-0 md:last:mr-0">
              <OfferCard lender={l} tag={l.tag} cta="Resume" onCta={() => onResume(l)} onKfs={onKfs} onDiscard={() => onDiscard(l)} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ---------- Rate alert ---------- */

const RepoBox: React.FC = () => (
  <div className="flex w-full min-w-0 items-end justify-between gap-2 rounded-[12px] border border-[#FFD2B8] bg-white py-3 pl-3 pr-2 md:pl-3.5">
    <div className="flex shrink-0 flex-col items-start self-center">
      <p className="font-poppins text-[12px] font-normal leading-[18px] text-[#6A6D71]">Repo rate</p>
      <p className="font-poppins text-[16px] font-semibold leading-[24px] text-[#1C1D1F] md:text-[20px] md:leading-[30px]">5.50%</p>
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#FFF0D9] px-2.5 py-1 font-poppins text-[10px] font-semibold leading-[14px] text-[#663D00] md:text-[14px] md:leading-[22px]">
        <img alt="up" width={16} height={16} src="/assets/icons/frame.svg" />0.25%
      </span>
    </div>
    <div className="relative aspect-[184/77] w-full min-w-0 max-w-[184px]">
      <p className="absolute right-[25px] top-0 whitespace-nowrap font-poppins text-[8px] font-medium leading-[14px] text-[#CC7A00] md:text-[10px]">may rise further</p>
      <svg aria-hidden xmlns="http://www.w3.org/2000/svg" viewBox="0 0 183 79" preserveAspectRatio="none" fill="none" className="absolute inset-0 top-[3px] h-full w-full">
        <path d="M182.222 78.7266V0L146.68 25.1034H110.01V42.0281H73.3402V58.9528H44.6419H34.0508V73.762H0V78.7266H182.222Z" fill="#FFFAF2" />
      </svg>
      <img alt="" className="absolute bottom-0 left-0 w-[80%]" src="/assets/icons/risingStaircase.svg" />
      <img alt="" className="absolute left-[77.9%] top-0 w-[22.2%]" src="/assets/icons/rising.svg" />
    </div>
  </div>
)

const FixedRateNote: React.FC<{ note: string }> = ({ note }) => (
  <div className="flex min-w-0 items-start gap-1.5">
    <span className="mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#DEF3E4]">
      <img alt="" width={10} height={10} src="/assets/icons/lock.svg" />
    </span>
    <p className="min-w-0 font-poppins text-[10px] font-normal leading-[16px] text-[#1C1D1F] md:text-[12px] md:leading-[18px]">
      {note}
    </p>
  </div>
)

export const RateAlert: React.FC<{ note: string }> = ({ note }) => (
  <section aria-label="Rate alert" className="quotes-bg-rate-alert flex w-full min-w-0 flex-col gap-3 rounded-[16px] border border-[#FFE0CF] px-3 py-3 md:flex-row md:items-center md:justify-between md:gap-6 md:px-4 md:py-3.5">
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="font-poppins text-[10px] font-semibold uppercase leading-[16px] tracking-[0.04em] text-[#995C00] md:text-[14px] md:leading-[22px]">Rate alert</div>
        <div className="font-poppins text-[12px] font-semibold leading-[18px] text-[#1C1D1F] md:text-[16px] md:leading-[24px]">Interest rates can change. Compare today’s rates.</div>
      </div>
      <FixedRateNote note={note} />
      <div className="min-w-0 md:hidden"><RepoBox /></div>
      <div className="min-w-0 font-poppins text-[8px] font-normal leading-[12px] text-[#9B9B9D] md:text-[10px] md:leading-[16px]">
        Illustrative figures for demonstration only. Interest rates are set by lenders and may change.
      </div>
    </div>
    <div className="hidden w-[46%] min-w-0 max-w-[380px] shrink md:block"><RepoBox /></div>
  </section>
)

/* ---------- Why section ---------- */

export const WhySection: React.FC<{ title: string }> = ({ title }) => {
  const [more, setMore] = useState(false)
  const points = [
    { img: 'handshake_money.png', bg: 'bg-[#EEFBF5]', text: 'Compare lenders side by side before you apply' },
    { img: 'growth_chart_money.png', bg: 'bg-[#FFF9EA]', text: 'See the EMI and total cost for your amount and tenure' },
    { img: 'agent_assistance.png', bg: 'bg-[#F4F2FF]', text: 'Support from your first question to a finished application' },
  ]
  return (
    <div className="flex flex-col gap-4 min-[321px]:max-md:px-[16px] max-[320px]:px-[8px]">
      <section aria-label="Why Askus Financial Services?" className="flex w-full flex-col gap-4 rounded-[16px] border border-[#EAEAEA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.06)] md:gap-5 md:p-5">
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <p className="font-poppins text-[10px] font-medium uppercase leading-[16px] text-[#45484D] md:text-[16px] md:leading-[24px]">Why Askus Financial Services?</p>
            <h2 className="font-poppins text-[14px] font-semibold leading-[22px] text-[#1C1D1F] md:text-[18px] md:leading-[28px]">{title}</h2>
            <button
              type="button"
              aria-expanded={more}
              onClick={() => setMore((v) => !v)}
              className="hidden items-center gap-0.5 font-poppins text-[12px] font-medium text-[#0066FF] underline decoration-dotted underline-offset-[25%] md:inline-flex"
            >
              Know more<ChevronRight className={`h-4 w-4 transition ${more ? 'rotate-90' : ''}`} />
            </button>
          </div>
          <div className="flex w-full shrink-0 items-stretch gap-2 self-stretch md:w-auto md:items-center md:gap-0 md:rounded-[8px] md:bg-[#F2F7FF] md:py-3.5">
            {[['10', 'lender sources'], ['4', 'loan types to apply for']].map(([n, l], i) => (
              <React.Fragment key={l}>
                {i > 0 && <div className="hidden h-8 w-px shrink-0 bg-[#E4E4E3] md:block" />}
                <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-[12px] bg-[#F7F8FA] px-3 py-3 text-center md:min-w-[120px] md:rounded-none md:bg-transparent md:px-4 md:py-0">
                  <p className="whitespace-nowrap font-poppins text-[16px] font-semibold leading-[24px] text-[#0066FF] md:text-[18px] md:leading-[26px]">{n}</p>
                  <p className="whitespace-nowrap font-poppins text-[10px] font-medium uppercase leading-[16px] text-[#6A6D71] md:text-[12px] md:normal-case md:leading-[18px]">{l}</p>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
        {more && (
          <p className="hidden rounded-lg bg-[#F7F8FA] p-3 font-poppins text-[12px] leading-[18px] text-[#45484D] md:block">
            Askus Financial Services helps you compare information and plan before you apply. Lenders alone decide eligibility, rates, fees and approval, and the offers on this page are sample data.
          </p>
        )}
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
          {points.map((p) => (
            <div key={p.img} className={`flex min-w-0 gap-2 rounded-[8px] px-2 py-2 md:gap-3 md:py-3 ${p.bg}`}>
              <img alt="" width={28} height={28} className="shrink-0 object-contain" src={`/assets/images/${p.img}`} />
              <p className="min-w-0 font-poppins text-[10px] font-semibold leading-[16px] text-[#1C1D1F] md:text-[12px] md:leading-[18px]">{p.text}</p>
            </div>
          ))}
        </div>
        <div className="flex w-full flex-col items-center gap-3">
          <div className="w-[815px] max-w-full border-t border-dashed border-[#D0D1D2]" />
          <p className="text-center font-poppins text-[12px] font-semibold uppercase leading-[18px] tracking-[0.02em] text-[#1C1D1F]">India&apos;s top lenders in one place</p>
          <div className="w-full overflow-hidden">
            <div className="quotes-marquee flex w-max">
              {[false, true].map((hidden) => (
                <div key={String(hidden)} aria-hidden={hidden} className="flex shrink-0 gap-2 pr-2 md:gap-3 md:pr-3">
                  {STRIP_LOGOS.map((id) => (
                    <div key={id} className="flex h-[22px] w-[50.286px] shrink-0 flex-col items-center justify-center rounded-[3px] border border-[#EAEAEA] bg-white px-[6.286px] py-[3.143px] md:h-[28px] md:w-[64px] md:rounded-[8px] md:px-2 md:py-1">
                      <img alt="" className="h-4 w-auto max-w-full object-contain" src={`/assets/icons/lenders/${id}.svg`} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ---------- Unmatched offers ---------- */

export const UnmatchedOffers: React.FC<{ extra: QuoteLender[] }> = ({ extra }) => {
  const items = [...extra.map((l) => ({ name: l.name, logo: l.logo })), ...ALWAYS_UNMATCHED]
  return (
    <section aria-label="Unmatched Offers" className="w-full overflow-hidden rounded-[10px] border border-[#E4E4E3] bg-[#F7F8FA] px-4 py-4 md:px-5 md:py-5">
      <div className="flex flex-col items-start gap-1">
        <h2 className="font-poppins text-[16px] font-semibold leading-[24px] text-[#052F5F] md:text-[18px] md:leading-[26px]">Unmatched Offers</h2>
        <p className="font-poppins text-[12px] font-normal leading-[18px] text-[#6A6D71] md:text-[14px] md:leading-[22px]">This could be due to lender policies, your credit score or previous loan history</p>
      </div>
      <div tabIndex={0} className="quotes-scroll-none mt-4 w-full min-w-0 snap-x snap-mandatory overflow-x-auto overflow-y-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0066FF]">
        <div className="flex w-max items-stretch gap-3 md:gap-4">
          {items.map((u) => (
            <div key={u.name} className="flex h-[64px] w-[220px] shrink-0 snap-start items-center gap-3 rounded-[10px] border-[0.5px] border-t-[3px] border-solid border-[#FFACD5] bg-white px-3 shadow-[0_0_8px_0_rgba(0,0,0,0.08)] md:h-[72px] md:w-[244px] md:px-3.5">
              <img width={32} height={32} alt="" loading="lazy" className="h-7 w-7 shrink-0 object-contain md:h-8 md:w-8" src={`/assets/images/lenders/${u.logo}.png`} />
              <div className="min-w-0">
                <p className="truncate font-poppins text-[13px] font-semibold leading-[20px] text-[#052F5F] md:text-[14px]">{u.name}</p>
                <p className="font-poppins text-[11px] font-medium leading-[16px] text-[#6A6D71] md:text-[12px] md:leading-[18px]">Not Eligible</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- Testimonials ---------- */

export const Testimonials: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const [story, setStory] = useState<string | null>(null)

  return (
    <div className="relative flex max-w-[1200px] flex-col gap-4 pb-5 pt-[32px] font-poppins">
      <div className="pl-[13px] text-2xl font-semibold leading-9 text-[#1C1D1F]">Video Testimonials</div>
      <div
        ref={ref}
        tabIndex={0}
        aria-label="Video testimonials"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') ref.current?.scrollBy({ left: 284, behavior: 'smooth' })
          if (e.key === 'ArrowLeft') ref.current?.scrollBy({ left: -284, behavior: 'smooth' })
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse' || !ref.current) return
          drag.current = { x: e.clientX, left: ref.current.scrollLeft }
        }}
        onPointerMove={(e) => {
          if (drag.current && ref.current) ref.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
        className="quotes-scroll-none flex cursor-grab select-none gap-[20px] overflow-x-auto pl-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0066FF] active:cursor-grabbing"
      >
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className="mb-4 w-[264px] shrink-0 md:mb-0">
            <div className="flex h-[264px] w-[264px] flex-col overflow-hidden rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.1)] md:h-[212px] md:w-[304px] md:shadow-none">
              <div className={`relative block h-[220px] w-full overflow-hidden bg-gradient-to-br ${t.tone} md:h-[170px]`}>
                <div className="absolute left-4 right-6 top-4 z-[2] text-white">
                  <div className="max-w-[140px] text-sm font-medium leading-[22px] max-[480px]:text-[13px] max-[480px]:leading-[19px]">
                    <span className="text-base font-light leading-[0.8] opacity-90">″</span> {t.quote} <span className="text-base font-light leading-[0.8] opacity-90">″</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStory(t.name)}
                  className="absolute bottom-4 left-4 z-[3] flex max-h-[34px] items-center gap-[10px] rounded-[24px] bg-[#FFFFFF4D] px-2 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.1)] backdrop-blur-[8px] transition-all duration-300 hover:bg-[#FFFFFF80] max-[480px]:bottom-5 max-[480px]:left-5 max-[480px]:gap-2 max-[480px]:px-4 max-[480px]:py-2.5"
                >
                  <img alt="" className="h-[23.75px] w-[23.75px]" src="/assets/icons/play.svg" />
                  <span className="whitespace-nowrap text-xs font-medium leading-[18px] text-white max-[480px]:text-[11px] max-[480px]:leading-4">Watch the Story</span>
                </button>
              </div>
              <div className="flex h-[42px] items-center gap-[7.5px] bg-white px-[15px] py-2.5 md:h-8">
                <div className="text-sm font-medium leading-[22px] text-[#1c1d1f] md:text-xs md:leading-[18px]">{t.name}</div>
                <div className="relative top-[-1.5px] text-[#D9D9D9]">|</div>
                <div className="text-xs font-medium leading-[18px] text-[#6A6D71]">{t.city}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {story && (
        <QuotesModal title="Video testimonial" onClose={() => setStory(null)}>
          <p className="font-poppins text-[13px] leading-5 text-[#45484D]">
            “{story}” is a placeholder. The reference page links to customer videos; this demo has none to play.
          </p>
        </QuotesModal>
      )}
    </div>
  )
}

/* ---------- Disclosures ---------- */

export const Disclosures: React.FC = () => {
  const [open, setOpen] = useState(false)
  return (
    <div className="md:ml-[6px]">
      <div className="w-full overflow-hidden rounded-lg border border-[#e4e4e3] bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1)] md:rounded-md">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between bg-[#f8f9fa] px-4 py-3 text-left transition-colors md:px-5 md:py-4"
        >
          <h3 className="m-0 font-poppins text-sm font-semibold text-[#1C1D1F] md:text-base">Disclosures</h3>
          <span aria-hidden className="flex h-5 w-5 items-center justify-center text-lg font-bold text-[#007bff] md:text-xl">{open ? '−' : '+'}</span>
        </button>
        {open && (
          <div className="space-y-2 border-t border-[#e4e4e3] bg-white px-4 py-4 font-poppins text-[12px] leading-[18px] text-[#45484D] md:px-5">
            <p>Lender rates, limits and offers on this page are sample data for demonstration; no lender has offered or approved anything shown here. Lender names and logos belong to their owners. Your name, income and in-progress applications come from your Askus Financial Services account, and approval chances are estimated from the income in your profile.</p>
            <p>Askus Financial Services does not lend money. Interest rates, fees, limits, eligibility and approval are determined by each lender, and an application is not a guarantee of a loan.</p>
            <p>Calculated EMIs use the reducing-balance method on the amount, tenure and rate shown.</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Request a call floating button ---------- */

export const RequestCallFab: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <div className="fixed bottom-[100px] right-[20px] z-[10] md:bottom-20">
    <button
      type="button"
      onClick={onClick}
      aria-label="Request a Call"
      className="group relative flex h-10 w-10 items-center overflow-hidden rounded-full bg-[#32B63C] shadow-lg transition-all duration-700 ease-out hover:w-[150px] focus-visible:w-[150px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b5fff]"
    >
      <span className="relative z-10 mx-auto flex shrink-0 items-center justify-center group-hover:mx-3 group-focus-visible:mx-3">
        <Phone size={18} className="quotes-bounce-first relative z-20 text-white" />
      </span>
      <span className="max-w-0 flex-1 translate-x-4 overflow-hidden whitespace-nowrap text-sm font-medium text-white opacity-0 transition-all duration-700 ease-out group-hover:max-w-[110px] group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:max-w-[110px] group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
        Request a Call
      </span>
    </button>
  </div>
)
