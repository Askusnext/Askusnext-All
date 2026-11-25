import { tokenStore } from '@askus/authentication'
import type { AuthTokens } from '@askus/shared-types'
import type { UserProfile } from '../../types'
import { API_BASE, ApiError, currentToken, http } from './http'

/**
 * Sign-in through the central AskUs identity service: a one-time code to a mobile number (customers)
 * or to an email address (staff). No passwords, no third-party auth.
 */

type Listener = (user: UserProfile | null) => void
const listeners = new Set<Listener>()
const emit = (user: UserProfile | null) => listeners.forEach((l) => l(user))

const ADMIN_ROLES = ['LOANS_ADMIN', 'SUPER_ADMIN']

export function normalizeIndianPhone(input: string) {
  const digits = input.replace(/\D/g, '')
  const national = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits
  if (!/^[6-9]\d{9}$/.test(national)) throw new Error('Enter a valid 10-digit Indian mobile number.')
  return `+91${national}`
}

interface Me {
  userId: string
  displayName: string | null
  contactEmail: string | null
  loginEmail: string | null
  mobile: string | null
  createdAt?: string
  updatedAt?: string
}

async function loadProfile(): Promise<UserProfile | null> {
  const token = currentToken()
  if (!token) return null
  try {
    const me = await http<Me>('/customer/me')
    const now = new Date().toISOString()
    return {
      uid: me.userId,
      mobileNumber: me.mobile ?? '',
      isMobileVerified: Boolean(me.mobile),
      email: me.contactEmail ?? me.loginEmail ?? undefined,
      displayName: me.displayName ?? undefined,
      role: token.roles.some((r) => ADMIN_ROLES.includes(r)) ? 'admin' : 'customer',
      createdAt: me.createdAt ?? now,
      updatedAt: me.updatedAt ?? now,
    }
  } catch (error) {
    // Only a rejected session ends the sign-in; a network blip keeps it.
    if (error instanceof ApiError && error.status === 401) tokenStore.clear()
    return null
  }
}

/** What a code request did, in the terms the sign-in screen needs. */
export interface OtpOutcome {
  /** First sign-in: the email address is still needed before any code is sent. */
  needsEmail: boolean
  /** First sign-in: two codes were sent (mobile and email) and both must be entered. */
  dual: boolean
  /** Where the code for the mobile number went; null when a verified account's code went to email only. */
  mobileChannel: 'whatsapp' | 'sms' | null
  emailHint?: string
  /** Masked number a WhatsApp code went to (verified accounts). */
  mobileHint?: string
  /** WhatsApp was asked for but could not be used, so the code was sent by SMS or email instead. */
  whatsappFailed: boolean
}

interface OtpResponse {
  sent: boolean
  needs?: 'email' | 'mobile'
  channels?: ('sms' | 'email' | 'whatsapp')[]
  emailHint?: string
  mobileHint?: string
  whatsappFailed?: boolean
}

const toOutcome = (r: OtpResponse): OtpOutcome => ({
  needsEmail: r.needs === 'email',
  dual: (r.channels?.length ?? 0) === 2,
  mobileChannel: r.channels?.includes('whatsapp') ? 'whatsapp' : r.channels?.includes('sms') ? 'sms' : null,
  emailHint: r.emailHint,
  mobileHint: r.mobileHint,
  whatsappFailed: Boolean(r.whatsappFailed),
})

let whatsappOffered = false

/** Asks the server what it can offer (is WhatsApp set up?). Never throws: on any problem WhatsApp is simply not offered. */
export async function loadAuthOptions(): Promise<boolean> {
  try {
    whatsappOffered = Boolean((await http<{ whatsapp?: boolean }>('/auth/options')).whatsapp)
  } catch {
    whatsappOffered = false
  }
  return whatsappOffered
}

async function verify(identifier: string, code: string, other?: { email?: string; emailCode?: string }): Promise<UserProfile> {
  const tokens = await http<AuthTokens>('/auth/verify-otp', {
    method: 'POST',
    body: { identifier, code, otherIdentifier: other?.email?.trim().toLowerCase() || undefined, otherCode: other?.emailCode || undefined },
  })
  tokenStore.set(tokens)
  const profile = await loadProfile()
  if (!profile) throw new Error('Could not load your profile. Please try again.')
  return profile
}

function friendly(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Incorrect or expired code. Check it or request a new one.'
    if (error.status === 429) return 'Too many attempts. Try again in a few minutes.'
    return error.message
  }
  if (error instanceof TypeError) return 'Network error. Check your connection.'
  return error instanceof Error ? error.message : fallback
}

// ---- Customers: mobile OTP ----

export function resetPhoneRecaptcha() {
  /* nothing to reset: there is no captcha widget any more */
}

/**
 * Asks for a sign-in code. A first sign-in also needs an email (the answer says so: `needsEmail`), then sends one
 * code to the mobile (SMS or WhatsApp) and one to the email. Later sign-ins get a single code (email, or WhatsApp
 * when asked for).
 */
export async function requestPhoneOtp(mobile: string, opts: { email?: string; whatsapp?: boolean } = {}): Promise<OtpOutcome> {
  const identifier = normalizeIndianPhone(mobile)
  try {
    const res = await http<OtpResponse>('/auth/request-otp', {
      method: 'POST',
      body: { identifier, otherIdentifier: opts.email?.trim().toLowerCase() || undefined, channel: opts.whatsapp ? 'whatsapp' : undefined },
    })
    return toOutcome(res)
  } catch (error) {
    throw new Error(friendly(error, 'Could not send the code.'))
  }
}

export async function confirmPhoneOtp(mobile: string, code: string, other?: { email?: string; emailCode?: string }) {
  try {
    const user = await verify(normalizeIndianPhone(mobile), code.trim(), other)
    emit(user)
    return { success: true, user }
  } catch (error) {
    return { success: false, error: friendly(error, 'Phone verification failed.') }
  }
}

// ---- Staff: email OTP ----

export async function requestAdminOtp(email: string) {
  let res: OtpResponse
  try {
    res = await http<OtpResponse>('/auth/request-otp', { method: 'POST', body: { identifier: email.trim().toLowerCase() } })
  } catch (error) {
    throw new Error(friendly(error, 'Could not send the code.'))
  }
  // A staff account that has never completed its first sign-in needs a mobile number too; do that once on the Solutions site.
  if (!res.sent) throw new Error('No code was sent. Complete your first sign-in on the Solutions site (it verifies your mobile and email), then come back.')
}

/** Signs a staff member in. Rejects (and signs out) any account without loans access. */
export async function confirmAdminOtp(email: string, code: string): Promise<UserProfile> {
  let profile: UserProfile
  try {
    profile = await verify(email.trim().toLowerCase(), code.trim())
  } catch (error) {
    throw new Error(friendly(error, 'Admin sign-in failed.'))
  }
  if (profile.role !== 'admin') {
    await logoutUser()
    throw new Error('This account does not have loans admin access.')
  }
  emit(profile)
  return profile
}

// ---- Session ----

export function observeAuth(callback: Listener) {
  listeners.add(callback)
  void loadProfile().then((profile) => {
    if (listeners.has(callback)) callback(profile)
  })
  return () => {
    listeners.delete(callback)
  }
}

export async function logoutUser() {
  const tokens = tokenStore.get()
  if (tokens) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    }).catch(() => undefined)
  }
  tokenStore.clear()
  emit(null)
}

// ---- Sign-in methods that are not offered ----

export async function initiateGoogleSignIn(): Promise<{
  completed: boolean
  user?: UserProfile
  pendingUser?: { uid: string; email: string; displayName: string }
  error?: string
}> {
  return { completed: false, error: 'Google sign-in is not available. Sign in with your mobile number.' }
}

/** True once `loadAuthOptions()` has found that the server can deliver codes on WhatsApp. */
export function isWhatsAppAuthAvailable() {
  return whatsappOffered
}
