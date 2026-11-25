import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { UserProfile } from '../types'
import {
  type OtpOutcome,
  confirmPhoneOtp,
  initiateGoogleSignIn,
  observeAuth,
  requestPhoneOtp,
  logoutUser,
  resetPhoneRecaptcha,
} from '../services/api/authService'
import { useToast } from './ToastContext'

interface AuthContextType {
  user: UserProfile | null
  isAuthenticated: boolean
  isMobileVerified: boolean
  isAdmin: boolean
  isLoading: boolean
  isAuthModalOpen: boolean
  pendingGoogleUser: { uid: string; email: string; displayName: string } | null
  openAuthModal: (defaultTab?: 'phone' | 'whatsapp') => void
  closeAuthModal: () => void
  /** Asks for a code. `whatsapp: true` asks for it on WhatsApp. Returns what happened, or null if it could not be sent. */
  sendPhoneOtp: (mobile: string, opts?: { email?: string; whatsapp?: boolean }) => Promise<OtpOutcome | null>
  /** `other` carries the email and its code on a first sign-in. */
  verifyPhoneOtp: (mobile: string, code: string, other?: { email?: string; emailCode?: string }) => Promise<boolean>
  loginWithGoogle: () => Promise<boolean>
  completeGooglePhoneLinking: (mobile: string, code: string) => Promise<boolean>
  logout: () => Promise<void>
  /** Merge saved profile edits into the in-memory user (the save happens elsewhere). */
  patchUser: (patch: Partial<UserProfile>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [pendingGoogleUser, setPendingGoogleUser] = useState<AuthContextType['pendingGoogleUser']>(null)
  const { showToast } = useToast()

  useEffect(() => {
    const unsubscribe = observeAuth((profile) => {
      setUser(profile)
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), [])
  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false)
    setPendingGoogleUser(null)
    resetPhoneRecaptcha()
  }, [])

  const sendPhoneOtp = async (mobile: string, opts?: { email?: string; whatsapp?: boolean }) => {
    try {
      const outcome = await requestPhoneOtp(mobile, opts)
      if (outcome.needsEmail) return outcome // nothing sent yet: the screen asks for the email first
      const where = outcome.mobileChannel === 'whatsapp' ? 'on WhatsApp' : outcome.dual ? 'by SMS and email' : 'to your email'
      showToast({
        type: 'info',
        title: outcome.whatsappFailed ? 'WhatsApp unavailable' : 'Verification code sent',
        message: outcome.whatsappFailed ? `WhatsApp is not available right now, so we sent your code ${outcome.dual ? 'by SMS' : 'to your email'}.` : `We sent your 6-digit code ${where}.`,
      })
      return outcome
    } catch (error) {
      showToast({ type: 'error', title: 'Could not send code', message: error instanceof Error ? error.message : 'Phone verification failed.' })
      return null
    }
  }

  const verifyPhoneOtp = async (mobile: string, code: string, other?: { email?: string; emailCode?: string }) => {
    const result = await confirmPhoneOtp(mobile, code, other)
    if (!result.success || !result.user) {
      showToast({ type: 'error', title: 'Verification failed', message: result.error || 'Check the code and try again.' })
      return false
    }
    setUser(result.user)
    setPendingGoogleUser(null)
    closeAuthModal()
    showToast({ type: 'success', title: 'Phone verified', message: 'You are signed in securely.' })
    return true
  }

  const loginWithGoogle = async () => {
    const result = await initiateGoogleSignIn()
    if (result.completed && result.user) {
      setUser(result.user)
      closeAuthModal()
      return true
    }
    if (result.pendingUser) {
      setPendingGoogleUser(result.pendingUser)
      return false
    }
    showToast({ type: 'error', title: 'Google sign-in failed', message: result.error || 'Please try again.' })
    return false
  }

  const completeGooglePhoneLinking = (mobile: string, code: string) => verifyPhoneOtp(mobile, code)
  const logout = async () => {
    setUser(null)
    setPendingGoogleUser(null)
    setIsAuthModalOpen(false)
    resetPhoneRecaptcha()
    try {
      await logoutUser()
      showToast({ type: 'info', title: 'Signed out', message: 'You have been signed out.' })
    } catch (error) {
      showToast({ type: 'error', title: 'Sign out failed', message: error instanceof Error ? error.message : 'Could not sign you out.' })
    }
  }

  const patchUser = useCallback((patch: Partial<UserProfile>) => setUser((u) => (u ? { ...u, ...patch } : u)), [])

  const isMobileVerified = Boolean(user?.isMobileVerified && user.mobileNumber)
  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: Boolean(user), isMobileVerified,
      isAdmin: user?.role === 'admin', isLoading, isAuthModalOpen, pendingGoogleUser,
      openAuthModal, closeAuthModal, sendPhoneOtp, verifyPhoneOtp, loginWithGoogle, completeGooglePhoneLinking, logout, patchUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
