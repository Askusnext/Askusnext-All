import { REQUEST_STATUSES, type InsuranceRequestDto, type RequestStatus } from '@askus/shared-types'

export type Rec = InsuranceRequestDto
export type Status = RequestStatus
export const STATUSES = REQUEST_STATUSES

/* Display helpers for a customer's requests (dates arrive from the API as ISO strings). */
const dateOf = (t?: string): Date | null => (t ? new Date(t) : null)
export const secs = (t?: string) => (t ? Date.parse(t) / 1000 : 0)
export const when = (t?: string) => { const d = dateOf(t); return d ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—' }
export const shortDate = (t?: string) => { const d = dateOf(t); return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }
export function ago(t?: string): string {
  const d = dateOf(t)
  if (!d) return 'just now'
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return shortDate(t)
}
export const docsOf = (r: Rec) => r.documents ?? []
export const refOf = (r: { id: string }) => r.id.slice(0, 8).toUpperCase()
export const titleOf = (r: Rec) => (r.kind === 'offline' ? `Offline ${r.vehicleType ?? ''} insurance`.replace('  ', ' ') : `Documents · ${r.type ?? 'upload'}`)
export const statusOf = (r: { status?: string }): Status => (STATUSES.includes(r.status as Status) ? (r.status as Status) : 'new')
export const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
