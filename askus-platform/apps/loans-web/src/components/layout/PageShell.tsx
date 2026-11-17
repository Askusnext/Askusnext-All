import React from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { AuthModal } from '../auth/AuthModal'

export const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-white text-[#1c1d1f] selection:bg-[#0066ff] selection:text-white">
    <Navbar />
    <AuthModal />
    <main>{children}</main>
    <Footer />
  </div>
)

export const Breadcrumbs: React.FC<{ items: { label: string; to?: string }[] }> = ({ items }) => (
  <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
    <ol className="flex flex-wrap items-center gap-1.5">
      {items.map((it, i) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>/</span>}
          {it.to ? (
            <Link to={it.to} className="hover:text-[#0066ff]">{it.label}</Link>
          ) : (
            <span className="font-medium text-slate-700">{it.label}</span>
          )}
        </li>
      ))}
    </ol>
  </nav>
)
