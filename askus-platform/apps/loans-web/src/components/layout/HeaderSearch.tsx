import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { NAV_MENUS, type NavLinkItem } from '../../constants/navigation'

// Flat, de-duplicated list of every destination in the navigation.
const SEARCH_INDEX: NavLinkItem[] = (() => {
  const seen = new Set<string>()
  const out: NavLinkItem[] = []
  const push = (l: NavLinkItem) => {
    if (seen.has(l.label.toLowerCase())) return
    seen.add(l.label.toLowerCase())
    out.push(l)
  }
  for (const m of NAV_MENUS) {
    m.columns?.forEach((c) => c.links.forEach(push))
    m.tabs?.forEach((t) => t.columns.forEach((c) => c.links.forEach(push)))
  }
  return out
})()

export const HeaderSearch: React.FC<{ className?: string; onDone?: () => void }> = ({ className = '', onDone }) => {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return SEARCH_INDEX.filter((l) => l.label.toLowerCase().includes(q)).slice(0, 8)
  }, [query])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const go = (l: NavLinkItem) => {
    setQuery('')
    setOpen(false)
    navigate(l.to)
    onDone?.()
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <label className="sr-only" htmlFor="header-search">Search products, loans and calculators</label>
      <div className="flex items-center gap-2 rounded-full border border-[#e4e4e3] bg-[#f7f8fa] px-3.5 py-2 focus-within:border-[#0066ff] focus-within:bg-white">
        <Search size={15} className="text-slate-400" />
        <input
          id="header-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setCursor(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCursor((c) => Math.min(c + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(c - 1, 0))
            } else if (e.key === 'Enter' && results[cursor]) {
              e.preventDefault()
              go(results[cursor])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder="Search loans, cards, calculators"
          autoComplete="off"
          className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
      {open && query.trim().length >= 2 && (
        <ul role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[#e4e4e3] bg-white py-1 shadow-xl">
          {results.length === 0 && <li className="px-4 py-3 text-xs text-slate-500">No matches for “{query}”.</li>}
          {results.map((r, i) => (
            <li key={r.to + r.label} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(r)}
                className={`block w-full px-4 py-2 text-left text-xs ${i === cursor ? 'bg-[#f2f7ff] text-[#0066ff]' : 'text-slate-700'}`}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
