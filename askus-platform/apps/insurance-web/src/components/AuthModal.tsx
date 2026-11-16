import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ShieldCheck, X } from 'lucide-react'
import OtpInput from './OtpInput'
import { authMessage, useAuth } from '../context/AuthContext'
import { validEmail, validMobile } from '../lib/validate'
import { Button, cn } from '../ui'
import type { OtpRequestResult } from '@askus/api-client'

/**
 * Sign in / sign up with a verified Indian mobile number (OTP through the central AskUs identity service):
 *  1. Mobile number → (first time only) email → 6-box OTP(s)
 * First sign-in verifies both mobile (SMS) and email; afterwards only an email OTP is sent.
 * `onClose('done')` fires once the user is fully signed in; `onClose('cancel')` when they dismiss it.
 */
export default function AuthModal({ onClose }: { onClose: (reason?: 'done' | 'cancel') => void }) {
  const { user, requestOtp, confirmOtp } = useAuth()
  const dlg = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState<'phone' | 'email' | 'otp'>('phone')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [dual, setDual] = useState(false)
  const [emailHint, setEmailHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    const d = dlg.current!
    d.showModal()
    return () => d.close()
  }, [])
  // fully signed in (mobile verified): done
  useEffect(() => { if (user) onClose('done') }, [user, onClose])
  useEffect(() => {
    if (!cooldown) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const run = async (fn: () => Promise<void>) => {
    setError(null)
    setBusy(true)
    try { await fn() } catch (e) { setError(authMessage(e)) } finally { setBusy(false) }
  }

  const gotOtp = (r: OtpRequestResult) => {
    if (r.needs) return setStep('email')
    setDual(r.channels?.length === 2)
    setEmailHint(r.emailHint ?? null)
    setStep('otp')
    setCooldown(30)
  }

  function sendOtp(e: FormEvent) {
    e.preventDefault()
    const bad = validMobile(mobile)
    if (bad) return setError(bad)
    setCode('')
    setEmailCode('')
    run(async () => gotOtp(await requestOtp(mobile)))
  }

  function sendEmailOtp(e: FormEvent) {
    e.preventDefault()
    const bad = validEmail(email)
    if (bad) return setError(bad)
    run(async () => gotOtp(await requestOtp(mobile, email)))
  }

  function verify(digits = code, emailDigits = emailCode) {
    if (!/^\d{6}$/.test(digits)) return setError('Enter the 6-digit OTP.')
    if (dual && !/^\d{6}$/.test(emailDigits)) return setError('Enter the 6-digit email OTP.')
    run(async () => {
      try { await confirmOtp(digits, undefined, dual ? emailDigits : undefined) } catch (e) { setCode(''); setEmailCode(''); throw e }
    })
  }
  // verify as soon as the last digit lands (typed, pasted or SMS autofill)
  useEffect(() => { if (step === 'otp' && code.length === 6 && (!dual || emailCode.length === 6) && !busy) verify(code, emailCode) }, [code, emailCode]) // eslint-disable-line react-hooks/exhaustive-deps

  const resend = () => run(async () => { setCode(''); setEmailCode(''); await requestOtp(mobile, email || undefined); setCooldown(30) })
  const back = () => { setStep('phone'); setCode(''); setEmailCode(''); setEmail(''); setError(null) }
  const close = () => onClose('cancel')

  const title = step === 'otp' ? (dual ? 'Verify mobile and email' : 'Verify your email') : step === 'email' ? 'Add your email' : 'Sign in or create account'
  const field = (
    <div className={cn('flex h-14 items-center rounded-xl border-2 bg-white px-3.5 transition-colors focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-500/15', error && step === 'phone' ? 'border-rose-400' : 'border-zinc-300')}>
      <span className="mr-2.5 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-600">IN</span>
      <span className="border-r border-zinc-200 pr-3 text-base font-medium text-zinc-800">+91</span>
      <input type="tel" inputMode="numeric" autoComplete="tel-national" autoFocus value={mobile} aria-label="Mobile number" aria-invalid={Boolean(error)}
        onChange={(e) => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); if (error) setError(null) }} placeholder="10-digit mobile number"
        className="h-full min-w-0 flex-1 border-0 bg-transparent pl-3 text-lg font-semibold tracking-wide text-zinc-900 outline-none placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-zinc-400" />
    </div>
  )

  return (
    <dialog ref={dlg} aria-label={title} onCancel={(e) => { e.preventDefault(); close() }} onClick={(e) => { if (e.target === dlg.current) close() }}
      className="app-root m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[420px] overflow-y-auto rounded-2xl border-0 bg-white p-0 text-zinc-900 shadow-[0_24px_64px_-12px_rgba(16,24,40,.35)] backdrop:bg-zinc-900/50">
      <div className="p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          {step !== 'phone'
            ? <button type="button" onClick={back} className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"><ArrowLeft size={16} />Back</button>
            : <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.08em] text-indigo-600"><ShieldCheck size={16} />Askus Insurance</span>}
          <button type="button" aria-label="Close" onClick={close} className="-mr-2 grid size-10 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><X size={18} /></button>
        </div>

        {step === 'phone' && (
          <form onSubmit={sendOtp} noValidate>
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">Enter your mobile number. We'll text you a 6-digit OTP to verify it.</p>
            <div className="mt-6">{field}</div>
            {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
            <Button type="submit" variant="primary" loading={busy} className="mt-5 h-12 w-full text-[15px]">{busy ? 'Sending OTP…' : 'Get OTP'}</Button>
            <p className="mt-6 text-center text-xs leading-relaxed text-zinc-400">A verified mobile number is required for every account. One AskUs login works across all AskUs services. By continuing you agree to the Terms of Use and Privacy Policy.</p>
          </form>
        )}

        {step === 'email' && (
          <form onSubmit={sendEmailOtp} noValidate>
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">First sign-in: we verify your mobile (SMS) and your email once. After that, codes come to your email only.</p>
            <input type="email" inputMode="email" autoComplete="email" autoFocus value={email} aria-label="Email address" aria-invalid={Boolean(error)} placeholder="you@example.com"
              onChange={(e) => { setEmail(e.target.value); if (error) setError(null) }}
              className={cn('mt-6 h-14 w-full rounded-xl border-2 bg-white px-3.5 text-base  || (dual && emailCode.length < 6)text-zinc-900 outline-none transition-colors focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/15', error ? 'border-rose-400' : 'border-zinc-300')} />
            {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
            <Button type="submit" variant="primary" loading={busy} className="mt-5 h-12 w-full text-[15px]">{busy ? 'Sending codes…' : 'Send codes'}</Button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={(e) => { e.preventDefault(); verify() }} noValidate>
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            {dual ? (
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">Enter the code sent by SMS to <b className="font-semibold text-zinc-900">+91 {mobile}</b>, then the code sent to your email.</p>
            ) : (
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">Enter the 6-digit code we emailed to <b className="font-semibold text-zinc-900">{emailHint ?? 'your email'}</b>.</p>
            )}
            <div className="mt-6"><OtpInput value={code} onChange={(v) => { setCode(v); if (error) setError(null) }} disabled={busy} invalid={Boolean(error)} /></div>
            {dual && <div className="mt-4"><OtpInput value={emailCode} onChange={(v) => { setEmailCode(v); if (error) setError(null) }} disabled={busy} invalid={Boolean(error)} /></div>}
            {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
            <Button type="submit" variant="primary" loading={busy} disabled={code.length < 6} className="mt-5 h-12 w-full text-[15px]">{busy ? 'Verifying…' : 'Verify and sign in'}</Button>
            <div className="mt-5 flex items-center justify-between text-sm text-zinc-500">
              <button type="button" onClick={back} className="-my-2.5 py-2.5 font-medium text-zinc-600 hover:text-zinc-900">Change number</button>
              <button type="button" onClick={resend} disabled={cooldown > 0 || busy} className="-my-2.5 py-2.5 font-medium text-indigo-600 hover:underline disabled:text-zinc-400 disabled:no-underline">
                {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  )
}
