'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, type OtpRequestResult } from '@askus/api-client'
import type { CustomerProfileDto } from '@askus/shared-types'
import { api, tokenStore } from '../lib/api'
import { normMobile } from '../lib/validate'

/** Shape kept from the Firebase days so the existing screens read the same fields. */
export type AuthUser = {
  uid: string
  displayName: string | null
  /** E.164, for example +919876543210 */
  phoneNumber: string
  email: string | null
}

type Ctx = {
  /** Signed in with a verified mobile number. */
  user: AuthUser | null
  loading: boolean
  /**
   * `identifier` is an email or an Indian mobile number. A first sign-in also needs the other contact
   * (`needs: 'email' | 'mobile'`) and verifies both; later sign-ins get a single email OTP.
   */
  requestOtp: (identifier: string, otherIdentifier?: string) => Promise<OtpRequestResult>
  /** `otherCode` is the second code of a first sign-in. */
  confirmOtp: (code: string, otherCode?: string) => Promise<void>
  /** Email or mobile + password, for accounts that have a password set. */
  loginWithPassword: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Re-reads the profile after it was edited elsewhere. */
  reload: () => Promise<void>
}
const AuthCtx = createContext<Ctx | null>(null)

export function authMessage(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 401) return e.message && e.message !== 'Unauthorized' ? e.message : 'Incorrect or expired code. Check it or request a new one.'
    if (e.status === 429) return 'Too many attempts. Try again in a few minutes.'
    if (e.status === 400) return e.message
    if (e.status === 403) return e.message
    if (e.status === 409) return e.message
  }
  if (e instanceof TypeError) return 'Network error. Check your connection.'
  return e instanceof Error && e.message.startsWith('Enter ') ? e.message : 'Something went wrong. Please try again.'
}

// Same AskUs account as Askus Solutions: staff accounts made there may have only an email, so a mobile is not required to be signed in.
const toUser = (p: CustomerProfileDto): AuthUser =>
  ({ uid: p.userId, displayName: p.displayName, phoneNumber: p.mobile ?? '', email: p.contactEmail ?? p.loginEmail })

/** An email stays as typed; a mobile number becomes +91XXXXXXXXXX. Throws a readable error otherwise. */
export function toIdentifier(raw: string) {
  const v = raw.trim()
  if (v.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) throw new Error('Enter a valid email address.')
    return v.toLowerCase()
  }
  const national = normMobile(v)
  if (!/^[6-9]\d{9}$/.test(national)) throw new Error('Enter a valid email address or 10-digit mobile number.')
  return `+91${national}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [ident, setIdent] = useState('')
  const [other, setOther] = useState('')

  const reload = useCallback(async () => {
    if (!tokenStore.get()) return setUser(null)
    try {
      setUser(toUser(await api.customer.me()))
    } catch (e) {
      // only a rejected session ends the sign-in; a network blip keeps it
      if (e instanceof ApiError && e.status === 401) tokenStore.clear()
      setUser(null)
    }
  }, [])

  useEffect(() => { void reload().finally(() => setLoading(false)) }, [reload])

  const value = useMemo<Ctx>(() => ({
    user,
    loading,
    reload,
    async requestOtp(identifier, otherIdentifier) {
      const id = toIdentifier(identifier)
      const second = otherIdentifier?.trim() ? toIdentifier(otherIdentifier) : undefined
      const res = await api.auth.requestOtp(id, second)
      setIdent(id)
      setOther(second ?? '')
      return res
    },
    async confirmOtp(code, otherCode) {
      if (!ident) throw new Error('Enter a new OTP request first.')
      const second = otherCode ? { identifier: other || undefined, code: otherCode } : undefined
      tokenStore.set(await api.auth.verifyOtp(ident, code, second))
      await reload()
    },
    async loginWithPassword(identifier, password) {
      tokenStore.set(await api.auth.loginPassword(toIdentifier(identifier), password))
      await reload()
    },
    async logout() {
      const t = tokenStore.get()
      if (t) await api.auth.logout(t.refreshToken).catch(() => undefined)
      tokenStore.clear()
      setUser(null)
    },
  }), [user, loading, ident, other, reload])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth outside AuthProvider')
  return c
}
