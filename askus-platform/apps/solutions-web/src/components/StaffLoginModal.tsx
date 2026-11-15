import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { api, USE_REAL_API } from '../api/mockApi';
import { NotStaffError, accessRequestApi } from '../api/api';
import type { Me } from '../api/session';
import { useAppDispatch, loginSuccess } from '../store';
import type { AuthResponse } from '../types';

type Mode = 'otp' | 'password';

const RESEND_SECONDS = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE = /^\+?\d{10,15}$/;

// What the person typed: an email, a mobile number, or not enough yet to tell.
function classify(raw: string): 'email' | 'mobile' | 'none' {
  const v = raw.trim();
  if (EMAIL.test(v)) return 'email';
  if (MOBILE.test(v.replace(/[\s-]/g, ''))) return 'mobile';
  return 'none';
}

const Icon = {
  mail: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3l18 18M10.6 6a9.8 9.8 0 0 1 1.4-.1C18.5 5.9 22 12 22 12a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s3.5 6.1 10 6.1a9.7 9.7 0 0 0 4-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 16V5m0 0-4 4m4-4 4 4" /><path d="M4.5 15.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
};

function OtpBoxes({ digits, onChange, disabled, firstRef }: {
  digits: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  firstRef: React.RefObject<HTMLInputElement>;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => refs.current[Math.max(0, Math.min(5, i))]?.focus();

  const fill = (start: number, raw: string) => {
    const incoming = raw.replace(/\D/g, '').slice(0, 6 - start).split('');
    if (!incoming.length) return;
    const next = [...digits];
    incoming.forEach((d, k) => { next[start + k] = d; });
    onChange(next);
    focus(start + incoming.length);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits];
      next[i - 1] = '';
      onChange(next);
      focus(i - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') focus(i - 1);
    else if (e.key === 'ArrowRight') focus(i + 1);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fill(0, e.clipboardData.getData('text'));
  };

  return (
    <div className="slm-otp" role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; if (i === 0) (firstRef as { current: HTMLInputElement | null }).current = el; }}
          className="slm-otp-box"
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={6}
          aria-label={`Digit ${i + 1}`}
          value={d}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (!v) { const next = [...digits]; next[i] = ''; onChange(next); return; }
            fill(i, v);
          }}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}


const AADHAAR_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const AADHAAR_MAX = 5 * 1024 * 1024;

// Shown when the one-time code was valid but the number/email has no staff role yet.
// They tell us who they are; an Admin reviews it and picks their role.
function AccessRequestPanel({ token, me, signedInWith, onDone }: { token: string; me: Me; signedInWith: string; onDone: () => void }) {
  const looksGeneric = (n: string) => !n || n === 'User' || n === me.email || n === me.mobile;
  const [submitted, setSubmitted] = useState(me.approvalStatus === 'PENDING');
  const [name, setName] = useState(looksGeneric(me.name) ? '' : me.name);
  const [email, setEmail] = useState(me.email ?? '');
  const [mobile, setMobile] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentAadhaar, setSentAadhaar] = useState(false);

  const needsEmail = !me.email;
  const needsMobile = !me.mobile;

  const pick = (f: File | undefined) => {
    setError('');
    if (!f) return setFile(null);
    if (!AADHAAR_TYPES.includes(f.type)) return setError('Aadhaar must be a JPG, PNG or PDF file');
    if (f.size > AADHAAR_MAX) return setError('Aadhaar file must be 5 MB or smaller');
    setFile(f);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Enter your full name');
    if (needsEmail && !EMAIL.test(email.trim())) return setError('Enter a valid email address');
    if (needsMobile && mobile && !/^[6-9]\d{9}$/.test(mobile)) return setError('Enter a valid 10-digit mobile number');
    setBusy(true);
    setError('');
    try {
      const aadhaarKey = file ? await accessRequestApi.uploadAadhaar(token, file) : undefined;
      await accessRequestApi.submit(token, {
        name: name.trim(),
        email: needsEmail ? email.trim() : undefined,
        mobile: needsMobile && mobile ? mobile : undefined,
        aadhaarKey,
      });
      setSentAadhaar(!!file);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="slm-done">
        <div className="slm-done-badge" aria-hidden>{Icon.check}</div>
        <h2 id="slm-title" className="slm-title">Request received</h2>
        <span className="slm-status">Pending admin review</span>
        <blockquote className="slm-quote">
          “Your request is in process. Once an admin approves you, you will be able to log in.”
        </blockquote>
        <dl className="slm-summary">
          <div><dt>Name</dt><dd>{name.trim() || me.name}</dd></div>
          <div><dt>Signed in as</dt><dd>{signedInWith}</dd></div>
          {(email || me.email) && <div><dt>Email</dt><dd>{me.email ?? email}</dd></div>}
          <div><dt>Aadhaar</dt><dd>{sentAadhaar || me.approvalStatus === 'PENDING' ? 'Submitted' : 'Not provided'}</dd></div>
        </dl>
        <button type="button" className="slm-cta" onClick={onDone}>Done</button>
      </div>
    );
  }

  return (
    <>
      <h2 id="slm-title" className="slm-title">Request staff access</h2>
      <p className="slm-sub">
        We could not find a staff account for <strong>{signedInWith}</strong>. Share a few details and an Admin will review your request.
      </p>
      {me.approvalStatus === 'REJECTED' && (
        <div className="slm-note">Your earlier request was not approved. You can update your details and send it again.</div>
      )}
      <form onSubmit={submit} noValidate>
        <label className="slm-label" htmlFor="slm-name">Full name</label>
        <div className="slm-field">
          <span className="slm-ico">{Icon.user}</span>
          <input id="slm-name" className="slm-input" type="text" autoComplete="name" placeholder="As on your ID" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} />
        </div>

        {needsEmail && (
          <>
            <label className="slm-label" htmlFor="slm-email">Email address</label>
            <div className="slm-field">
              <span className="slm-ico">{Icon.mail}</span>
              <input id="slm-email" className="slm-input" type="email" autoComplete="email" placeholder="name@askussolutions.in" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
            </div>
          </>
        )}

        {!needsEmail && needsMobile && (
          <>
            <label className="slm-label" htmlFor="slm-mobile">Mobile number <span className="slm-opt">optional</span></label>
            <div className="slm-field">
              <span className="slm-ico">{Icon.phone}</span>
              <input id="slm-mobile" className="slm-input" type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" placeholder="10-digit number" value={mobile} onChange={(e) => { setMobile(e.target.value.replace(/\D/g, '')); setError(''); }} />
            </div>
          </>
        )}

        <span className="slm-label">Aadhaar image <span className="slm-opt">optional</span></span>
        <label className={`slm-drop${file ? ' has' : ''}`}>
          <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => pick(e.target.files?.[0])} />
          <span className="slm-drop-ico">{Icon.upload}</span>
          <span className="slm-drop-text">
            {file ? <><strong>{file.name}</strong><em>{(file.size / 1024).toFixed(0)} KB · click to replace</em></> : <><strong>Upload a photo or PDF</strong><em>JPG, PNG or PDF, up to 5 MB. Stored privately.</em></>}
          </span>
        </label>

        <div className="slm-error" role="alert" aria-live="polite">{error}</div>
        <button type="submit" className="slm-cta" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
      </form>
    </>
  );
}

// Staff sign-in dialog shared by the landing page and the site chrome.
// Live (API) mode: one-time code to an email or mobile number, or a password.
// Demo mode (no API configured): the original username + password form.
export default function StaffLoginModal({ open, onClose, contact }: { open: boolean; onClose: () => void; contact: ReactNode }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(USE_REAL_API ? 'otp' : 'password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [access, setAccess] = useState<{ token: string; me: Me } | null>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const firstDigitRef = useRef<HTMLInputElement>(null);

  const code = digits.join('');
  const kind = classify(identifier);

  const cleanId = () => {
    const v = identifier.trim();
    return v.includes('@') ? v : v.replace(/[\s-]/g, '');
  };

  const reset = useCallback(() => {
    setIdentifier(''); setPassword(''); setShowPw(false); setDigits(Array(6).fill(''));
    setCodeSent(false); setCooldown(0); setBusy(false); setError(''); setAccess(null);
    setMode(USE_REAL_API ? 'otp' : 'password');
  }, []);

  useEffect(() => { if (!open) reset(); }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => { if (open) idRef.current?.focus(); }, [open, mode]);
  useEffect(() => { if (codeSent) firstDigitRef.current?.focus(); }, [codeSent]);

  const finish = (res: AuthResponse) => {
    dispatch(loginSuccess({ token: res.token, user: res.user }));
    message.success(`Welcome, ${res.user.name}!`);
    onClose();
    navigate(res.user.role === 'Agent' ? '/timesheet' : '/dashboard', { replace: true });
  };

  const run = async (fn: () => Promise<void>, onFail?: () => void) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err: unknown) {
      if (err instanceof NotStaffError) { setAccess({ token: err.token, me: err.me }); return; }
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      onFail?.();
    } finally {
      setBusy(false);
    }
  };

  const validId = () => {
    if (!USE_REAL_API) return !!identifier.trim();
    return kind !== 'none';
  };

  const sendCode = () => {
    if (!validId()) { setError('Enter a valid email address or 10-digit phone number'); return; }
    return run(async () => {
      await api.sendOTP(cleanId());
      setCodeSent(true);
      setDigits(Array(6).fill(''));
      setCooldown(RESEND_SECONDS);
    });
  };

  const verify = useCallback((value: string) => run(
    async () => { finish(await api.verifyOTP(cleanId(), value, '')); },
    () => { setDigits(Array(6).fill('')); setTimeout(() => firstDigitRef.current?.focus(), 0); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [identifier]);

  // Submit as soon as the sixth digit lands.
  useEffect(() => {
    if (mode === 'otp' && codeSent && code.length === 6 && !busy) void verify(code);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'otp') {
      if (!codeSent) return void sendCode();
      if (code.length < 6) return void setError('Enter the 6-digit code');
      return void verify(code);
    }
    if (!validId()) return void setError(USE_REAL_API ? 'Enter a valid email address or 10-digit phone number' : 'Enter your username');
    if (!password) return void setError('Enter your password');
    return void run(async () => { finish(await api.loginWithPassword(cleanId(), password)); });
  };

  const switchMode = (m: Mode) => { setMode(m); setError(''); setCodeSent(false); setDigits(Array(6).fill('')); setPassword(''); };

  if (!open) return null;

  const idLabel = USE_REAL_API ? 'Email or phone number' : 'Username';
  const cta = busy ? 'Please wait…' : mode === 'otp' ? (codeSent ? 'Verify & sign in' : 'Send OTP') : 'Sign in';

  return (
    <div className="slm-overlay" onMouseDown={onClose}>
      <style>{CSS}</style>
      <div className="slm" role="dialog" aria-modal="true" aria-labelledby="slm-title" onMouseDown={(e) => e.stopPropagation()}>
        <aside className="slm-brand" aria-hidden>
          <img className="slm-logo-img" src="/askus-wordmark.png" alt="Askus" />
          <div className="slm-wordmark">SOLUTIONS</div>
          <h3 className="slm-pitch">One secure sign-in for your whole operation.</h3>
          <ul className="slm-points">
            <li><span>{Icon.check}</span>Sign in with a one-time code. No password to remember.</li>
            <li><span>{Icon.check}</span>Use your work email or your phone number.</li>
            <li><span>{Icon.check}</span>Stay signed in for 12 hours.</li>
          </ul>
          <div className="slm-fine">Restricted access · AskusNext Global Solutions Pvt Ltd</div>
        </aside>

        <section className="slm-main">
          <button type="button" className="slm-close" aria-label="Close" onClick={onClose}>{Icon.close}</button>
          <img className="slm-mobile-logo" src="/askus-wordmark.png" alt="Askus" />
          {access ? (
            <AccessRequestPanel token={access.token} me={access.me} signedInWith={cleanId()} onDone={onClose} />
          ) : (
          <>
          <h2 id="slm-title" className="slm-title">{mode === 'otp' && codeSent ? 'Enter your code' : 'Welcome back'}</h2>
          <p className="slm-sub">
            {mode === 'otp' && codeSent
              ? <>We sent a 6-digit code to <strong>{cleanId()}</strong>. <button type="button" className="slm-linkbtn" onClick={() => { setCodeSent(false); setDigits(Array(6).fill('')); setError(''); }}>Change</button></>
              : 'Access is provisioned by an Admin or Super Admin.'}
          </p>

          {USE_REAL_API && !(mode === 'otp' && codeSent) && (
            <div className="slm-seg" role="tablist" aria-label="Sign-in method">
              <button type="button" role="tab" aria-selected={mode === 'otp'} className={mode === 'otp' ? 'on' : ''} onClick={() => switchMode('otp')}>OTP</button>
              <button type="button" role="tab" aria-selected={mode === 'password'} className={mode === 'password' ? 'on' : ''} onClick={() => switchMode('password')}>Password</button>
            </div>
          )}

          <form onSubmit={submit} noValidate>
            {!(mode === 'otp' && codeSent) && (
              <>
                <label className="slm-label" htmlFor="slm-id">{idLabel}</label>
                <div className="slm-field">
                  <span className="slm-ico">{Icon.mail}</span>
                  <input
                    id="slm-id" ref={idRef} className="slm-input" type="text"
                    inputMode={USE_REAL_API ? 'email' : 'text'} autoComplete="username"
                    placeholder={USE_REAL_API ? 'name@askussolutions.in' : 'Enter username'}
                    value={identifier} onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                  />
                  {USE_REAL_API && kind !== 'none' && <span className="slm-chip">{kind === 'email' ? 'Email' : 'Phone · +91'}</span>}
                </div>
              </>
            )}

            {mode === 'password' && (
              <>
                <label className="slm-label" htmlFor="slm-pw">Password</label>
                <div className="slm-field">
                  <span className="slm-ico">{Icon.lock}</span>
                  <input
                    id="slm-pw" className="slm-input" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                    placeholder="Enter your password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  />
                  <button type="button" className="slm-eye" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((s) => !s)}>
                    {showPw ? Icon.eyeOff : Icon.eye}
                  </button>
                </div>
              </>
            )}

            {mode === 'otp' && codeSent && (
              <>
                <OtpBoxes digits={digits} onChange={(d) => { setDigits(d); setError(''); }} disabled={busy} firstRef={firstDigitRef} />
                <div className="slm-resend">
                  {cooldown > 0
                    ? <span>Resend code in {cooldown}s</span>
                    : <>Didn’t get it? <button type="button" className="slm-linkbtn" disabled={busy} onClick={sendCode}>Resend code</button></>}
                </div>
              </>
            )}

            <div className="slm-error" role="alert" aria-live="polite">{error}</div>

            <button type="submit" className="slm-cta" disabled={busy}>{cta}</button>
            <div className="slm-foot">{contact}</div>
          </form>
          </>
          )}
        </section>
      </div>
    </div>
  );
}

const CSS = `
.slm-overlay{ position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px;
  background:rgba(4,8,18,0.72); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); animation:slm-fade .18s ease-out; }
@keyframes slm-fade{ from{opacity:0} to{opacity:1} }
@keyframes slm-rise{ from{opacity:0; transform:translateY(10px) scale(.985)} to{opacity:1; transform:none} }
.slm{ --brand:#0a1a33; --accent:#5ad4ff; --ink:#0f1b2d; --muted:#5b6b82; --line:#d9e2ee; --bg:#ffffff;
  width:100%; max-width:860px; max-height:calc(100vh - 40px); overflow:auto; display:grid; grid-template-columns:5fr 6fr;
  border-radius:20px; background:var(--bg); color:var(--ink); box-shadow:0 30px 80px rgba(0,0,0,.55); animation:slm-rise .22s ease-out;
  font-family:'Segoe UI',system-ui,-apple-system,sans-serif; }
.slm *{ box-sizing:border-box; }

.slm-brand{ position:relative; padding:40px 34px; color:#eaf4ff; display:flex; flex-direction:column; gap:18px;
  background:radial-gradient(120% 90% at 0% 0%, #12335f 0%, var(--brand) 55%, #060f20 100%); overflow:hidden; }
.slm-brand::before{ content:''; position:absolute; inset:0; opacity:.5; pointer-events:none;
  background-image:linear-gradient(rgba(90,212,255,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(90,212,255,.10) 1px, transparent 1px);
  background-size:34px 34px; mask-image:radial-gradient(80% 70% at 30% 20%, #000, transparent); -webkit-mask-image:radial-gradient(80% 70% at 30% 20%, #000, transparent); }
.slm-brand > *{ position:relative; }
.slm-logo{ width:44px; height:44px; }
.slm-logo-img{ height:46px; width:auto; align-self:flex-start; }
.slm-mobile-logo{ display:none; height:34px; width:auto; margin:0 0 14px; }
.slm-wordmark{ font-family:'SFMono-Regular',Consolas,monospace; font-weight:700; letter-spacing:.14em; font-size:13px; color:var(--accent); }
.slm-pitch{ margin:6px 0 0; font-size:25px; line-height:1.25; font-weight:700; letter-spacing:-.01em; }
.slm-points{ list-style:none; margin:8px 0 0; padding:0; display:flex; flex-direction:column; gap:14px; font-size:14px; line-height:1.5; color:#c9daf0; }
.slm-points li{ display:flex; gap:11px; align-items:flex-start; }
.slm-points li span{ flex:none; width:24px; height:24px; border-radius:50%; background:rgba(90,212,255,.16); color:var(--accent); display:grid; place-items:center; margin-top:-1px; }
.slm-fine{ margin-top:auto; padding-top:18px; font-size:11.5px; color:#7f94b2; letter-spacing:.02em; }

.slm-main{ position:relative; padding:40px 40px 30px; }
.slm-close{ position:absolute; top:14px; right:14px; width:36px; height:36px; border-radius:10px; border:none; background:transparent; color:var(--muted); cursor:pointer; display:grid; place-items:center; }
.slm-close:hover{ background:#eef3f9; color:var(--ink); }
.slm-title{ margin:0 0 6px; font-size:26px; font-weight:700; letter-spacing:-.015em; }
.slm-sub{ margin:0 0 22px; font-size:14px; line-height:1.55; color:var(--muted); }
.slm-sub strong{ color:var(--ink); word-break:break-all; }
.slm-linkbtn{ background:none; border:none; padding:0; color:#0a6fa8; font:inherit; font-weight:600; cursor:pointer; text-decoration:underline; text-underline-offset:2px; }
.slm-linkbtn:hover{ color:#07517c; } .slm-linkbtn:disabled{ opacity:.5; cursor:default; }

.slm-seg{ display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px; margin-bottom:20px; border-radius:12px; background:#eef3f9; }
.slm-seg button{ border:none; background:transparent; padding:10px 8px; border-radius:9px; font:inherit; font-size:14px; font-weight:600; color:var(--muted); cursor:pointer; transition:background .15s, color .15s, box-shadow .15s; }
.slm-seg button.on{ background:#fff; color:var(--ink); box-shadow:0 1px 4px rgba(15,27,45,.14); }

.slm-label{ display:block; margin:0 0 7px; font-size:13px; font-weight:600; color:#2a3a52; }
.slm-field{ position:relative; display:flex; align-items:center; margin-bottom:16px; border:1.5px solid var(--line); border-radius:12px; background:#fff; transition:border-color .15s, box-shadow .15s; }
.slm-field:focus-within{ border-color:#1d9bd6; box-shadow:0 0 0 4px rgba(29,155,214,.16); }
.slm-ico{ flex:none; padding:0 4px 0 14px; color:#7b8aa0; display:grid; place-items:center; }
.slm-input{ flex:1; min-width:0; border:none; outline:none; background:transparent; padding:14px 12px; font:inherit; font-size:15px; color:var(--ink); }
.slm-input::placeholder{ color:#9aa8bb; }
.slm-chip{ flex:none; margin-right:10px; padding:3px 9px; border-radius:999px; background:#e4f4fc; color:#0a6fa8; font-size:11.5px; font-weight:700; white-space:nowrap; }
.slm-eye{ flex:none; width:44px; height:44px; border:none; background:transparent; color:#7b8aa0; cursor:pointer; display:grid; place-items:center; border-radius:10px; }
.slm-eye:hover{ color:var(--ink); }

.slm-otp{ display:grid; grid-template-columns:repeat(6,1fr); gap:10px; margin:2px 0 14px; }
.slm-otp-box{ width:100%; aspect-ratio:1/1.12; text-align:center; font:inherit; font-size:24px; font-weight:700; color:var(--ink); border:1.5px solid var(--line); border-radius:12px; background:#fff; outline:none; transition:border-color .15s, box-shadow .15s; caret-color:#1d9bd6; }
.slm-otp-box:focus{ border-color:#1d9bd6; box-shadow:0 0 0 4px rgba(29,155,214,.16); }
.slm-otp-box:disabled{ background:#f3f6fa; }
.slm-resend{ font-size:13px; color:var(--muted); margin-bottom:6px; }

.slm-error{ min-height:22px; margin:2px 0 8px; font-size:13px; font-weight:600; color:#c0392b; }
.slm-cta{ width:100%; border:none; border-radius:12px; padding:15px 18px; font:inherit; font-size:15.5px; font-weight:700; letter-spacing:.01em; color:#04223a; cursor:pointer;
  background:linear-gradient(180deg,#6fdcff,#3cc3f2); box-shadow:0 6px 18px rgba(60,195,242,.38); transition:transform .12s, box-shadow .12s, filter .12s; }
.slm-cta:hover:not(:disabled){ filter:brightness(1.04); box-shadow:0 8px 22px rgba(60,195,242,.5); }
.slm-cta:active:not(:disabled){ transform:translateY(1px); }
.slm-cta:disabled{ opacity:.65; cursor:default; box-shadow:none; }
.slm-foot{ margin-top:16px; text-align:center; font-size:13px; }
.slm-foot a{ color:#0a6fa8; font-weight:600; text-decoration:none; } .slm-foot a:hover{ text-decoration:underline; }

.slm-opt{ margin-left:6px; font-size:11.5px; font-weight:600; color:#7b8aa0; }
.slm-note{ margin:0 0 16px; padding:11px 14px; border-radius:10px; background:#fff6e5; color:#8a5a00; font-size:13px; line-height:1.5; }
.slm-drop{ display:flex; align-items:center; gap:14px; margin-bottom:16px; padding:14px 16px; border:1.5px dashed #b9c8da; border-radius:12px; background:#f8fbfe; cursor:pointer; transition:border-color .15s, background .15s; }
.slm-drop:hover, .slm-drop:focus-within{ border-color:#1d9bd6; background:#f0f9fe; }
.slm-drop.has{ border-style:solid; border-color:#1d9bd6; background:#f0f9fe; }
.slm-drop input{ position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
.slm-drop-ico{ flex:none; width:40px; height:40px; border-radius:10px; background:#e4f4fc; color:#0a6fa8; display:grid; place-items:center; }
.slm-drop-text{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.slm-drop-text strong{ font-size:14px; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.slm-drop-text em{ font-style:normal; font-size:12.5px; color:var(--muted); }
.slm-done{ display:flex; flex-direction:column; align-items:flex-start; }
.slm-done-badge{ width:46px; height:46px; margin-bottom:14px; border-radius:50%; background:#e3f7ec; color:#17995a; display:grid; place-items:center; }
.slm-done-badge svg{ width:22px; height:22px; }
.slm-status{ display:inline-block; margin:2px 0 18px; padding:4px 11px; border-radius:999px; background:#fff3d6; color:#8a5a00; font-size:12px; font-weight:700; letter-spacing:.02em; }
.slm-quote{ margin:0 0 20px; padding:14px 18px; border-left:4px solid #3cc3f2; border-radius:0 12px 12px 0; background:#f0f9fe; color:#18314d; font-size:15.5px; line-height:1.6; font-weight:500; }
.slm-summary{ width:100%; margin:0 0 22px; padding:4px 16px; border:1px solid var(--line); border-radius:12px; }
.slm-summary div{ display:flex; justify-content:space-between; gap:16px; padding:10px 0; font-size:13.5px; }
.slm-summary div + div{ border-top:1px solid #edf1f6; }
.slm-summary dt{ color:var(--muted); } .slm-summary dd{ margin:0; font-weight:600; text-align:right; word-break:break-all; }

@media (max-width:760px){
  .slm{ grid-template-columns:1fr; max-width:440px; }
  .slm-brand{ display:none; }
  .slm-mobile-logo{ display:block; }
  .slm-main{ padding:34px 22px 24px; }
  .slm-title{ font-size:23px; }
  .slm-otp{ gap:7px; } .slm-otp-box{ font-size:21px; }
}
@media (prefers-reduced-motion:reduce){ .slm-overlay,.slm{ animation:none; } }
`;
