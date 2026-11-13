import { notification } from 'antd';

// Shared OTP session handling for the staff app and the customer portal.
// Both talk to the central AskUs identity API (/auth/*); they only differ in
// which sessionStorage keys hold the tokens.
export const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

export interface SessionKeys { access: string; refresh: string }
export const STAFF_KEYS: SessionKeys = { access: 'tms_token', refresh: 'tms_refresh' };
export const CUSTOMER_KEYS: SessionKeys = { access: 'askus_customer_token', refresh: 'askus_customer_refresh' };

interface Tokens { accessToken: string; refreshToken: string; expiresIn: number }

export interface Me {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  role: 'Admin' | 'Employee' | 'Agent' | 'Customer';
  branchId: string;
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const msg = Array.isArray(err.message) ? err.message.join(', ') : err.message;
    throw new Error(msg || 'Request failed');
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const postJson = <T>(path: string, body: unknown) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => parse<T>(r));

export const requestOtp = (identifier: string) => postJson<{ sent: boolean }>('/auth/request-otp', { identifier });

export function saveTokens(keys: SessionKeys, t: Tokens) {
  sessionStorage.setItem(keys.access, t.accessToken);
  sessionStorage.setItem(keys.refresh, t.refreshToken);
}

export async function signInWithOtp(keys: SessionKeys, identifier: string, code: string): Promise<{ token: string; me: Me }> {
  const tokens = await postJson<Tokens>('/auth/verify-otp', { identifier, code });
  saveTokens(keys, tokens);
  const me = await authFetch<Me>(keys, '/users/me');
  return { token: tokens.accessToken, me };
}

export function clearSession(keys: SessionKeys) {
  const refresh = sessionStorage.getItem(keys.refresh);
  if (refresh) void postJson('/auth/logout', { refreshToken: refresh }).catch(() => undefined);
  sessionStorage.removeItem(keys.access);
  sessionStorage.removeItem(keys.refresh);
}

// One refresh in flight per session so concurrent 401s do not rotate the token twice.
const refreshing = new Map<string, Promise<boolean>>();

function refreshTokens(keys: SessionKeys): Promise<boolean> {
  const pending = refreshing.get(keys.refresh);
  if (pending) return pending;

  const refreshToken = sessionStorage.getItem(keys.refresh);
  const run = (async () => {
    if (!refreshToken) return false;
    try {
      saveTokens(keys, await postJson<Tokens>('/auth/refresh', { refreshToken }));
      return true;
    } catch {
      sessionStorage.removeItem(keys.access);
      sessionStorage.removeItem(keys.refresh);
      return false;
    }
  })().finally(() => refreshing.delete(keys.refresh));
  refreshing.set(keys.refresh, run);
  return run;
}

export async function authFetch<T>(
  keys: SessionKeys,
  path: string,
  init: { method?: string; body?: unknown; isFormData?: boolean } = {},
): Promise<T> {
  const send = () => {
    const headers: Record<string, string> = {};
    const token = sessionStorage.getItem(keys.access);
    if (token) headers.Authorization = `Bearer ${token}`;
    if (!init.isFormData && init.body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(`${BASE}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : init.isFormData ? (init.body as FormData) : JSON.stringify(init.body),
    });
  };

  let res = await send();
  if (res.status === 401 && (await refreshTokens(keys))) res = await send();
  if (res.status === 401) {
    notification.warning({ message: 'Session expired', description: 'Please sign in again.', key: 'session-expired' });
  }
  return parse<T>(res);
}
