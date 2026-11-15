import React, { useEffect, useRef, useState } from 'react'

interface LottieIconProps {
  /** Path to the animation JSON under /assets/pb. */
  src: string
  /** Static fallback shown until the animation is ready (or if it fails / motion is reduced). */
  fallback: string
  size?: number
}

/**
 * Looping Lottie icon. The animation library is loaded lazily, playback only
 * runs while the icon is on screen, and users who prefer reduced motion get
 * the static image.
 */
export const LottieIcon: React.FC<LottieIconProps> = ({ src, fallback, size = 52 }) => {
  const host = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let anim: import('lottie-web').AnimationItem | undefined
    let observer: IntersectionObserver | undefined
    let cancelled = false

    import('lottie-web/build/player/lottie_light')
      .then((mod) => {
        if (cancelled) return
        const lottie = mod.default
        anim = lottie.loadAnimation({
          container: el,
          renderer: 'svg',
          loop: true,
          autoplay: false,
          path: `/assets/pb/${src}`,
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        })
        anim.addEventListener('DOMLoaded', () => {
          if (cancelled) return
          setReady(true)
          observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) anim?.play()
            else anim?.pause()
          })
          observer.observe(el)
        })
      })
      .catch(() => {
        /* keep the static fallback */
      })

    return () => {
      cancelled = true
      observer?.disconnect()
      anim?.destroy()
    }
  }, [src])

  return (
    <span className="relative block" style={{ width: size, height: size }}>
      {!ready && <img src={`/assets/pb/${fallback}`} alt="" width={size} height={size} className="absolute inset-0 object-contain" />}
      <div ref={host} aria-hidden className="absolute inset-0" style={{ opacity: ready ? 1 : 0 }} />
    </span>
  )
}
