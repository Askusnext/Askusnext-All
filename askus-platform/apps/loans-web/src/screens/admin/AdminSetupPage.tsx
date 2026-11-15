import React from 'react'
import { Link } from 'react-router-dom'

export const AdminSetupPage: React.FC = () => {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Askus Fin</p>
          <h1 className="mt-2 text-2xl font-extrabold">Admin accounts are managed by the platform</h1>
          <p className="mt-2 text-sm text-slate-400">Staff are given loans admin access by a super admin. Sign in with your email and a one-time code.</p>
        </div>
        <Link to="/admin/login" className="block text-center text-xs text-slate-400 hover:text-white">Go to admin sign-in</Link>
      </div>
    </main>
  )
}
