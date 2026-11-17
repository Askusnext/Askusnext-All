import { notification } from 'antd';
import { markSignedIn } from './sessionLife';

// Shared OTP session handling for the staff app and the customer portal.
// Both talk to the central AskUs identity API (/auth/*); they only differ in
// which localStorage keys hold the tokens.
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
  role: 'SuperAdmin' | 'Admin' | 'Employee' | 'Agent' | 'Customer';
  permissions?: string[];
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
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

export interface OtpResult {
  sent: boolean;
  status?: 'PENDING' | 'REJECTED';
  /** First sign-in: the other contact still has to be supplied. */
  needs?: 'email' | 'mobile';
  /** Both channels on a first sign-in, email only afterwards. */
  channels?: ('sms' | 'email')[];
  emailHint?: string;
}

/** Second contact of a first sign-in; `identifier` is omitted when the account already has it. */
export interface OtherContact { identifier?: string; code: string }

export const requestOtp = (identifier: string, app?: 'staff', otherIdentifier?: string) =>
  postJson<OtpResult>('/auth/request-otp', { identifier, app, otherIdentifier });

export function saveTokens(keys: SessionKeys, t: Tokens) {
  localStorage.setItem(keys.access, t.accessToken);
  localStorage.setItem(keys.refresh, t.refreshToken);
}

export async function signInWithOtp(keys: SessionKeys, identifier: string, code: string, other?: OtherContact): Promise<{ token: string; me: Me }> {
  const tokens = await postJson<Tokens>('/auth/verify-otp', { identifier, code, otherIdentifier: other?.identifier, otherCode: other?.code });
  saveTokens(keys, tokens);
  markSignedIn(keys.access);
  const me = await authFetch<Me>(keys, '/users/me');
  return { token: tokens.accessToken, me };
}

// Mobile number (or email) + password, for accounts that have a password set.
export async function signInWithPassword(keys: SessionKeys, identifier: string, password: string): Promise<{ token: string; me: Me }> {
  const tokens = await postJson<Tokens>('/auth/login-password', { identifier, password });
  saveTokens(keys, tokens);
  markSignedIn(keys.access);
  const me = await authFetch<Me>(keys, '/users/me');
  return { token: tokens.accessToken, me };
}

export function clearSession(keys: SessionKeys) {
  const refresh = localStorage.getItem(keys.refresh);
  if (refresh) void postJson('/auth/logout', { refreshToken: refresh }).catch(() => undefined);
  localStorage.removeItem(keys.access);
  localStorage.removeItem(keys.refresh);
  localStorage.removeItem(`${keys.access}_exp`);
}

// One refresh in flight per session so concurrent 401s do not rotate the token twice.
const refreshing = new Map<string, Promise<boolean>>();

function refreshTokens(keys: SessionKeys): Promise<boolean> {
  const pending = refreshing.get(keys.refresh);
  if (pending) return pending;

  const refreshToken = localStorage.getItem(keys.refresh);
  const run = (async () => {
    if (!refreshToken) return false;
    try {
      saveTokens(keys, await postJson<Tokens>('/auth/refresh', { refreshToken }));
      return true;
    } catch {
      localStorage.removeItem(keys.access);
      localStorage.removeItem(keys.refresh);
      localStorage.removeItem(`${keys.access}_exp`);
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
    const token = localStorage.getItem(keys.access);
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

/** Fetches a protected file (for example a customer document) and returns a temporary local URL to open it. */
export async function authFileUrl(keys: SessionKeys, path: string): Promise<string> {
  const send = () => {
    const token = localStorage.getItem(keys.access); // same place saveTokens/authFetch use
    return fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  };
  let res = await send();
  if (res.status === 401 && (await refreshTokens(keys))) res = await send();
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((Array.isArray(err.message) ? err.message.join(', ') : err.message) || 'Could not open the file');
  }
  return URL.createObjectURL(await res.blob());
}
