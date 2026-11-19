import { STAFF_KEYS, authFetch } from './session';

/** Dashboard counters, analytics and renewals. Each figure is computed on the server from the tickets the caller may see. */

export interface CategoryCounter {
  category: string;
  ticketType: string;
  queue: number;
  open: number;
  expiring: number;
  expired: number;
}

export interface Counters {
  asOf: string;
  categories: CategoryCounter[];
  totals: { queue: number; open: number; expiring: number; expired: number };
}

export interface TicketVolume {
  months: { month: string; label: string; total: number; byCategory: Record<string, number> }[];
  categoryBreakdown: { category: string; count: number }[];
  resolution: { resolvedCount: number; avgHours: number | null; byCategory: { category: string; resolvedCount: number; avgHours: number }[] };
}

export interface RenewalRow {
  ticketId: string;
  ticketNumber: string;
  customerName: string;
  customerMobile: string;
  vehicleRegNo: string | null;
  insurer: string;
  expiryDate: string;
  daysLeft: number;
  state: 'expiring' | 'expired';
  renewalTicket: { id: string; ticketNumber: string; status: string } | null;
}

export interface Renewals {
  asOf: string;
  windowDays: number;
  expiring: RenewalRow[];
  expired: RenewalRow[];
}

const call = <T,>(path: string, method = 'GET') => authFetch<T>(STAFF_KEYS, path, { method });

export const ticketingApi = {
  counters: () => call<Counters>('/dashboard/counters'),
  volume: (months = 6) => call<TicketVolume>(`/analytics/ticket-volume?months=${months}`),
  renewals: (days = 30) => call<Renewals>(`/renewals/upcoming?days=${days}`),
  generateRenewals: () => call<{ created: number; tickets: string[] }>('/renewals/generate', 'POST'),
};

export const CATEGORY_LABEL: Record<string, string> = {
  insurance: 'Insurance', taxi: 'O2 Taxi', general: 'General', daily_activity: 'Daily activity', support: 'Support',
  payment: 'Payment', office: 'Office', other: 'Other',
};
