import ai3dBg from "../assets/ai-3d-bg.svg";
import React, { useState } from 'react';
import { message, Spin } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/mockApi';
import { useAppDispatch } from '../store';
import { loginSuccess } from '../store';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [code, setCode]             = useState('');
  const [codeSent, setCodeSent]     = useState(false);
  const [sessionId, setSessionId]   = useState('');
  const [loading, setLoading]       = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // ── OTP login (mobile or email) ────────────────────────────────────────────
  const handleSendCode = async () => {
    if (!identifier.trim()) {
      message.error('Enter your mobile number or email');
      return;
    }
    setLoading(true);
    try {
      const res = await api.sendOTP(identifier.trim());
      setSessionId(res.sessionId);
      setCodeSent(true);
      message.success('Verification code sent');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Could not send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      message.error('Enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const res = await api.verifyOTP(identifier.trim(), code.trim(), sessionId);
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
    <div style={s.page}>
      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div style={s.left}>
        <div style={s.brandTop}>
          <div style={s.brandName}>AskusNext Global Solutions Private Limited</div>
        </div>

        <Link to="/home" style={{ fontSize: 13, fontWeight: 600, color: '#5b6b83', textDecoration: 'none' }}>
          ← Back to AskusNext Global Solutions Private Limited
        </Link>

        <h1 style={s.hello}>Hello!</h1>
        <p style={s.subtitle}>Welcome back. Please sign in to continue.</p>

        {/* Tab bar */}
        <div style={s.tabBar}>
          <button style={{ ...s.tab, ...s.tabActive }}>
            Mobile / Email OTP
          </button>
        </div>

        <div style={s.form}>
            <label style={s.label}>Mobile number or email</label>
            <input
              type="text"
              placeholder="Enter your mobile or email"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !codeSent && handleSendCode()}
              style={s.input}
              readOnly={codeSent}
              autoFocus
            />
            {codeSent && (
              <>
                <label style={s.label}>Verification code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  style={s.input}
                  autoFocus
                />
                <div style={{ textAlign: 'right', marginBottom: 14 }}>
                  <a style={{ ...s.link, cursor: 'pointer' }} onClick={() => { setCodeSent(false); setCode(''); }}>
                    Use a different number or email
                  </a>
                </div>
              </>
            )}
            <button style={s.primaryBtn} onClick={codeSent ? handleVerify : handleSendCode} disabled={loading}>
              {loading ? <Spin size="small" /> : codeSent ? 'Verify and Log In' : 'Send Code'}
            </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#888' }}>
          Staff accounts are created by an administrator.
        </p>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div style={{ ...s.right, backgroundImage: `url(${ai3dBg})` }}>
        <div style={s.topStrip} />
        <div style={s.bottomStrip} />
        <div style={s.overlay} />

        <div style={s.topNav}>
          <a href="#" style={s.navLink}>Sign Up</a>
          <a href="#" style={s.navBtn}>Join Us</a>
        </div>

        <div style={{ position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', zIndex: 2 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: 0.5, lineHeight: 1.3, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>AskusNext Global Solutions Private Limited</div>
        </div>

        <div style={{ position: 'absolute', bottom: 80, left: 0, right: 0, textAlign: 'center', zIndex: 2, padding: '0 32px' }}>
          <p style={s.rightHeading}>Your Trusted<br />Insurance Partner</p>
          <div style={s.dividerThin} />
          <p style={s.tagline}>Get the right coverage,<br />without the hassle</p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={s.badge}><span style={s.badgeText}>Insurance Policy</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page: { display: 'flex', minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif" },

  left: {
    flex: 3, background: 'linear-gradient(145deg, #e8f0fe 0%, #f0e8ff 50%, #fce4ec 100%)',
    padding: '36px 144px', display: 'flex', flexDirection: 'column',
    justifyContent: 'center', position: 'relative',
  },
  brandTop: {
    position: 'absolute', top: 32, left: 0, right: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  brandName: { fontSize: 32, fontWeight: 800, color: '#1565C0', letterSpacing: 0.5, lineHeight: 1.3 },

  hello:    { fontSize: 22, fontWeight: 600, color: '#111', margin: '0 0 4px' },
  subtitle: { fontSize: 12, color: '#888', margin: '0 0 20px' },

  tabBar: { display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, marginBottom: 18 },
  tab: {
    flex: 1, padding: '7px 0', border: 'none', borderRadius: 6,
    fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'transparent', color: '#888',
  },
  tabActive: { background: '#1565C0', color: '#fff' },

  form:  { display: 'flex', flexDirection: 'column' },
  label: { fontSize: 11, color: '#666', marginBottom: 5, marginTop: 3 },
  input: {
    padding: '8px 12px', borderRadius: 7, border: '1px solid #e0e0e0',
    background: '#f9f9f9', fontSize: 12, color: '#111', marginBottom: 10,
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  otpBox: {
    width: 40, height: 44, textAlign: 'center', borderRadius: 7,
    border: '1.5px solid #e0e0e0', background: '#f9f9f9',
    fontSize: 18, fontWeight: 700, color: '#111', outline: 'none', transition: 'all 0.15s',
  },
  primaryBtn: {
    width: '100%', padding: '9px 0', background: '#1565C0', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4,
  },
  googleBtn: {
    width: '100%', padding: '11px 0', background: '#fff', color: '#444',
    border: '1.5px solid #dadce0', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  link:       { color: '#1565C0', textDecoration: 'none', fontWeight: 500, fontSize: 11 },
  inlineLink: { color: '#1565C0', cursor: 'pointer', fontWeight: 600, fontSize: 12 },

  warningBox: {
    background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 6,
    padding: '8px 12px', fontSize: 11, color: '#7c6d00', marginBottom: 12,
  },

  credHint: {
    marginTop: 16, padding: '10px 12px', background: 'rgba(21,101,192,0.06)',
    borderRadius: 8, border: '1px solid rgba(21,101,192,0.15)',
  },
  credTitle: { fontSize: 10, fontWeight: 700, color: '#1565C0', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  credRow:   { fontSize: 11, color: '#444', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 },
  credRole:  { background: '#1565C0', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600 },

  /* RIGHT */
  right: {
    flex: 7, position: 'relative', backgroundSize: 'cover', backgroundPosition: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  topStrip: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 56, zIndex: 1,
    background: 'linear-gradient(to bottom, rgba(7,20,43,0.92) 55%, transparent 100%)',
  },
  bottomStrip: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 72, zIndex: 1,
    background: 'linear-gradient(to top, rgba(6,17,36,0.92) 55%, transparent 100%)',
  },
  overlay: { position: 'absolute', inset: 0, background: 'rgba(5,14,30,0.42)', zIndex: 1 },
  topNav:  { position: 'absolute', top: 16, right: 20, display: 'flex', gap: 12, zIndex: 2 },
  navLink: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textDecoration: 'none' },
  navBtn:  {
    fontSize: 13, color: '#fff', background: 'rgba(255,255,255,0.15)',
    padding: '5px 16px', borderRadius: 20, textDecoration: 'none',
    border: '1px solid rgba(255,255,255,0.35)',
  },
  rightHeading: { fontSize: 20, fontWeight: 600, color: '#fff', lineHeight: 1.4, margin: '0 0 12px', textShadow: '0 2px 8px rgba(0,0,0,0.6)' },
  dividerThin:  { width: 36, height: 1.5, background: 'rgba(255,255,255,0.45)', borderRadius: 2, margin: '0 auto 16px' },
  tagline: {
    fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.92)',
    letterSpacing: '1.2px', textTransform: 'uppercase', lineHeight: 1.85,
    margin: '0 0 20px', textShadow: '0 1px 4px rgba(0,0,0,0.5)',
  },
  badge:     { display: 'inline-block', padding: '8px 26px', borderRadius: 24, border: '1.5px solid rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.15)' },
  badgeText: { fontSize: 12, fontWeight: 600, color: '#fff', letterSpacing: 2, textTransform: 'uppercase' },
};
