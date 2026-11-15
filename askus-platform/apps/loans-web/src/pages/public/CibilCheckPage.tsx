import React from 'react'
import { Gauge } from 'lucide-react'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { AuthModal } from '../../components/auth/AuthModal'

export const CibilCheckPage: React.FC = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
    <Navbar />
    <AuthModal />
    <section className="bg-slate-900 text-white py-14 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 border border-amber-400/30">
            <Gauge size={14} />
            <span>Bureau integration unavailable</span>
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">Credit Score Information</h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Askus Fin does not currently request or retrieve credit bureau reports. No PAN, date of birth, or mobile number is collected on this page.
          </p>
        </div>
      </div>
    </section>
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-24">
      <div className="rounded-3xl bg-white border border-slate-200 p-7 sm:p-10 shadow-xl space-y-4">
        <h2 className="text-xl font-bold">Use your credit bureau’s official channel</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          To access your report, contact the bureau directly through its official website. Askus Fin will only add a bureau integration after the provider, consent flow, security controls, and testing are in place.
        </p>
      </div>
    </main>
    <Footer />
  </div>
)
