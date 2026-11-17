import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { assetUrl, type NavColumn, type NavMenu } from '../../constants/navigation'

interface MegaMenuProps {
  menu: NavMenu
  onNavigate: () => void
}

const Columns: React.FC<{ columns: NavColumn[]; onNavigate: () => void }> = ({ columns, onNavigate }) => (
  <div className="grid gap-x-8 gap-y-6" style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, minmax(0, 1fr))` }}>
    {columns.map((col) => (
      <div key={col.title} className="min-w-[170px]">
        <h4 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[#052f5f]">
          {col.icon && <img src={assetUrl(col.icon)} alt="" width={16} height={16} />}
          {col.title}
        </h4>
        <ul className="space-y-0.5">
          {col.links.map((link) => (
            <li key={link.to + link.label}>
              <Link
                to={link.to}
                onClick={onNavigate}
                className="group flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-[#373a3e] transition hover:bg-[#f2f7ff] hover:text-[#0066ff] focus-visible:bg-[#f2f7ff] focus-visible:outline-none"
              >
                <span>{link.label}</span>
                {link.badge && <span className="ml-2 rounded bg-[#ff0080] px-1.5 text-[9px] font-bold uppercase text-white">{link.badge}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
)

export const MegaMenu: React.FC<MegaMenuProps> = ({ menu, onNavigate }) => {
  const [activeTab, setActiveTab] = useState(menu.tabs?.[0]?.id ?? '')
  const tab = menu.tabs?.find((t) => t.id === activeTab) ?? menu.tabs?.[0]

  return (
    <div className="rounded-b-2xl border border-t-0 border-[#e4e4e3] bg-white shadow-[0_24px_40px_-12px_rgba(5,47,95,0.18)]">
      {menu.tabs && tab ? (
        <div className="flex">
          <div role="tablist" aria-orientation="vertical" className="w-56 shrink-0 border-r border-[#e4e4e3] bg-[#f7f8fa] p-3">
            {menu.tabs.map((t) => {
              const active = t.id === tab.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onMouseEnter={() => setActiveTab(t.id)}
                  onFocus={() => setActiveTab(t.id)}
                  onClick={() => setActiveTab(t.id)}
                  className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    active ? 'bg-white text-[#0066ff] shadow-sm ring-1 ring-[#d9e8ff]' : 'text-[#373a3e] hover:bg-white/70'
                  }`}
                >
                  <img src={assetUrl(t.icon)} alt="" width={20} height={20} />
                  <span className="flex-1">{t.label}</span>
                  <ChevronRight size={14} className={active ? 'text-[#0066ff]' : 'text-slate-300'} />
                </button>
              )
            })}
            {menu.to && (
              <Link to={menu.to} onClick={onNavigate} className="mt-3 block rounded-xl px-3 py-2 text-xs font-semibold text-[#0066ff] hover:underline">
                Compare loan offers →
              </Link>
            )}
          </div>
          <div role="tabpanel" className="flex-1 p-6">
            <Columns columns={tab.columns} onNavigate={onNavigate} />
          </div>
        </div>
      ) : (
        <div className="p-6">
          <Columns columns={menu.columns ?? []} onNavigate={onNavigate} />
        </div>
      )}
    </div>
  )
}
