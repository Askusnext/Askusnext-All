/**
 * Real photos for the home page, served from Unsplash's image CDN at small sizes.
 * Unsplash License: free for commercial use, no attribution required (https://unsplash.com/license).
 * Sources are listed in public/img/PHOTO-CREDITS.txt. To self-host, download these images and swap the URLs.
 */
const unsplash = (id: string, w: number, h: number, focus = '') =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=70${focus}`

const IDS: Record<string, { id: string; alt: string; position?: string; focus?: string; cutout?: boolean; local?: string }> = {
  // Owner-supplied photo, background removed with rembg (isnet-general-use).
  car: { id: '', local: '/img/cutouts/car-front.webp', alt: 'A white SUV, front view' },
  // Owner-supplied photo with its own transparent background.
  bike: { id: '', local: '/img/cutouts/bike-front.webp', alt: 'A white sports motorcycle, front view' },
  // Owner-supplied photo, background removed with rembg (isnet-general-use).
  auto: { id: '', local: '/img/cutouts/auto-front.webp', alt: 'A green and yellow auto-rickshaw, front view' },
  // Owner-supplied photo, background removed with rembg (isnet-general-use).
  commercial: { id: '', local: '/img/cutouts/commercial-front.webp', alt: 'A white heavy truck, front view' },
  health: { id: '1763070282903-cbe9922ab7ab', alt: 'A stethoscope', cutout: true },
  // Real photo with the background removed (macOS Vision subject lift), saved in public/img/cutouts.
  term: { id: '', local: '/img/cutouts/term.webp', alt: 'A happy family sitting together' },
}

export const productPhoto = (productId: string, w = 640, h = 360) => {
  const p = IDS[productId]
  if (p?.local) return { src: p.local, srcSet: undefined, alt: p.alt, position: '50% 100%', cutout: true, local: true }
  return p ? { src: unsplash(p.id, w, h, p.focus), srcSet: `${unsplash(p.id, w, h, p.focus)} 1x, ${unsplash(p.id, w * 2, h * 2, p.focus)} 2x`, local: false, alt: p.alt, position: p.position ?? '50% 50%', cutout: Boolean(p.cutout) } : null
}

/** Hero photo: a family outdoors in the sun. */
export const HERO_PHOTO = { src: unsplash('1770871821382-60ea99b0a941', 760, 860), alt: 'A happy family running together in a sunlit garden' }
