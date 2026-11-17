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

async function verify(identifier: string, code: string): Promise<UserProfile> {
  const tokens = await http<AuthTokens>('/auth/verify-otp', { method: 'POST', body: { identifier, code } })
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

export async function requestPhoneOtp(mobile: string) {
  const identifier = normalizeIndianPhone(mobile)
  try {
    await http('/auth/request-otp', { method: 'POST', body: { identifier } })
  } catch (error) {
    throw new Error(friendly(error, 'Could not send the code.'))
  }
  return { success: true }
}

export async function confirmPhoneOtp(mobile: string, code: string) {
  try {
    const user = await verify(normalizeIndianPhone(mobile), code.trim())
    emit(user)
    return { success: true, user }
  } catch (error) {
    return { success: false, error: friendly(error, 'Phone verification failed.') }
  }
}

// ---- Staff: email OTP ----

export async function requestAdminOtp(email: string) {
  try {
    await http('/auth/request-otp', { method: 'POST', body: { identifier: email.trim().toLowerCase() } })
  } catch (error) {
    throw new Error(friendly(error, 'Could not send the code.'))
  }
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

export function isWhatsAppAuthAvailable() {
  return false
}

export async function requestWhatsAppOtp() {
  return { success: false, error: 'WhatsApp authentication is not configured.' }
}

export async function confirmWhatsAppOtp() {
  return { success: false, error: 'WhatsApp authentication is not configured.' }
}
