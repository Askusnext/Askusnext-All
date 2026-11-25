import { useEffect, useRef } from 'react'
import { ArrowRight, Check, Headset, MousePointerClick, X } from 'lucide-react'
import { inr } from '../lib/products'
import { OFFLINE_CASHBACK, ONLINE_CASHBACK, type OfflineType } from '../lib/offline'
import type { Product } from '../lib/products'
import '../ui/ui.css' // shared resets for .app-root
import { productPhoto } from '../lib/photos'

/** "How would you like to buy?" Online (partner journey) or Offline (we collect details and process it). */
export default function ModeChoice({
  product, onOnline, onOffline, onClose,
}: { product: Product; onOnline: () => void; onOffline: () => void; onClose: () => void }) {
  const type = product.id as OfflineType
  const dlg = useRef<HTMLDialogElement>(null)
  const label = product.name.replace(' Insurance', '').toLowerCase()
  const onlineCash = ONLINE_CASHBACK[type]
  const photo = productPhoto(product.id, 288, 192)
  useEffect(() => {
    const d = dlg.current!
    d.showModal()
    return () => d.close()
  }, [])

  const options = [
    {
      key: 'online', title: 'Buy online', go: onOnline, cta: 'Continue online', Icon: MousePointerClick,
      text: 'Compare live quotes and buy right now.',
      kicker: onlineCash ? 'Earn up to' : 'Save up to', stat: onlineCash ? inr(onlineCash) : '91%+', unit: onlineCash ? 'cashback' : 'on premiums',
      points: onlineCash ? ['Compare & save up to 91%+', 'Get policy in 10 minutes'] : ['Compare quotes from top insurers', 'Get policy in 10 minutes'],
      tone: { head: 'bg-[linear-gradient(135deg,#4f46e5_0%,#7c3aed_55%,#c026d3_100%)]', panel: 'bg-[linear-gradient(135deg,#eef2ff,#f5f3ff)] ring-indigo-100', stat: 'bg-[linear-gradient(135deg,#4338ca,#a21caf)]', tick: 'bg-indigo-600', btn: 'bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] shadow-[0_12px_24px_-12px_rgba(79,70,229,.8)]', ring: 'hover:shadow-[0_24px_50px_-22px_rgba(124,58,237,.55)]' },
    },
    {
      key: 'offline', title: 'Buy with our team', go: onOffline, cta: 'Continue offline', Icon: Headset,
      text: 'Share your details, we do the rest.',
      kicker: 'Earn up to', stat: inr(OFFLINE_CASHBACK[type]), unit: 'cashback',
      points: ['Best quote arranged by our team', 'We call you within 24 hours'],
      tone: { head: 'bg-[linear-gradient(135deg,#059669_0%,#10b981_55%,#14b8a6_100%)]', panel: 'bg-[linear-gradient(135deg,#ecfdf5,#f0fdfa)] ring-emerald-100', stat: 'bg-[linear-gradient(135deg,#047857,#0d9488)]', tick: 'bg-emerald-600', btn: 'bg-[linear-gradient(135deg,#059669,#0d9488)] shadow-[0_12px_24px_-12px_rgba(5,150,105,.8)]', ring: 'hover:shadow-[0_24px_50px_-22px_rgba(5,150,105,.55)]' },
    },
  ]

  return (
    <dialog ref={dlg} aria-label={product.name} onCancel={(e) => { e.preventDefault(); onClose() }} onClick={(e) => { if (e.target === dlg.current) onClose() }}
      style={{ fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif", background: 'radial-gradient(90% 55% at 100% 0%, #e0e7ff 0%, rgba(224,231,255,0) 70%), radial-gradient(70% 45% at 0% 0%, #fce7f3 0%, rgba(252,231,243,0) 70%), #fff' }}
      className="app-root m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[680px] overflow-y-auto rounded-[28px] border-0 p-0 text-zinc-900 shadow-[0_32px_80px_-24px_rgba(15,23,42,.45)] backdrop:bg-slate-900/50 backdrop:backdrop-blur-[3px]">
      <div className="p-6 sm:p-9">
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex rounded-full bg-[linear-gradient(135deg,#4f46e5,#c026d3)] px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-white shadow-[0_6px_14px_-8px_rgba(124,58,237,.9)]">{product.name}</p>
            <h2 className="mt-3 text-[26px] font-extrabold leading-tight tracking-[-.025em] text-slate-900 sm:text-[31px]">How would you like to <span className="bg-[linear-gradient(135deg,#4f46e5,#c026d3)] bg-clip-text text-transparent">buy?</span></h2>
            <p className="mt-2 text-[15px] font-medium leading-relaxed text-slate-600">Pick the way that suits you. Both get you covered.</p>
          </div>
          {photo && <img src={photo.src} alt="" className="pointer-events-none mr-10 hidden h-[84px] w-auto shrink-0 self-center drop-shadow-[0_14px_14px_rgba(15,23,42,.18)] sm:block" />}
          <button type="button" aria-label="Close" onClick={onClose}
            className="absolute -right-2 -top-2 grid size-9 place-items-center rounded-full bg-white text-slate-600 shadow-[0_2px_8px_-2px_rgba(15,23,42,.2)] ring-1 ring-slate-200 transition-colors hover:bg-slate-900 hover:text-white sm:-right-3 sm:-top-3"><X size={18} /></button>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {options.map((o) => (
            <button key={o.key} type="button" onClick={o.go}
              className={`group flex flex-col overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-0 text-left shadow-[0_10px_30px_-18px_rgba(15,23,42,.35)] transition-all duration-200 hover:-translate-y-1 ${o.tone.ring}`}>
              <span className={`relative flex items-center gap-3 overflow-hidden px-6 py-5 text-white ${o.tone.head}`}>
                <span aria-hidden className="absolute -right-6 -top-8 size-28 rounded-full bg-white/15" />
                <span aria-hidden className="absolute right-10 -bottom-10 size-20 rounded-full bg-white/10" />
                <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-white/20 ring-1 ring-white/30"><o.Icon size={21} strokeWidth={2} /></span>
                <span className="relative">
                  <span className="block text-[18px] font-bold tracking-[-.01em]">{o.title}</span>
                  <span className="block text-[13px] font-medium text-white/85">{o.text}</span>
                </span>
              </span>
              <span className="flex flex-1 flex-col px-6 pb-6">

              <span className={`mt-5 block rounded-2xl px-4 py-3.5 ring-1 ${o.tone.panel}`}>
                <span className="block text-[11px] font-bold uppercase tracking-[.14em] text-slate-600">{o.kicker}</span>
                <span className="mt-1 flex items-baseline gap-2">
                  <span className={`bg-clip-text text-[38px] font-extrabold leading-none tracking-[-.03em] text-transparent tabular-nums ${o.tone.stat}`}>{o.stat}</span>
                  <span className="text-sm font-bold text-slate-700">{o.unit}</span>
                </span>
              </span>

              <ul className="mt-5 space-y-3 text-[14px] font-semibold text-slate-800">
                {o.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5"><span className={`mt-px grid size-5 shrink-0 place-items-center rounded-full text-white ${o.tone.tick}`}><Check size={12} strokeWidth={3.2} /></span>{p}</li>
                ))}
              </ul>

              <span className="mt-auto block pt-6">
                <span className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white transition-[filter] group-hover:brightness-110 ${o.tone.btn}`}>
                  {o.cta}<ArrowRight size={17} strokeWidth={2.4} className="transition-transform group-hover:translate-x-1" />
                </span>
              </span>
              </span>
            </button>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-[520px] text-center text-xs font-medium leading-relaxed text-slate-500">
          Cashback is credited once your {label} policy is confirmed. Amounts shown are the maximum and depend on the insurer and plan.
        </p>
      </div>
    </dialog>
  )
}
