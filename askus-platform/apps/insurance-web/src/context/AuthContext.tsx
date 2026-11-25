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
  /** First sign-in needs an email too (`needs: 'email'`); later sign-ins get a single email OTP. */
  requestOtp: (mobile: string, email?: string, whatsapp?: boolean) => Promise<OtpRequestResult>
  /** `emailCode` is the second code of a first sign-in. */
  confirmOtp: (code: string, name?: string, emailCode?: string) => Promise<void>
  logout: () => Promise<void>
  /** Re-reads the profile after it was edited elsewhere. */
  reload: () => Promise<void>
}
const AuthCtx = createContext<Ctx | null>(null)

export function authMessage(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Incorrect or expired OTP. Check the code or request a new one.'
    if (e.status === 429) return 'Too many attempts. Try again in a few minutes.'
    if (e.status === 400) return e.message
    if (e.status === 403) return e.message
    if (e.status === 409) return e.message
  }
  if (e instanceof TypeError) return 'Network error. Check your connection.'
  return e instanceof Error && e.message.startsWith('Enter ') ? e.message : 'Something went wrong. Please try again.'
}

const toUser = (p: CustomerProfileDto): AuthUser | null =>
  p.mobile ? { uid: p.userId, displayName: p.displayName, phoneNumber: p.mobile, email: p.contactEmail ?? p.loginEmail } : null

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

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
    async requestOtp(mobile, mail, whatsapp) {
      const national = normMobile(mobile)
      if (!/^[6-9]\d{9}$/.test(national)) throw new Error('Enter a valid 10-digit Indian mobile number.')
      const res = await api.auth.requestOtp(`+91${national}`, mail?.trim() || undefined, whatsapp ? 'whatsapp' : undefined)
      setPhone(`+91${national}`)
      setEmail(mail?.trim() ?? '')
      return res
    },
    async confirmOtp(code, name, emailCode) {
      if (!phone) throw new Error('Enter a new OTP request first.')
      const other = emailCode ? { identifier: email || undefined, code: emailCode } : undefined
      tokenStore.set(await api.auth.verifyOtp(phone, code, other))
      if (name?.trim()) await api.customer.update({ displayName: name.trim() })
      await reload()
    },
    async logout() {
      const t = tokenStore.get()
      if (t) await api.auth.logout(t.refreshToken).catch(() => undefined)
      tokenStore.clear()
      setUser(null)
    },
  }), [user, loading, phone, email, reload])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth outside AuthProvider')
  return c
}
