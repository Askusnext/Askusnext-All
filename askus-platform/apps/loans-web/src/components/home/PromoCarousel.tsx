import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { assetUrl } from '../../constants/navigation'
import { PROMO_SLIDES, type PromoSlide } from '../../constants/promos'

/** Auto-rotating promo carousel; pauses on hover/focus and respects reduced motion. */
export const PromoCarousel: React.FC<{ slides?: PromoSlide[]; className?: string }> = ({ slides = PROMO_SLIDES, className = '' }) => {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => setI((v) => (v + 1) % slides.length), 5000)
    return () => window.clearInterval(t)
  }, [paused, slides.length])

  return (
    <div className={className} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="overflow-hidden rounded-3xl">
        <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
          {slides.map((s, idx) => (
            <div key={s.title} aria-hidden={idx !== i} className={`relative flex min-h-[250px] w-full shrink-0 items-center overflow-hidden bg-gradient-to-br ${s.gradient} p-6 text-white sm:min-h-[300px] sm:p-8`}>
              <div className="relative z-10 max-w-[65%]">
                <h3 className="font-[Roboto_Serif,serif] text-xl font-semibold italic leading-snug sm:text-2xl">{s.title}</h3>
                {s.highlight && <p className="mt-2 text-xl font-bold text-amber-300 sm:text-2xl">{s.highlight}</p>}
                <ul className="mt-3 space-y-1 text-xs sm:text-sm">
                  {s.bullets.map((b) => <li key={b}>• {b}</li>)}
                </ul>
                <Link to={s.to} tabIndex={idx === i ? 0 : -1} className="mt-5 inline-flex items-center gap-1 rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#1c1d1f] shadow transition hover:bg-amber-50">
                  {s.cta} <ChevronRight size={16} />
                </Link>
              </div>
              <div className="absolute -right-4 bottom-0 flex h-full w-[45%] items-center justify-center opacity-90">
                <img src={assetUrl(s.icon)} alt="" className="h-28 w-28 rounded-3xl bg-white/15 p-5 sm:h-36 sm:w-36" />
              </div>
              <span className="pointer-events-none absolute left-6 top-0 h-10 w-px bg-white/30" />
              <span className="pointer-events-none absolute right-16 top-0 h-14 w-px bg-white/30" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-2">
        {slides.map((s, idx) => (
          <button key={s.title} type="button" aria-label={`Slide ${idx + 1}`} aria-current={idx === i} onClick={() => setI(idx)} className={`h-2.5 w-2.5 rounded-full transition ${idx === i ? 'bg-[#1c1d1f]' : 'bg-slate-300'}`} />
        ))}
      </div>
    </div>
  )
}
