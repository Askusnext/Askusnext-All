import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ShieldAlert,
  FileSpreadsheet,
  Users,
  FileCheck2,
  Building2,
  History,
  Route,
  LogOut,
  Menu,
  X,
  Zap
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface AdminLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

const NAV_ITEMS = [
  { label: 'Overview Metrics', path: '/admin', icon: ShieldAlert },
  { label: 'Applications', path: '/admin/applications', icon: Route },
  { label: 'Earlier Applications', path: '/admin/legacy-applications', icon: FileSpreadsheet },
  { label: 'Customer Directory', path: '/admin/customers', icon: Users },
  { label: 'Document Review', path: '/admin/documents', icon: FileCheck2 },
  { label: 'Lenders & Policies', path: '/admin/lenders', icon: Building2 },
  { label: 'Audit Trail Logs', path: '/admin/audit-logs', icon: History }
]

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  title,
  subtitle
}) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAdmin, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close the drawer after navigating, and lock page scroll while it is open.
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setMenuOpen(false)
  }
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const isActive = (path: string) => location.pathname === path

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-slate-800 border border-slate-700 p-6 sm:p-8 text-center text-white">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold">Admin Privileges Required</h2>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            This dashboard is restricted to authorized operations leads and credit verification underwriters.
          </p>
          <div className="mt-6 space-y-3">
            <Link
              to="/"
              className="block w-full py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 font-semibold text-xs transition"
            >
              Return to Public Website
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const signOut = () => {
    void logout().then(() => navigate('/', { replace: true }))
  }

  const sidebar = (
    <>
      <div>
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
              <Zap size={18} />
            </div>
            <div>
              <span className="text-xl font-extrabold text-white">
                Askus <span className="text-blue-500">Fin</span>
              </span>
              <span className="block text-[9px] uppercase font-bold text-blue-400 tracking-wider">
                Admin Console
              </span>
            </div>
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 mx-3 my-4 rounded-2xl bg-blue-950/40 border border-blue-800/40">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
            <ShieldAlert size={14} className="text-blue-400" />
            <span>Operations Lead</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono truncate">
            {user?.email || 'admin@askusfin.in'}
          </p>
        </div>

        <nav className="px-3 space-y-1" aria-label="Admin">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 px-3.5 py-3 md:py-2.5 rounded-xl text-sm md:text-xs font-semibold transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <Link
          to="/"
          className="md:hidden block w-full rounded-xl border border-slate-700 py-3 text-center text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          Public Website
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-3 md:py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 transition"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:sticky md:top-0 md:h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-slate-800 bg-slate-950 text-slate-300">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-black/60" />
          <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-[300px] flex-col justify-between overflow-y-auto bg-slate-950 text-slate-300 shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-white sm:text-xl">{title}</h1>
            {subtitle && <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400 sm:text-xs">{subtitle}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden lg:inline-flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Operations Mode
            </span>
            <Link
              to="/"
              className="hidden sm:inline-block rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              Public Website
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-slate-900 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
