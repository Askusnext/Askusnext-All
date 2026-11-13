/**
 * Staff API client for the central AskUs API (NestJS + PostgreSQL).
 */
import type {
  Ticket, DashboardKPIs, PaginatedResponse, AuthResponse, User,
} from '../types';
import { STAFF_KEYS, authFetch, requestOtp, signInWithOtp } from './session';

const request = <T>(method: string, endpoint: string, body?: unknown, isFormData = false) =>
  authFetch<T>(STAFF_KEYS, endpoint, { method, body, isFormData });
const get  = <T>(ep: string)                   => request<T>('GET',    ep);
const post = <T>(ep: string, b: unknown)       => request<T>('POST',   ep, b);
const put  = <T>(ep: string, b: unknown)       => request<T>('PUT',    ep, b);
const del  = <T>(ep: string)                   => request<T>('DELETE', ep);

export type KBArticle = {
  id: string;
  title: string;
  slug: string;
  category: 'O2Taxi' | 'AlphaaInsurance' | 'AlphaaLoans' | 'General';
  body: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

// ── Auth (passwordless: OTP to mobile or email) ───────────────────────────────
export const apiClient = {
  requestOtp: (identifier: string) => requestOtp(identifier),

  verifyOtp: async (identifier: string, code: string): Promise<AuthResponse> => {
    const { token, me } = await signInWithOtp(STAFF_KEYS, identifier, code);
    if (me.role === 'Customer') {
      sessionStorage.removeItem(STAFF_KEYS.access);
      sessionStorage.removeItem(STAFF_KEYS.refresh);
      throw new Error('This account does not have staff access');
    }
    return {
      token,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      user: { id: me.id, name: me.name, email: me.email ?? undefined, mobile: me.mobile ?? '', role: me.role, branchId: me.branchId },
    };
  },

  // ── Dashboard ──────────────────────────────────────────────────────────────
  getKPIs: () =>
    get<DashboardKPIs>('/dashboard/kpis'),

  getExpiryAlerts: (days = 60) =>
    get<Ticket[]>(`/dashboard/expiry-alerts?days=${days}`),

  getMonthlyData: () =>
    get<{ month: string; tickets: number; premium: number }[]>('/dashboard/monthly'),

  // ── Tickets ────────────────────────────────────────────────────────────────
  getTickets: (params: {
    search?: string; status?: string; priority?: string;
    insurer?: string; ticketType?: string; page?: number; pageSize?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.search)   q.set('search',   params.search);
    if (params.status)   q.set('status',   params.status);
    if (params.priority) q.set('priority', params.priority);
    if (params.insurer)  q.set('insurer',  params.insurer);
    if (params.ticketType) q.set('ticketType', params.ticketType);
    if (params.page)     q.set('page',     String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    return get<PaginatedResponse<Ticket>>(`/tickets?${q.toString()}`);
  },

  getTicketById: (id: string) =>
    get<Ticket | null>(`/tickets/${id}`),

  createTicket: (data: Partial<Ticket>) =>
    post<Ticket>('/tickets', data),

  updateTicket: (id: string, data: Partial<Ticket>) =>
    put<Ticket>(`/tickets/${id}`, data),

  updateTicketStatus: (id: string, status: string, note?: string) =>
    put<void>(`/tickets/${id}/status`, { status, note }),

  updatePayment: (id: string, paymentData: Partial<Ticket['payment']>) =>
    put<void>(`/tickets/${id}/payment`, paymentData),

  // ── Cashfree online payments ─────────────────────────────────────────────
  createPaymentOrder: (ticketId: string) =>
    post<{ orderId: string; paymentSessionId: string; env: string; amount: number }>(
      '/payments/create-order', { ticketId }),

  verifyPaymentOrder: (ticketId: string, orderId: string) =>
    post<{ orderStatus: string; paymentStatus: string }>(
      '/payments/verify', { ticketId, orderId }),

  addComment: (id: string, note: string) =>
    post<void>(`/tickets/${id}/comment`, { note }),

  uploadDocument: async (id: string, file: File, type: string): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    await request<void>('POST', `/tickets/${id}/documents`, formData, true);
  },

  deleteDocument: (ticketId: string, docId: string) =>
    del<void>(`/tickets/${ticketId}/documents/${docId}`),

  sendReminder: (_ticketId: string): Promise<void> =>
    Promise.resolve(),

  // ── Users ──────────────────────────────────────────────────────────────────
  getUsers: () =>
    get<User[]>('/users'),

  createUser: (data: { name: string; email: string; mobile: string; role: string }) =>
    post<User>('/users', data),

  updateUser: (id: string, data: { name?: string; mobile?: string; role?: string }) =>
    put<User>(`/users/${id}`, data),

  deleteUser: (id: string) =>
    del<void>(`/users/${id}`),

  // ── Timesheet ──────────────────────────────────────────────────────────────
  getTimesheet: (weekStart?: string) => {
    const q = weekStart ? `?weekStart=${weekStart}` : '';
    return get<unknown[]>(`/timesheet${q}`);
  },

  saveTimesheet: (weekStart: string, entries: { date: string; status: string; hours: number }[]) =>
    post<unknown>('/timesheet', { weekStart, entries }),

  // ── Knowledge base (Admin authoring) ────────────────────────────────────────
  getAllArticles: () =>
    get<KBArticle[]>('/kb/admin/all'),

  createArticle: (data: { title: string; category: string; body: string; published?: boolean }) =>
    post<KBArticle>('/kb', data),

  updateArticle: (id: string, data: Partial<{ title: string; category: string; body: string; published: boolean }>) =>
    put<KBArticle>(`/kb/${id}`, data),

  deleteArticle: (id: string) =>
    del<void>(`/kb/${id}`),
};

export default apiClient;
