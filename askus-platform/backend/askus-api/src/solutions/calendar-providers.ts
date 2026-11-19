import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { CalendarProvider } from './calendar.entities';

/**
 * Google and Microsoft calendar access.
 *
 * Needs, per provider (see .env.example): *_CLIENT_ID and *_CLIENT_SECRET from the provider's developer
 * console, with API_PUBLIC_URL + /api/calendar/oauth/callback registered as the redirect URI. The endpoint
 * URLs can be overridden by env for testing against a stand-in server.
 */

export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  eventsUrl: string;
  scope: string;
}

const env = (k: string) => process.env[k]?.trim() || undefined;

export function providerConfig(p: CalendarProvider): ProviderConfig | null {
  if (p === 'google') {
    const clientId = env('GOOGLE_CLIENT_ID');
    const clientSecret = env('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) return null;
    return {
      clientId, clientSecret,
      authUrl: env('GOOGLE_AUTH_URL') ?? 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: env('GOOGLE_TOKEN_URL') ?? 'https://oauth2.googleapis.com/token',
      eventsUrl: env('GOOGLE_EVENTS_URL') ?? 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      // Read-only access to events (title, time, attendees). Nothing about mail.
      scope: 'openid email https://www.googleapis.com/auth/calendar.events.readonly',
    };
  }
  const clientId = env('MICROSOFT_CLIENT_ID');
  const clientSecret = env('MICROSOFT_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  const tenant = env('MICROSOFT_TENANT') ?? 'common';
  return {
    clientId, clientSecret,
    authUrl: env('MICROSOFT_AUTH_URL') ?? `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: env('MICROSOFT_TOKEN_URL') ?? `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    eventsUrl: env('MICROSOFT_EVENTS_URL') ?? 'https://graph.microsoft.com/v1.0/me/calendarView',
    // Read calendars and identify the account. No Mail.* permission is ever requested.
    scope: 'openid email offline_access Calendars.Read',
  };
}

export const redirectUri = () => `${(env('API_PUBLIC_URL') ?? 'http://localhost:4000').replace(/\/$/, '')}/api/calendar/oauth/callback`;

// ───────────────────────── token encryption (AES-256-GCM) ─────────────────────────

function key(): Buffer {
  const secret = env('CALENDAR_TOKEN_KEY') ?? env('JWT_SECRET');
  if (!secret) throw new Error('Set CALENDAR_TOKEN_KEY (or JWT_SECRET) so calendar tokens can be stored encrypted.');
  return createHash('sha256').update(secret).digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
}

export function open(sealed: string): string {
  const [iv, tag, enc] = sealed.split('.').map((s) => Buffer.from(s, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

// ───────────────────────── OAuth ─────────────────────────

export interface Tokens { accessToken: string; refreshToken: string | null; expiresAt: Date; accountEmail: string | null }

export class ProviderAuthError extends Error {
  /** True when the user has revoked access or the saved sign-in can no longer be refreshed. */
  constructor(message: string, readonly revoked = false) { super(message); }
}

export function authorizeUrl(p: CalendarProvider, cfg: ProviderConfig, state: string): string {
  const q = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: redirectUri(), response_type: 'code', scope: cfg.scope, state });
  if (p === 'google') { q.set('access_type', 'offline'); q.set('prompt', 'consent'); } // consent screen each time so a refresh token is issued
  else q.set('response_mode', 'query');
  return `${cfg.authUrl}?${q}`;
}

async function tokenRequest(cfg: ProviderConfig, form: Record<string, string>) {
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...form }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.access_token) {
    const revoked = json.error === 'invalid_grant' || json.error === 'interaction_required';
    throw new ProviderAuthError(`Sign-in with the provider failed${json.error ? ` (${String(json.error)})` : ''}`, revoked);
  }
  return json;
}

function emailFromIdToken(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null;
  try {
    const claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8')) as Record<string, string>;
    return (claims.email ?? claims.preferred_username ?? null)?.toLowerCase() ?? null;
  } catch { return null; }
}

export async function exchangeCode(cfg: ProviderConfig, code: string): Promise<Tokens> {
  const j = await tokenRequest(cfg, { code, grant_type: 'authorization_code', redirect_uri: redirectUri() });
  return {
    accessToken: String(j.access_token),
    refreshToken: typeof j.refresh_token === 'string' ? j.refresh_token : null,
    expiresAt: new Date(Date.now() + Number(j.expires_in ?? 3600) * 1000),
    accountEmail: emailFromIdToken(j.id_token),
  };
}

export async function refreshAccess(cfg: ProviderConfig, refreshToken: string): Promise<Pick<Tokens, 'accessToken' | 'expiresAt'> & { refreshToken: string | null }> {
  const j = await tokenRequest(cfg, { refresh_token: refreshToken, grant_type: 'refresh_token' });
  return {
    accessToken: String(j.access_token),
    refreshToken: typeof j.refresh_token === 'string' ? j.refresh_token : null, // Microsoft rotates it
    expiresAt: new Date(Date.now() + Number(j.expires_in ?? 3600) * 1000),
  };
}

// ───────────────────────── events ─────────────────────────

export interface RemoteEvent {
  externalId: string;
  title: string;
  start: Date;
  end: Date;
  isPrivate: boolean;
  attendees: { email: string | null; name: string | null }[];
}

const asDate = (v: unknown, fallback?: Date) => (typeof v === 'string' ? new Date(v) : fallback ?? new Date(NaN));

/** An all-day event has a date but no time. It covers that whole India day. */
const dayStartIst = (d: string) => new Date(`${d}T00:00:00+05:30`);

async function getJson(url: string, token: string, extra: Record<string, string> = {}) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, ...extra }, signal: AbortSignal.timeout(20_000) });
  if (res.status === 401 || res.status === 403) throw new ProviderAuthError('The provider rejected the saved sign-in', res.status === 401);
  if (!res.ok) throw new Error(`The calendar provider answered HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Google: only summary, start, end, attendees, status and visibility are requested (never description, location or attachments). */
async function googleEvents(cfg: ProviderConfig, token: string, from: Date, to: Date): Promise<RemoteEvent[]> {
  const out: RemoteEvent[] = [];
  let page: string | undefined;
  do {
    const q = new URLSearchParams({
      timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
      fields: 'nextPageToken,items(id,summary,status,visibility,start,end,attendees(email,displayName))',
    });
    if (page) q.set('pageToken', page);
    const j = await getJson(`${cfg.eventsUrl}?${q}`, token);
    for (const e of (j.items as Record<string, any>[]) ?? []) {
      if (e.status === 'cancelled') continue;
      const start = e.start?.dateTime ? asDate(e.start.dateTime) : e.start?.date ? dayStartIst(e.start.date) : null;
      const end = e.end?.dateTime ? asDate(e.end.dateTime) : e.end?.date ? dayStartIst(e.end.date) : null;
      if (!e.id || !start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      out.push({
        externalId: String(e.id),
        title: String(e.summary ?? '(no title)').slice(0, 300),
        start, end,
        isPrivate: e.visibility === 'private' || e.visibility === 'confidential',
        attendees: ((e.attendees as Record<string, string>[]) ?? []).slice(0, 100).map((a) => ({ email: a.email?.toLowerCase() ?? null, name: a.displayName ?? null })),
      });
    }
    page = typeof j.nextPageToken === 'string' ? j.nextPageToken : undefined;
  } while (page);
  return out;
}

/** Microsoft Graph: $select keeps it to subject, start, end, attendees, cancelled and sensitivity (never body or location). */
async function microsoftEvents(cfg: ProviderConfig, token: string, from: Date, to: Date): Promise<RemoteEvent[]> {
  const out: RemoteEvent[] = [];
  const q = new URLSearchParams({ startDateTime: from.toISOString(), endDateTime: to.toISOString(), $select: 'id,subject,start,end,attendees,isCancelled,sensitivity', $top: '250' });
  let url: string | undefined = `${cfg.eventsUrl}?${q}`;
  while (url) {
    const j: Record<string, unknown> = await getJson(url, token, { Prefer: 'outlook.timezone="UTC"' });
    for (const e of (j.value as Record<string, any>[]) ?? []) {
      if (e.isCancelled) continue;
      const start = e.start?.dateTime ? new Date(`${String(e.start.dateTime).replace(/Z$/, '')}Z`) : null;
      const end = e.end?.dateTime ? new Date(`${String(e.end.dateTime).replace(/Z$/, '')}Z`) : null;
      if (!e.id || !start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      out.push({
        externalId: String(e.id),
        title: String(e.subject ?? '(no title)').slice(0, 300),
        start, end,
        isPrivate: e.sensitivity === 'private' || e.sensitivity === 'confidential',
        attendees: ((e.attendees as Record<string, any>[]) ?? []).slice(0, 100).map((a) => ({ email: a.emailAddress?.address?.toLowerCase() ?? null, name: a.emailAddress?.name ?? null })),
      });
    }
    url = typeof j['@odata.nextLink'] === 'string' ? (j['@odata.nextLink'] as string) : undefined;
  }
  return out;
}

export const fetchEvents = (p: CalendarProvider, cfg: ProviderConfig, token: string, from: Date, to: Date) =>
  p === 'google' ? googleEvents(cfg, token, from, to) : microsoftEvents(cfg, token, from, to);
