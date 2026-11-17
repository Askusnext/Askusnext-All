import React from 'react'
import { PromoCarousel } from './PromoCarousel'
import { assetUrl } from '../../constants/navigation'

// Decorative string-light garland (pure SVG, no external assets).
const Garland: React.FC = () => {
  const bulbs = Array.from({ length: 28 }, (_, i) => i)
  return (
    <svg aria-hidden viewBox="0 0 1440 70" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 h-[60px] w-full">
      <path d="M0 8 Q 90 52 180 8 T 360 8 T 540 8 T 720 8 T 900 8 T 1080 8 T 1260 8 T 1440 8" fill="none" stroke="#e0b070" strokeWidth="1.2" />
      {bulbs.map((i) => {
        const x = 45 + i * 51
        const y = 8 + 22 * Math.sin(((x % 180) / 180) * Math.PI)
        return <circle key={i} cx={x} cy={y} r={i % 2 ? 4 : 5.5} fill={i % 2 ? '#fff' : '#ff6a00'} stroke={i % 2 ? '#e0b070' : '#d94f00'} strokeWidth="1" />
      })}
    </svg>
  )
}

const POINTS = [
  { icon: 'credible.svg', text: 'One stop for all\nfinancial solutions' },
  { icon: 'helpful.svg', text: 'Quick, easy &\nhassle free' },
]

export const FestiveHero: React.FC = () => (
  <>
    <section className="relative overflow-hidden bg-gradient-to-b from-[#fff6e3] via-[#fffaf0] to-white font-[Poppins,sans-serif]">
      <Garland />
      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-8 pt-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-12 lg:pt-20">
        <div>
          <div className="flex items-end gap-3">
            <h1 className="bg-gradient-to-b from-[#f59e0b] to-[#c2410c] bg-clip-text font-[Roboto_Serif,serif] text-5xl font-extrabold leading-tight text-transparent sm:text-6xl">
              Happy Diwali
            </h1>
            <span aria-hidden className="mb-2 h-12 w-16 shrink-0 bg-no-repeat sm:h-14 sm:w-20" style={{ backgroundImage: `url(${assetUrl('diwali-assets.png')})`, backgroundSize: 'auto 100%', backgroundPosition: '0 50%' }} />
          </div>
          <p className="mt-3 font-[Roboto_Serif,serif] text-2xl font-semibold italic text-[#b45309] sm:text-3xl">Plan every dream, wisely</p>
          <p className="mt-3 max-w-md text-xs text-slate-500">Festive greetings from Askus Fin. Loan terms, rates and approvals are always decided by the lender.</p>

          <div className="mt-8 grid max-w-lg grid-cols-2 gap-6">
            {POINTS.map((p) => (
              <div key={p.icon} className="flex items-center gap-3">
                <img src={assetUrl(p.icon)} alt="" width={44} height={44} className="shrink-0" />
                <p className="whitespace-pre-line text-sm font-medium leading-snug text-[#1c1d1f] sm:text-base">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
        <PromoCarousel />
      </div>
    </section>

  </>
)
