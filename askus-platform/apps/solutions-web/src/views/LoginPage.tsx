import { useState } from 'react';
import { message, Spin } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/mockApi';
import { useAppDispatch, loginSuccess } from '../store';
import Brand from '../components/Brand';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [needs, setNeeds] = useState<'email' | 'mobile' | null>(null);
  const [otherId, setOtherId] = useState('');
  const [otherCode, setOtherCode] = useState('');
  const [dual, setDual] = useState(false);
  const [emailHint, setEmailHint] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const resetFlow = () => { setCodeSent(false); setCode(''); setOtherCode(''); setNeeds(null); setOtherId(''); setDual(false); };

  const handleSendCode = async () => {
    if (!identifier.trim()) {
      message.error('Enter your mobile number or email');
      return;
    }
    if (needs && !otherId.trim()) {
      message.error(`Enter your ${needs === 'email' ? 'email address' : 'mobile number'}`);
      return;
    }
    setLoading(true);
    try {
      const res = await api.sendOTP(identifier.trim(), needs ? otherId.trim() : undefined);
      if (res.needs) {
        setNeeds(res.needs);
        message.info(`First sign-in: add your ${res.needs === 'email' ? 'email address' : 'mobile number'} to verify`);
        return;
      }
      if (res.status) {
        message.error(res.status === 'PENDING' ? 'Your account is awaiting approval' : 'Your access request was declined');
        return;
      }
      setSessionId(res.sessionId);
      setDual(res.channels?.length === 2);
      setEmailHint(res.emailHint ?? '');
      setCodeSent(true);
      message.success(res.channels?.length === 2 ? 'Codes sent to your mobile and email' : 'Verification code sent to your email');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Could not send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code.trim()) || (dual && !/^\d{6}$/.test(otherCode.trim()))) {
      message.error(dual ? 'Enter both 6-digit codes' : 'Enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const other = dual ? { identifier: otherId.trim() || undefined, code: otherCode.trim() } : undefined;
      const res = await api.verifyOTP(identifier.trim(), code.trim(), sessionId, other);
      dispatch(loginSuccess({ token: res.token, user: res.user }));
      message.success(`Welcome, ${res.user.name}!`);
      navigate(res.user.role === 'Agent' ? '/timesheet' : '/dashboard', { replace: true });
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link to="/home" className="auth-brand" aria-label="Askus Next Global Solutions Private Limited home"><Brand /></Link>
        <Link to="/home" className="auth-back">← Back to home</Link>
        <h1>Welcome back.</h1>
        <p className="auth-intro">Sign in to your team workspace with a mobile or email verification code.</p>
        <div className="auth-form">
          <label htmlFor="staff-identifier">Mobile number or email</label>
          <input id="staff-identifier" type="text" placeholder="Enter your mobile or email" value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !codeSent && handleSendCode()}
            readOnly={codeSent || !!needs} autoFocus />
          {needs && !codeSent && (
            <>
              <label htmlFor="staff-other">{needs === 'email' ? 'Email address' : 'Mobile number'} (to verify on first sign-in)</label>
              <input id="staff-other" type="text" placeholder={needs === 'email' ? 'you@example.com' : '10-digit mobile number'}
                value={otherId} onChange={e => setOtherId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendCode()} autoFocus />
            </>
          )}
          {codeSent && (
            <>
              <label htmlFor="staff-code">
                {dual ? `Code sent to ${identifier.includes('@') ? 'your email' : 'your mobile'}` : `Verification code${emailHint ? ` (sent to ${emailHint})` : ''}`}
              </label>
              <input id="staff-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code"
                value={code} onChange={e => setCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerify()} autoFocus />
              {dual && (
                <>
                  <label htmlFor="staff-other-code">Code sent to {identifier.includes('@') ? 'your mobile' : 'your email'}</label>
                  <input id="staff-other-code" type="text" inputMode="numeric" maxLength={6} placeholder="6-digit code"
                    value={otherCode} onChange={e => setOtherCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleVerify()} />
                </>
              )}
              <button type="button" className="auth-reset" onClick={resetFlow}>Use a different number or email</button>
            </>
          )}
          <button type="button" className="auth-submit" onClick={codeSent ? handleVerify : handleSendCode} disabled={loading}>
            {loading ? <Spin size="small" /> : codeSent ? 'Verify and Log In' : 'Send Code'}
          </button>
        </div>
        <p className="auth-note">Staff accounts are created by an administrator.</p>
        <p className="auth-company">Askus Next Global Solutions Private Limited</p>
      </div>
    </main>
  );
}
