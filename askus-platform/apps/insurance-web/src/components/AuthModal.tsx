'use client'

import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import { authMessage, useAuth } from '../context/AuthContext'

/**
 * Customer sign-in, same look and flow as the solutions-web staff login (StaffLoginModal):
 * a one-time code to an email or mobile number, or a password. One AskUs account across all AskUs services.
 * A first sign-in also asks for the other contact and verifies both (SMS + email); later codes go to email only.
 * `onClose('done')` fires once the user is signed in; `onClose('cancel')` when they dismiss it.
 */

type Mode = 'otp' | 'password'
const RESEND_SECONDS = 30
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MOBILE = /^(\+91|0)?[6-9]\d{9}$/

const kindOf = (raw: string): 'email' | 'mobile' | 'none' => {
  const v = raw.trim()
  if (EMAIL.test(v)) return 'email'
  if (MOBILE.test(v.replace(/[\s-]/g, ''))) return 'mobile'
  return 'none'
}

const svg = (d: React.ReactNode, size = 18, sw = 1.8) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
)
const Icon = {
  mail: svg(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></>),
  phone: svg(<><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" /></>),
  lock: svg(<><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>),
  eye: svg(<><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>),
  eyeOff: svg(<><path d="M3 3l18 18" /><path d="M10.6 5.6A10.4 10.4 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17 17 0 0 1-3.2 4M6.6 6.6A16.6 16.6 0 0 0 2 12s3.5 6.5 10 6.5a9.7 9.7 0 0 0 4.4-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>),
  check: svg(<path d="m5 12.5 4.5 4.5L19 7.5" />, 14, 2.4),
  close: svg(<path d="M6 6l12 12M18 6 6 18" />, 18, 2),
}

function Brand() {
  return (
    <span className="slm-logo">
      <img src="/askus-wordmark.png" alt="Askus" width={120} height={36} />
      <span>Askus Insurance</span>
    </span>
  )
}

function OtpBoxes({ digits, onChange, disabled, firstRef }: { digits: string[]; onChange: (next: string[]) => void; disabled: boolean; firstRef: RefObject<HTMLInputElement | null> }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const focus = (i: number) => refs.current[Math.max(0, Math.min(5, i))]?.focus()
  const fill = (start: number, raw: string) => {
    const incoming = raw.replace(/\D/g, '').slice(0, 6 - start).split('')
    if (!incoming.length) return
    const next = [...digits]
    incoming.forEach((d, k) => { next[start + k] = d })
    onChange(next)
    focus(start + incoming.length)
  }
  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits]
      next[i - 1] = ''
      onChange(next)
      focus(i - 1)
      e.preventDefault()
    } else if (e.key === 'ArrowLeft') focus(i - 1)
    else if (e.key === 'ArrowRight') focus(i + 1)
  }
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => { e.preventDefault(); fill(0, e.clipboardData.getData('text')) }

  return (
    <div className="slm-otp" role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input key={i} className="slm-otp-box" type="text" inputMode="numeric" maxLength={6} aria-label={`Digit ${i + 1}`}
          autoComplete={i === 0 ? 'one-time-code' : 'off'} value={d} disabled={disabled}
          ref={(el) => { refs.current[i] = el; if (i === 0) (firstRef as { current: HTMLInputElement | null }).current = el }}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '')
            if (!v) { const next = [...digits]; next[i] = ''; onChange(next); return }
            fill(i, v)
          }}
          onKeyDown={(e) => onKeyDown(i, e)} onPaste={onPaste} onFocus={(e) => e.target.select()} />
      ))}
    </div>
  )
}

export default function AuthModal({ onClose }: { onClose: (reason?: 'done' | 'cancel') => void }) {
  const { user, requestOtp, confirmOtp, loginWithPassword } = useAuth()
  const [mode, setMode] = useState<Mode>('otp')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [codeSent, setCodeSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // First sign-in verifies mobile and email; afterwards the code goes to email only.
  const [needs, setNeeds] = useState<'email' | 'mobile' | null>(null)
  const [otherId, setOtherId] = useState('')
  const [otherCode, setOtherCode] = useState('')
  const [dual, setDual] = useState(false)
  const [emailHint, setEmailHint] = useState('')
  const idRef = useRef<HTMLInputElement>(null)
  const firstDigitRef = useRef<HTMLInputElement | null>(null)

  const code = digits.join('')
  const kind = kindOf(identifier)
  const close = useCallback(() => onClose('cancel'), [onClose])

  useEffect(() => { if (user) onClose('done') }, [user, onClose])
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [close])
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])
  useEffect(() => { idRef.current?.focus() }, [mode])
  useEffect(() => { if (codeSent) firstDigitRef.current?.focus() }, [codeSent])

  const run = async (fn: () => Promise<void>, onFail?: () => void) => {
    setBusy(true)
    setError('')
    try { await fn() } catch (e) { setError(authMessage(e)); onFail?.() } finally { setBusy(false) }
  }

  const sendCode = () => {
    if (kind === 'none') return setError('Enter a valid email address or 10-digit mobile number')
    if (needs && !otherId.trim()) return setError(`Enter your ${needs === 'email' ? 'email address' : 'mobile number'}`)
    return run(async () => {
      const res = await requestOtp(identifier, needs ? otherId : undefined)
      if (res.needs) { setNeeds(res.needs); return }
      setDual(res.channels?.length === 2)
      setEmailHint(res.emailHint ?? '')
      setCodeSent(true)
      setDigits(Array(6).fill(''))
      setOtherCode('')
      setCooldown(RESEND_SECONDS)
    })
  }

  const verify = (value: string) => run(
    () => confirmOtp(value, dual ? otherCode.trim() : undefined),
    () => { setDigits(Array(6).fill('')); setTimeout(() => firstDigitRef.current?.focus(), 0) },
  )

  // Submit as soon as the sixth digit lands (a first sign-in has a second code, so it waits for the button).
  useEffect(() => {
    if (mode === 'otp' && codeSent && !dual && code.length === 6 && !busy) void verify(code)
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'otp') {
      if (!codeSent) return void sendCode()
      if (code.length < 6) return setError('Enter the 6-digit code')
      if (dual && !/^\d{6}$/.test(otherCode.trim())) return setError('Enter the 6-digit code sent to your ' + (kind === 'email' ? 'mobile' : 'email'))
      return void verify(code)
    }
    if (kind === 'none') return setError('Enter a valid email address or 10-digit mobile number')
    if (!password) return setError('Enter your password')
    void run(() => loginWithPassword(identifier, password))
  }

  const resetCode = () => { setCodeSent(false); setDigits(Array(6).fill('')); setNeeds(null); setOtherId(''); setOtherCode(''); setDual(false); setError('') }
  const switchMode = (m: Mode) => { setMode(m); setPassword(''); resetCode() }

  const entering = mode === 'otp' && codeSent
  const cta = busy ? 'Please wait…' : mode === 'otp' ? (codeSent ? 'Verify & sign in' : 'Send OTP') : 'Sign in'

  return (
    <div className="slm-overlay" onMouseDown={close}>
      <style>{CSS}</style>
      <div className="slm" role="dialog" aria-modal="true" aria-labelledby="slm-title" onMouseDown={(e) => e.stopPropagation()}>
        <aside className="slm-brand" aria-hidden>
          <Brand />
          <h3 className="slm-pitch">One secure sign-in for all your policies.</h3>
          <ul className="slm-points">
            <li><span>{Icon.check}</span>Sign in with a one-time code. No password to remember.</li>
            <li><span>{Icon.check}</span>Use your email or your mobile number.</li>
            <li><span>{Icon.check}</span>One AskUs login works across all AskUs services.</li>
          </ul>
          <div className="slm-fine">Askus Insurance · We are happy to serve you</div>
        </aside>

        <section className="slm-main">
          <button type="button" className="slm-close" aria-label="Close" onClick={close}>{Icon.close}</button>
          <div className="slm-mobile-logo"><Brand /></div>
          <h2 id="slm-title" className="slm-title">{entering ? 'Enter your code' : 'Welcome back'}</h2>
          <p className="slm-sub">
            {entering
              ? <>We sent a 6-digit code to <strong>{dual ? 'your mobile and email' : emailHint || identifier.trim()}</strong>. <button type="button" className="slm-linkbtn" onClick={resetCode}>Change</button></>
              : 'Sign in or create your account to buy, renew and track your policies.'}
          </p>

          {!entering && (
            <div className="slm-seg" role="tablist" aria-label="Sign-in method">
              <button type="button" role="tab" aria-selected={mode === 'otp'} className={mode === 'otp' ? 'on' : ''} onClick={() => switchMode('otp')}>OTP</button>
              <button type="button" role="tab" aria-selected={mode === 'password'} className={mode === 'password' ? 'on' : ''} onClick={() => switchMode('password')}>Password</button>
            </div>
          )}

          <form onSubmit={submit} noValidate>
            {!entering && (
              <>
                <label className="slm-label" htmlFor="slm-id">Email or phone number</label>
                <div className="slm-field">
                  <span className="slm-ico">{kind === 'mobile' ? Icon.phone : Icon.mail}</span>
                  <input id="slm-id" ref={idRef} className="slm-input" type="text" inputMode="email" autoComplete="username"
                    placeholder="you@example.com or mobile" value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setNeeds(null); setOtherId(''); setError('') }} />
                </div>
                {mode === 'otp' && needs && (
                  <>
                    <label className="slm-label" htmlFor="slm-other">{needs === 'email' ? 'Email address' : 'Mobile number'} (verified on first sign-in)</label>
                    <div className="slm-field">
                      <span className="slm-ico">{needs === 'email' ? Icon.mail : Icon.phone}</span>
                      <input id="slm-other" className="slm-input" type={needs === 'email' ? 'email' : 'tel'} autoFocus
                        inputMode={needs === 'email' ? 'email' : 'numeric'} autoComplete={needs === 'email' ? 'email' : 'tel-national'}
                        placeholder={needs === 'email' ? 'you@example.com' : '10-digit mobile number'}
                        value={otherId} onChange={(e) => { setOtherId(e.target.value); setError('') }} />
                    </div>
                  </>
                )}
              </>
            )}

            {mode === 'password' && (
              <>
                <label className="slm-label" htmlFor="slm-pw">Password</label>
                <div className="slm-field">
                  <span className="slm-ico">{Icon.lock}</span>
                  <input id="slm-pw" className="slm-input" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                    placeholder="Enter your password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />
                  <button type="button" className="slm-eye" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((s) => !s)}>
                    {showPw ? Icon.eyeOff : Icon.eye}
                  </button>
                </div>
              </>
            )}

            {entering && (
              <>
                <OtpBoxes digits={digits} onChange={(d) => { setDigits(d); setError('') }} disabled={busy} firstRef={firstDigitRef} />
                {dual && (
                  <>
                    <label className="slm-label" htmlFor="slm-code2">Code sent to your {kind === 'email' ? 'phone (SMS)' : 'email'}</label>
                    <div className="slm-field">
                      <input id="slm-code2" className="slm-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                        placeholder="6-digit code" value={otherCode} onChange={(e) => { setOtherCode(e.target.value.replace(/\D/g, '')); setError('') }} />
                    </div>
                  </>
                )}
                <div className="slm-resend">
                  {cooldown > 0
                    ? <span>Resend code in {cooldown}s</span>
                    : <>Didn’t get it? <button type="button" className="slm-linkbtn" disabled={busy} onClick={sendCode}>Resend code</button></>}
                </div>
              </>
            )}

            <div className="slm-error" role="alert" aria-live="polite">{error}</div>
            <button type="submit" className="slm-cta" disabled={busy}>{cta}</button>
            <div className="slm-foot">New to Askus? Signing in with OTP creates your account. By continuing you agree to the Terms of Use and Privacy Policy.</div>
          </form>
        </section>
      </div>
    </div>
  )
}

// Same styles as solutions-web StaffLoginModal, with its theme variables set here and guards against legacy.css globals (svg 21px, h2/h3/p).
const CSS = `
.slm-overlay{ position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px;
  background:rgba(4,8,18,0.72); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); animation:slm-fade .18s ease-out; }
@keyframes slm-fade{ from{opacity:0} to{opacity:1} }
@keyframes slm-rise{ from{opacity:0; transform:translateY(10px) scale(.985)} to{opacity:1; transform:none} }
.slm{ --accent:#0066ff; --brand:#0066ff; --brand-hover:#0052cc; --ink:#0f1b2d; --muted:#475569; --line:#dbe5f4; --bg:#ffffff;
  width:100%; max-width:860px; max-height:calc(100vh - 40px); overflow:auto; display:grid; grid-template-columns:5fr 6fr;
  border-radius:20px; background:var(--bg); color:var(--ink); box-shadow:0 30px 80px rgba(0,0,0,.55); animation:slm-rise .22s ease-out;
  font-family:'Plus Jakarta Sans', system-ui, sans-serif; font-size:15px; line-height:1.5; text-align:left; }
.slm *{ box-sizing:border-box; }
.slm svg{ width:auto; height:auto; stroke-width:inherit; }
.slm p{ color:var(--muted); }

.slm-logo{ display:inline-flex; flex-direction:column; align-items:flex-start; gap:2px; }
.slm-logo img{ width:120px; height:auto; display:block; }
.slm-logo span{ font-size:11px; font-weight:600; color:#1e293b; letter-spacing:.01em; }

.slm-brand{ padding:40px 34px; color:var(--ink); display:flex; flex-direction:column; gap:24px; background:#eff6ff; border-right:1px solid var(--line); }
.slm-mobile-logo{ display:none; margin:0 0 24px; }
.slm .slm-pitch{ margin:6px 0 0; font-size:25px; line-height:1.25; font-weight:700; letter-spacing:-.01em; color:var(--ink); }
.slm-points{ list-style:none; margin:8px 0 0; padding:0; display:flex; flex-direction:column; gap:14px; font-size:14px; line-height:1.5; color:var(--muted); }
.slm-points li{ display:flex; gap:11px; align-items:flex-start; }
.slm-points li span{ flex:none; width:24px; height:24px; border-radius:50%; background:#dbeafe; color:var(--accent); display:grid; place-items:center; margin-top:-1px; }
.slm-fine{ margin-top:auto; padding-top:18px; font-size:11.5px; color:var(--muted); letter-spacing:.02em; }

.slm-main{ position:relative; padding:40px 40px 30px; }
.slm .slm-close{ position:absolute; top:14px; right:14px; width:36px; height:36px; border-radius:10px; border:none; background:var(--brand); color:#fff; cursor:pointer; display:grid; place-items:center; }
.slm .slm-close:hover{ background:var(--brand-hover); }
.slm .slm-title{ margin:0 0 6px; font-size:26px; line-height:1.3; font-weight:600; letter-spacing:-.015em; color:var(--ink); }
.slm .slm-sub{ margin:0 0 22px; font-size:14px; line-height:1.55; color:var(--muted); }
.slm-sub strong{ color:var(--ink); word-break:break-all; }
.slm .slm-linkbtn{ background:var(--brand); border:none; border-radius:6px; padding:4px 8px; color:#fff; font:inherit; font-weight:500; cursor:pointer; }
.slm .slm-linkbtn:hover:not(:disabled){ background:var(--brand-hover); } .slm .slm-linkbtn:disabled{ opacity:.5; cursor:default; }

.slm-seg{ display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px; margin-bottom:20px; border-radius:12px; background:#eff6ff; }
.slm .slm-seg button{ border:1.5px solid transparent; background:transparent; padding:8px 6px; border-radius:9px; font:inherit; font-size:14px; font-weight:500; color:#475569; cursor:pointer; transition:background .15s, color .15s, box-shadow .15s; }
.slm .slm-seg button:hover:not(.on){ background:#dbeafe; color:#1d4ed8; }
.slm .slm-seg button.on{ background:#fff; border-color:#bfdbfe; color:#1d4ed8; font-weight:600; box-shadow:0 1px 3px rgba(29,78,216,.15); }

.slm-label{ display:block; margin:0 0 7px; font-size:13px; font-weight:600; color:#2a3a52; }
.slm-field{ position:relative; display:flex; align-items:center; margin-bottom:16px; border:1.5px solid var(--line); border-radius:12px; background:#fff; transition:border-color .15s, box-shadow .15s; }
.slm-field:focus-within{ border-color:#1d4ed8; box-shadow:0 0 0 4px rgba(29,78,216,.16); }
.slm-ico{ flex:none; padding:0 4px 0 14px; color:#475569; display:grid; place-items:center; }
.slm-input{ flex:1; min-width:0; border:none; outline:none; background:transparent; padding:14px 12px; font:inherit; font-size:15px; color:var(--ink); }
.slm-input:focus-visible{ outline:none; }
.slm-input::placeholder{ color:#64748b; }
.slm-input:-webkit-autofill,.slm-input:-webkit-autofill:hover,.slm-input:-webkit-autofill:focus{ -webkit-box-shadow:0 0 0 1000px #fff inset; -webkit-text-fill-color:var(--ink); transition:background-color 9999s ease-out 0s; }
.slm .slm-eye{ flex:none; width:44px; height:44px; margin-right:2px; border:none; background:var(--brand); color:#fff; cursor:pointer; display:grid; place-items:center; border-radius:10px; }
.slm .slm-eye:hover{ background:var(--brand-hover); }

.slm-otp{ display:grid; grid-template-columns:repeat(6,1fr); gap:10px; margin:2px 0 14px; }
.slm-otp-box{ width:100%; aspect-ratio:1/1.12; text-align:center; font:inherit; font-size:24px; font-weight:700; color:var(--ink); border:1.5px solid var(--line); border-radius:12px; background:#fff; outline:none; transition:border-color .15s, box-shadow .15s; caret-color:#1d4ed8; }
.slm-otp-box:focus{ border-color:#1d4ed8; box-shadow:0 0 0 4px rgba(29,78,216,.16); }
.slm-otp-box:disabled{ background:#f3f6fa; }
.slm-resend{ font-size:13px; color:var(--muted); margin-bottom:6px; }

.slm-error{ min-height:22px; margin:2px 0 8px; font-size:13px; font-weight:600; color:#c0392b; }
.slm .slm-cta{ width:100%; border:1px solid var(--brand); border-radius:12px; padding:15px 18px; font:inherit; font-size:15.5px; font-weight:500; letter-spacing:.01em; color:#fff; cursor:pointer; background:var(--brand); transition:background .12s; }
.slm .slm-cta:hover:not(:disabled){ background:var(--brand-hover); }
.slm .slm-cta:active:not(:disabled){ transform:translateY(1px); }
.slm .slm-cta:disabled{ opacity:.65; cursor:default; }
.slm-foot{ margin-top:16px; text-align:center; font-size:12px; line-height:1.55; color:var(--muted); }

@media (max-width:760px){
  .slm{ grid-template-columns:1fr; max-width:440px; }
  .slm-brand{ display:none; }
  .slm-mobile-logo{ display:block; }
  .slm-main{ padding:34px 22px 24px; }
  .slm .slm-title{ font-size:23px; }
  .slm-otp{ gap:7px; }
}
`
