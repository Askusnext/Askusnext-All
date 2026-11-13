/**
 * Customer-portal API client for the central AskUs API.
 * Kept separate from `api.ts` (internal staff) so customer sessions never mix
 * with employee sessions in the same browser.
 */
import { BASE, CUSTOMER_KEYS, authFetch, requestOtp, signInWithOtp } from './session';

export type CustomerAuthResponse = {
	token: string;
	customer: { id: string; name: string; email?: string; mobile: string };
};

export type CustomerTicket = {
	id: string;
	ticketNumber: string;
	title: string;
	status: 'Open' | 'InProgress' | 'Completed' | 'Closed';
	priority: 'High' | 'Medium' | 'Low';
	ticketType: string;
	supportTicketData?: { description?: string };
	activityLog: { id: string; action: string; note?: string; performedByName: string; createdAt: string }[];
	createdAt: string;
	updatedAt: string;
};

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

async function request<T>(method: string, endpoint: string, body?: unknown, auth = true): Promise<T> {
	if (auth) return authFetch<T>(CUSTOMER_KEYS, endpoint, { method, body });

	const res = await fetch(`${BASE}${endpoint}`, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({ message: res.statusText }));
		throw new Error(err.message || 'Request failed');
	}
	const text = await res.text();
	return text ? JSON.parse(text) : (undefined as T);
}

export const customerApi = {
	requestOtp: (identifier: string) => requestOtp(identifier),

	// First sign-in creates the account, so there is no separate register call.
	verifyOtp: async (identifier: string, code: string): Promise<CustomerAuthResponse> => {
		const { token, me } = await signInWithOtp(CUSTOMER_KEYS, identifier, code);
		return { token, customer: { id: me.id, name: me.name, email: me.email ?? undefined, mobile: me.mobile ?? '' } };
	},
	getTickets: () => request<CustomerTicket[]>('GET', '/customer-tickets'),

	getTicketById: (id: string) => request<CustomerTicket>('GET', `/customer-tickets/${id}`),

	createTicket: (data: { title: string; ticketType?: string; priority?: string; description?: string }) =>
		request<CustomerTicket>('POST', '/customer-tickets', data),

	addComment: (id: string, note: string) =>
		request<{ message: string }>('POST', `/customer-tickets/${id}/comment`, { note }),

	getArticles: (params?: { category?: string; search?: string }) => {
		const q = new URLSearchParams();
		if (params?.category) q.set('category', params.category);
		if (params?.search) q.set('search', params.search);
		const qs = q.toString();
		return request<KBArticle[]>('GET', `/kb${qs ? `?${qs}` : ''}`, undefined, false);
	},

	getArticleBySlug: (slug: string) => request<KBArticle>('GET', `/kb/${slug}`, undefined, false),
};

export default customerApi;
