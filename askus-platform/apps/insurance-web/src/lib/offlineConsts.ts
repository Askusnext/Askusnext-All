/** Plain constants for the offline flow (no Firebase imports, so server code can use them too). */
export type OfflineType = 'car' | 'bike' | 'auto' | 'commercial'

/** "Up to" cashback shown for offline requests. */
export const OFFLINE_CASHBACK: Record<OfflineType, number> = { car: 500, bike: 300, auto: 2000, commercial: 11000 }

/** "Up to" cashback for buying online through the partner journey (only where we offer one). */
export const ONLINE_CASHBACK: Partial<Record<OfflineType, number>> = { car: 300 }

/** "Up to" cashback shown on the home tiles, by product id. */
export const TILE_CASHBACK: Record<string, number> = OFFLINE_CASHBACK

/** Wording and examples the offline form uses for each vehicle. */
export const OFFLINE_VEHICLE: Record<OfflineType, { noun: string; vehicle: string; loan: string; model: string; variant: string }> = {
  car: { noun: 'Car', vehicle: 'car', loan: 'car', model: 'e.g. Maruti Alto 800', variant: 'e.g. LXI (796 CC)' },
  bike: { noun: 'Bike', vehicle: 'bike', loan: 'two-wheeler', model: 'e.g. TVS Apache', variant: 'e.g. RTR 200 4V FI (200 CC)' },
  auto: { noun: 'Auto', vehicle: 'auto', loan: 'auto-rickshaw', model: 'e.g. Bajaj RE Compact', variant: 'e.g. 4S CNG (236 CC)' },
  commercial: { noun: 'Vehicle', vehicle: 'commercial vehicle', loan: 'vehicle', model: 'e.g. Tata Ace Gold', variant: 'e.g. Diesel Plus (702 CC)' },
}

export const INSURERS = [
  'Acko General', 'Bajaj Allianz', 'Cholamandalam MS', 'Digit', 'Future Generali', 'HDFC ERGO', 'ICICI Lombard',
  'IFFCO Tokio', 'Kotak General', 'Liberty General', 'National Insurance', 'New India Assurance', 'Oriental Insurance',
  'Raheja QBE', 'Reliance General', 'Royal Sundaram', 'SBI General', 'Shriram General', 'Tata AIG', 'United India',
  'Universal Sompo', 'Zuno General', 'Other / not sure',
]
export const PREV_POLICY_TYPES = ['Comprehensive', 'Third Party', 'Own Damage only', 'Not sure']
export const NCB_OPTIONS = ['0%', '20%', '25%', '35%', '45%', '50%']

