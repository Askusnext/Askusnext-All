import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { api, USE_REAL_API } from '../api/mockApi';
import { useAppDispatch, loginSuccess } from '../store';
import type { AuthResponse } from '../types';

type Mode = 'otp' | 'password';

// Staff sign-in used by both the landing page and the site chrome modals.
// Live (API) mode: one-time code to mobile/email, or mobile/email + password.
// Demo mode (no API configured): the original username + password form only.
export default function StaffLoginForm({
  prefix,
  onDone,
  footer,
}: {
  /** Class prefix of the host modal ('lp' or 'sc'), so the existing modal styles apply. */
  prefix: 'lp' | 'sc';
  onDone: () => void;
  footer: ReactNode;
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(USE_REAL_API ? 'otp' : 'password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  // Mobile numbers are sent without spaces or dashes; emails are left alone.
  const cleanId = () => {
    const v = identifier.trim();
    return v.includes('@') ? v : v.replace(/[\s-]/g, '');
  };

  const finish = (res: AuthResponse) => {
    dispatch(loginSuccess({ token: res.token, user: res.user }));
    message.success(`Welcome, ${res.user.name}!`);
    onDone();
    navigate(res.user.role === 'Agent' ? '/timesheet' : '/dashboard', { replace: true });
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setCode('');
    setCodeSent(false);
    setPassword('');
  };

  const sendCode = () =>
    run(async () => {
      if (!cleanId()) return void message.error('Enter your mobile number or email');
      await api.sendOTP(cleanId());
      setCodeSent(true);
      message.success('Verification code sent');
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'otp' && !codeSent) return void sendCode();
    return run(async () => {
      if (!cleanId()) return void message.error('Enter your mobile number or email');
      if (mode === 'otp') {
        if (!/^\d{6}$/.test(code.trim())) return void message.error('Enter the 6-digit code');
        finish(await api.verifyOTP(cleanId(), code.trim(), ''));
      } else {
        if (!password) return void message.error('Enter your password');
        finish(await api.loginWithPassword(cleanId(), password));
      }
    });
  };

  const idLabel = USE_REAL_API ? 'Mobile number or email' : 'Username';
  const cls = (n: string) => `${prefix}-modal-${n}`;

  return (
    <>
      <style>{CSS}</style>
      {USE_REAL_API && (
        <div className="stf-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'otp'} className={mode === 'otp' ? 'stf-tab stf-on' : 'stf-tab'} onClick={() => switchMode('otp')}>
            One-time code
          </button>
          <button type="button" role="tab" aria-selected={mode === 'password'} className={mode === 'password' ? 'stf-tab stf-on' : 'stf-tab'} onClick={() => switchMode('password')}>
            Password
          </button>
        </div>
      )}
      <form onSubmit={submit}>
        <label className={cls('label')} htmlFor={`${prefix}-identifier`}>{idLabel}</label>
        <input
          id={`${prefix}-identifier`}
          className={cls('input')}
          type="text"
          inputMode={USE_REAL_API ? 'email' : 'text'}
          placeholder={USE_REAL_API ? '98765 43210 or name@askussolutions.in' : 'Enter username'}
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={mode === 'otp' && codeSent}
          autoFocus
        />

        {mode === 'password' && (
          <>
            <label className={cls('label')} htmlFor={`${prefix}-password`}>Password</label>
            <input
              id={`${prefix}-password`}
              className={cls('input')}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        )}

        {mode === 'otp' && codeSent && (
          <>
            <label className={cls('label')} htmlFor={`${prefix}-code`}>6-digit code</label>
            <input
              id={`${prefix}-code`}
              className={cls('input')}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            <div className="stf-links">
              <button type="button" className="stf-link" disabled={busy} onClick={sendCode}>Resend code</button>
              <button type="button" className="stf-link" disabled={busy} onClick={() => { setCodeSent(false); setCode(''); }}>Change number</button>
            </div>
          </>
        )}

        <div className={cls('row')}>{footer}</div>
        <button type="submit" className={cls('submit')} disabled={busy}>
          {busy ? 'Please wait…' : mode === 'otp' && !codeSent ? 'Send code' : 'Sign In'}
        </button>
      </form>
    </>
  );
}

const CSS = `
.stf-tabs{ display:flex; gap:0; margin:0 0 18px; border:1px solid rgba(238,246,255,0.18); }
.stf-tab{ flex:1; background:transparent; border:none; color:rgba(238,246,255,0.65); font-family:var(--mono, monospace); font-size:11px; letter-spacing:0.14em; text-transform:uppercase; padding:10px 8px; cursor:pointer; }
.stf-tab.stf-on{ background:var(--cyan, #5ad4ff); color:#04101c; font-weight:700; }
.stf-links{ display:flex; justify-content:space-between; margin:-6px 0 16px; }
.stf-link{ background:none; border:none; padding:0; color:rgba(238,246,255,0.7); font-size:12.5px; cursor:pointer; text-decoration:underline; }
.stf-link:hover{ color:var(--cyan, #5ad4ff); }
.stf-link:disabled{ opacity:0.5; cursor:default; }
`;
