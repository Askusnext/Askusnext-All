import React from 'react'
import { ExternalLink } from 'lucide-react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { LENDERS } from '../../constants/banks'

export const AdminLendersPage: React.FC = () => (
  <AdminLayout
    title="Lender Information Sources"
    subtitle="Rates, eligibility, fees, timelines and documentation must be checked with each lender."
  >
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-800/50 bg-amber-950/40 p-4 text-xs text-amber-200">
        Lender data is not yet managed in the database. This page does not publish unverified terms or allow unsaved edits.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {LENDERS.map((lender) => (
          <div key={lender.id} className="rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{lender.name}</h3>
                <span className="text-[10px] font-bold text-blue-400">{lender.code}</span>
              </div>
              <a href={lender.publicReferenceUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white" aria-label={`Open official ${lender.name} information`}>
                <ExternalLink size={16} />
              </a>
            </div>
            <p className="text-xs text-slate-300">{lender.tagline}</p>
            <p className="text-[11px] text-slate-500">Last verified: not recorded</p>
          </div>
        ))}
      </div>
    </div>
  </AdminLayout>
)
