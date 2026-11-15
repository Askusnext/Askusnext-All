import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Gauge,
  UserCircle2,
  FileText,
  FolderOpen,
  LifeBuoy,
  LogOut,
  ChevronRight,
  Zap,
  Home,
  PlusCircle,
  ShieldCheck
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

const NAV = [
  { label: 'Dashboard', path: '/customer', icon: Gauge },
  { label: 'My Applications', path: '/customer/applications', icon: FileText },
  { label: 'My Profile', path: '/customer/profile', icon: UserCircle2 },
  { label: 'My Documents', path: '/customer/documents', icon: FolderOpen },
  { label: 'Help & Support', path: '/customer/support', icon: LifeBuoy }
]

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title, subtitle }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, isAdmin } = useAuth()
  const isActive = (path: string) =>
    path === '/customer' ? location.pathname === '/customer' : location.pathname.startsWith(path)
  const firstName = (user?.displayName || 'Customer').split(' ')[0]

  const doLogout = () => {
    void logout().then(() => navigate('/', { replace: true }))
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] font-[Poppins,sans-serif] text-[#1c1d1f]">
      {/* Header */}
      <header className="border-b border-[#e4e4e3] bg-white shadow-[0_2px_12px_rgba(5,47,95,0.05)]">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6 md:h-[72px]">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0052cc] to-[#0066ff] text-white shadow-md shadow-blue-500/25">
              <Zap className="h-[18px] w-[18px] fill-current" />
            </span>
            <span className="leading-none">
              <span className="block text-xl font-bold tracking-tight text-[#052f5f]">
                Askus <span className="text-[#0066ff]">Fin</span>
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">Customer Portal</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/apply" className="hidden items-center gap-1.5 rounded-md border border-[#0066ff] px-4 py-2 text-sm font-medium text-[#0066ff] hover:bg-[#f2f7ff] sm:flex">
              <PlusCircle size={16} /> New Application
            </Link>
            <Link to="/" className="flex items-center gap-1.5 rounded-md border border-[#0066ff] px-3 py-2 text-sm font-medium text-[#0066ff] hover:bg-[#f2f7ff]">
              <Home size={16} /> <span className="hidden sm:inline">Home</span>
            </Link>
            <Link to="/customer/profile" className="flex items-center gap-2 rounded-md border border-[#0066ff] px-3 py-2 text-sm font-medium text-[#0066ff] hover:bg-[#f2f7ff]">
              <UserCircle2 size={18} /> {firstName}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 md:grid-cols-[260px_minmax(0,1fr)] md:py-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
        {/* Sidebar */}
        <aside className="min-w-0 md:sticky md:top-6 md:self-start">
          <nav aria-label="Account" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 md:mx-0 md:flex-col md:gap-1 md:rounded-2xl md:bg-white md:p-4 md:pb-4 md:shadow-sm">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition md:justify-between ${
                    active ? 'bg-[#f2f7ff] text-[#0066ff]' : 'bg-white text-[#1c1d1f] hover:bg-[#f7f8fa] md:bg-transparent'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={20} className="text-[#0066ff]" />
                    {item.label}
                  </span>
                  <ChevronRight size={18} className="hidden text-[#0066ff] md:block" />
                </Link>
              )
            })}
            {isAdmin && (
              <button type="button" onClick={() => navigate('/admin')} className="flex shrink-0 items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-medium text-[#0066ff] hover:bg-[#f7f8fa] md:justify-between md:bg-transparent">
                <span className="flex items-center gap-3"><ShieldCheck size={20} /> Admin Panel</span>
                <ChevronRight size={18} className="hidden md:block" />
              </button>
            )}
            <button type="button" onClick={doLogout} className="flex shrink-0 items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-medium transition hover:bg-rose-50 md:justify-between md:bg-transparent">
              <span className="flex items-center gap-3"><LogOut size={20} className="text-rose-500" /> Logout</span>
              <ChevronRight size={18} className="hidden text-[#0066ff] md:block" />
            </button>
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-[#052f5f]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>

      <footer className="border-t border-[#e4e4e3] bg-white py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Askus Fin. Askus Fin does not lend money; lenders decide all credit outcomes.
      </footer>
    </div>
  )
}
