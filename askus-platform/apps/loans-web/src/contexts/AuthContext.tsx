import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { UserProfile } from '../types'
import {
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
  sendPhoneOtp: (mobile: string) => Promise<boolean>
  verifyPhoneOtp: (mobile: string, code: string) => Promise<boolean>
  sendWhatsAppOtp: (mobile: string) => Promise<boolean>
  verifyWhatsAppOtp: (mobile: string, code: string) => Promise<boolean>
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

  const sendPhoneOtp = async (mobile: string) => {
    try {
      await requestPhoneOtp(mobile)
      showToast({ type: 'info', title: 'Verification code sent', message: 'Enter the 6-digit code we sent to your mobile number.' })
      return true
    } catch (error) {
      showToast({ type: 'error', title: 'Could not send code', message: error instanceof Error ? error.message : 'Phone verification failed.' })
      return false
    }
  }

  const verifyPhoneOtp = async (mobile: string, code: string) => {
    const result = await confirmPhoneOtp(mobile, code)
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

  const sendWhatsAppOtp = async () => {
    showToast({ type: 'error', title: 'WhatsApp unavailable', message: 'WhatsApp authentication has not been configured.' })
    return false
  }
  const verifyWhatsAppOtp = async () => false

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
      openAuthModal, closeAuthModal, sendPhoneOtp, verifyPhoneOtp, sendWhatsAppOtp,
      verifyWhatsAppOtp, loginWithGoogle, completeGooglePhoneLinking, logout, patchUser,
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
