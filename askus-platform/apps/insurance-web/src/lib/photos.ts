/**
 * Real photos for the home page, served from Unsplash's image CDN at small sizes.
 * Unsplash License: free for commercial use, no attribution required (https://unsplash.com/license).
 * Sources are listed in public/img/PHOTO-CREDITS.txt. To self-host, download these images and swap the URLs.
 */
const unsplash = (id: string, w: number, h: number, focus = '') =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=70${focus}`

const IDS: Record<string, { id: string; alt: string; position?: string; focus?: string }> = {
  car: { id: '1767949374180-e5895daa1990', alt: 'Front view of a white SUV', focus: '&crop=focalpoint&fp-x=0.5&fp-y=0.74&fp-z=1.45' },
  bike: { id: '1648204798633-c51d248d637a', alt: 'A rider on a scooter in a city street', position: '50% 60%' },
  auto: { id: '1517330357046-3ab5a5dd42a1', alt: 'A yellow auto-rickshaw on a road' },
  commercial: { id: '1627019866926-b6030ff785fe', alt: 'A white goods carrier truck parked on grass' },
  health: { id: '1758691462863-9e1b8a863140', alt: 'A doctor consulting a patient in a clinic' },
  term: { id: '1780980301761-f6e0fa6f0bdf', alt: 'A happy family sitting together at home', position: '50% 35%' },
}

export const productPhoto = (productId: string, w = 640, h = 360) => {
  const p = IDS[productId]
  return p ? { src: unsplash(p.id, w, h, p.focus), srcSet: `${unsplash(p.id, w, h, p.focus)} 1x, ${unsplash(p.id, w * 2, h * 2, p.focus)} 2x`, alt: p.alt, position: p.position ?? '50% 50%' } : null
}

/** Hero photo: a family outdoors in the sun. */
export const HERO_PHOTO = { src: unsplash('1770871821382-60ea99b0a941', 760, 860), alt: 'A happy family running together in a sunlit garden' }
