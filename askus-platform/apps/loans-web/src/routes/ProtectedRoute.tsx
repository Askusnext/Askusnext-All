import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isMobileVerified, isLoading, openAuthModal } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs text-slate-500">
        Loading session...
      </div>
    )
  }

  if (!isAuthenticated || !isMobileVerified) {
    // Open auth modal for smooth UX and redirect to home
    openAuthModal('phone')
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
