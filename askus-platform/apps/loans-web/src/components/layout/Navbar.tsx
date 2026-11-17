import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, Zap, UserCircle2, ShieldAlert, ChevronDown } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { NAV_MENUS, MOBILE_SHORTCUTS, assetUrl, type NavColumn } from '../../constants/navigation'
import { MegaMenu } from './MegaMenu'
import { HeaderSearch } from './HeaderSearch'

const MobileColumns: React.FC<{ columns: NavColumn[]; close: () => void }> = ({ columns, close }) => (
  <div className="space-y-4 pb-2 pl-2">
    {columns.map((col) => (
      <div key={col.title}>
        <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#052f5f]">
          {col.icon && <img src={assetUrl(col.icon)} alt="" width={14} height={14} />}
          {col.title}
        </p>
        <ul className="border-l border-[#e4e4e3] pl-3">
          {col.links.map((l) => (
            <li key={l.to + l.label}>
              <Link to={l.to} onClick={close} className="block py-1.5 text-[13px] text-slate-700 hover:text-[#0066ff]">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
)

export const Navbar: React.FC = () => {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileSection, setMobileSection] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<string | null>(null)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, isAdmin, openAuthModal, logout } = useAuth()
  const headerRef = useRef<HTMLElement>(null)
  const timer = useRef<number | undefined>(undefined)

  const closeAll = useCallback(() => {
    window.clearTimeout(timer.current)
    setOpenMenu(null)
    setMobileOpen(false)
    setUserDropdownOpen(false)
  }, [])

  // Close everything when the route changes.
  const [lastPath, setLastPath] = useState(location.pathname + location.search)
  if (lastPath !== location.pathname + location.search) {
    setLastPath(location.pathname + location.search)
    setOpenMenu(null)
    setMobileOpen(false)
  }

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
        setUserDropdownOpen(false)
          }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [closeAll])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const hoverOpen = (id: string) => {
    window.clearTimeout(timer.current)
    setOpenMenu(id)
  }
  const hoverClose = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpenMenu(null), 140)
  }

  const current = NAV_MENUS.find((m) => m.id === openMenu)

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-[#e4e4e3] bg-white font-[Poppins,sans-serif]">
      {(openMenu || userDropdownOpen) && (
        <div aria-hidden onClick={closeAll} className="fixed inset-x-0 bottom-0 top-[69px] hidden bg-black/30 lg:block" />
      )}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center gap-4 lg:h-[68px]">
          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="-ml-2 rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Logo */}
          <Link to="/" className="group flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0052cc] to-[#0066ff] text-white shadow-md shadow-blue-500/25 transition-transform group-hover:scale-105">
              <Zap className="h-[18px] w-[18px] fill-current" />
            </span>
            <span className="leading-none">
              <span className="block text-xl font-bold tracking-tight text-[#052f5f]">
                Askus <span className="text-[#0066ff]">Fin</span>
              </span>
              <span className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:block">India's Credit Hub</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Primary" className="ml-4 hidden flex-1 items-center lg:flex" onMouseLeave={hoverClose}>
            {NAV_MENUS.map((m) => {
              const active = openMenu === m.id
              return (
                <div key={m.id} onMouseEnter={() => hoverOpen(m.id)} className="relative">
                  <button
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={active}
                    onClick={() => {
                      // With a mouse the hover opens the menu, so a click goes to the section's page.
                      if (m.to && window.matchMedia('(hover: hover)').matches) {
                        closeAll()
                        navigate(m.to)
                      } else {
                        setOpenMenu(active ? null : m.id)
                      }
                    }}
                    onFocus={() => hoverOpen(m.id)}
                    className={`relative flex h-[68px] items-center gap-1 whitespace-nowrap px-2.5 text-[13px] font-medium transition-colors ${
                      active ? 'text-[#0066ff]' : 'text-[#1c1d1f] hover:text-[#0066ff]'
                    }`}
                  >
                    {m.label}
                    <ChevronDown size={13} className={`transition-transform duration-200 ${active ? 'rotate-180' : ''}`} />
                    <span className={`absolute inset-x-3 bottom-0 h-[3px] rounded-t bg-[#0066ff] transition-transform duration-200 ${active ? 'scale-x-100' : 'scale-x-0'}`} />
                  </button>
                </div>
              )
            })}

            {current && (
              <div
                onMouseEnter={() => hoverOpen(current.id)}
                className="absolute inset-x-0 top-full z-40 mx-auto animate-[megaIn_160ms_ease-out]"
                style={{ width: current.tabs ? 'min(1080px, calc(100vw - 3rem))' : 'min(820px, calc(100vw - 3rem))' }}
              >
                <MegaMenu key={current.id} menu={current} onNavigate={closeAll} />
              </div>
            )}
          </nav>

          <div className="ml-auto hidden w-60 xl:block">
            <HeaderSearch />
          </div>

          {/* Account menu */}
          <div className="relative ml-auto xl:ml-0">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={userDropdownOpen}
              aria-label={isAuthenticated ? 'Account menu' : 'Login or sign up'}
              onClick={() => setUserDropdownOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-[#0066ff] bg-white px-3.5 py-2.5 text-[#0066ff] transition hover:bg-[#f2f7ff]"
            >
              {isAdmin ? <ShieldAlert size={24} strokeWidth={1.6} /> : <UserCircle2 size={24} strokeWidth={1.6} />}
              <ChevronDown size={18} className={`transition-transform duration-200 ${userDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {userDropdownOpen && (
              <div role="menu" className="absolute right-0 top-full z-50 mt-3 w-[270px] animate-[menuIn_140ms_ease-out] rounded-md bg-white px-6 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                <span aria-hidden className="absolute -top-1.5 right-7 h-3 w-3 rotate-45 bg-white" />
                {isAuthenticated ? (
                  <>
                    <Link role="menuitem" to={isAdmin ? '/admin' : '/customer'} onClick={closeAll} className="block border-b border-[#e4e4e3] py-4 text-lg font-medium text-[#1c1d1f] hover:text-[#0066ff]">
                      My Account
                    </Link>
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        closeAll()
                        void logout()
                      }}
                      className="block w-full py-4 text-left text-lg font-medium text-[#1c1d1f] hover:text-[#0066ff]"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        closeAll()
                        openAuthModal('phone')
                      }}
                      className="block w-full border-b border-[#e4e4e3] py-4 text-left text-lg font-medium text-[#1c1d1f] hover:text-[#0066ff]"
                    >
                      Login / Sign Up
                    </button>
                    <Link role="menuitem" to="/apply" onClick={closeAll} className="block py-4 text-lg font-medium text-[#1c1d1f] hover:text-[#0066ff]">
                      Apply Now
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-30 overflow-y-auto overscroll-contain bg-white lg:hidden">
          <div className="space-y-5 px-4 py-4">
            <HeaderSearch onDone={closeAll} />

            <div className="grid grid-cols-4 gap-2">
              {MOBILE_SHORTCUTS.slice(0, 8).map((s) => (
                <Link key={s.label} to={s.to} onClick={closeAll} className="flex flex-col items-center gap-1.5 rounded-xl bg-[#f7f8fa] px-1 py-3 text-center text-[10px] font-medium leading-tight text-[#1c1d1f] active:bg-[#f2f7ff]">
                  <img src={assetUrl(s.icon)} alt="" width={26} height={26} />
                  {s.label}
                </Link>
              ))}
            </div>

            <div className="divide-y divide-[#f0f0ef] rounded-2xl border border-[#e4e4e3]">
              {NAV_MENUS.map((m) => {
                const open = mobileSection === m.id
                return (
                  <div key={m.id}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setMobileSection(open ? null : m.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[#1c1d1f]"
                    >
                      {m.label}
                      <ChevronDown size={16} className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="px-4 pb-3">
                        {m.tabs ? (
                          <div className="space-y-2">
                            {m.tabs.map((t) => {
                              const tOpen = mobileTab === t.id
                              return (
                                <div key={t.id} className="rounded-xl bg-[#f7f8fa]">
                                  <button type="button" aria-expanded={tOpen} onClick={() => setMobileTab(tOpen ? null : t.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] font-medium text-[#052f5f]">
                                    <img src={assetUrl(t.icon)} alt="" width={18} height={18} />
                                    <span className="flex-1">{t.label}</span>
                                    <ChevronDown size={14} className={`transition ${tOpen ? 'rotate-180' : ''}`} />
                                  </button>
                                  {tOpen && <div className="px-3 pb-2"><MobileColumns columns={t.columns} close={closeAll} /></div>}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <MobileColumns columns={m.columns ?? []} close={closeAll} />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex flex-col gap-2 pb-8">
              {isAuthenticated ? (
                <>
                  <Link to={isAdmin ? '/admin' : '/customer'} onClick={closeAll} className="rounded-full bg-[#0066ff] py-3 text-center text-sm font-semibold text-white">
                    {isAdmin ? 'Admin Console' : 'My Dashboard'}
                  </Link>
                  <button type="button" onClick={() => { closeAll(); logout() }} className="py-2 text-sm font-semibold text-rose-600">
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { closeAll(); openAuthModal('phone') }} className="rounded-full border border-[#0066ff] py-3 text-sm font-semibold text-[#0066ff]">
                    Login with OTP
                  </button>
                  <Link to="/apply" onClick={closeAll} className="rounded-full bg-[#0066ff] py-3 text-center text-sm font-semibold text-white">
                    Apply Now
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
