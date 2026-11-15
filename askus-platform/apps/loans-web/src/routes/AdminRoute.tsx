import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-xs text-slate-400">
        Verifying administrator privileges...
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-slate-800 border border-slate-700 p-8 text-center text-white">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold">Admin Privileges Required</h2>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            This dashboard is restricted to authorized operations leads and credit verification underwriters.
          </p>
          <div className="mt-6 space-y-3">
            <Link to="/admin/login" className="block w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500">
              Admin sign-in
            </Link>
            <Link
              to="/"
              className="block w-full py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 font-semibold text-xs transition"
            >
              Return to Public Website
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
