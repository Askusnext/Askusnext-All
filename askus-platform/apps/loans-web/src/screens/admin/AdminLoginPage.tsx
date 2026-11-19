import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { confirmAdminOtp, requestAdminOtp } from '../../services/api/authService'

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!cooldown) return
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const sendCode = async () => {
    setBusy(true)
    setError('')
    try {
      await requestAdminOtp(email)
      setStep('code')
      setCode('')
      setCooldown(30)
      setNotice(`We sent a 6-digit code to ${email.trim()}.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send the code.')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (step === 'email') return sendCode()
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code.')
    setBusy(true)
    setError('')
    try {
      await confirmAdminOtp(email, code)
      navigate('/admin', { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Admin sign-in failed.')
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Askus Financial Services</p>
          <h1 className="mt-2 text-2xl font-extrabold">Administrator sign-in</h1>
          <p className="mt-2 text-sm text-slate-400">
            Enter your staff email. We send a one-time code. Only accounts with loans admin access can open this console.
          </p>
        </div>
        <label className="block space-y-1.5 text-xs font-semibold">
          <span>Email</span>
          <input
            required
            type="email"
            autoComplete="username"
            disabled={step === 'code'}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm disabled:opacity-60"
          />
        </label>
        {step === 'code' && (
          <label className="block space-y-1.5 text-xs font-semibold">
            <span>6-digit code</span>
            <input
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-lg font-bold tracking-[0.5em]"
            />
          </label>
        )}
        {notice && step === 'code' && !error && <p className="rounded-xl border border-blue-800 bg-blue-950/60 p-3 text-sm text-blue-100">{notice}</p>}
        {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold hover:bg-blue-500 disabled:opacity-60">
          {busy ? 'Please wait…' : step === 'email' ? 'Send code' : 'Sign in to admin'}
        </button>
        {step === 'code' && (
          <div className="flex justify-between text-xs text-slate-400">
            <button type="button" onClick={() => { setStep('email'); setError(''); setCode('') }} className="hover:text-white">Change email</button>
            <button type="button" disabled={cooldown > 0 || busy} onClick={() => void sendCode()} className="hover:text-white disabled:opacity-50">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        )}
        <Link to="/" className="block text-center text-xs text-slate-400 hover:text-white">Return to site</Link>
      </form>
    </main>
  )
}
