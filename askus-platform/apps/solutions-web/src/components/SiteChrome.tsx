import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { api } from '../api/mockApi';
import { useAppDispatch, loginSuccess } from '../store';

const navLinks = [
	{ to: '/home', label: 'Home' },
	{ to: '/about', label: 'About Us' },
	{ to: '/products', label: 'Solutions' },
	{ to: '/services', label: 'Our Service' },
	{ to: '/careers', label: 'Careers' },
	{ to: '/contact', label: 'Contact' },
];

const brandLogo = (
	<svg className="sc-logo" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
		<polygon points="24,3 43,13.5 43,34.5 24,45 5,34.5 5,13.5" fill="none" stroke="#ffffff" strokeWidth="2.2" />
		<path d="M24 15 L31 28 H17 Z" fill="none" stroke="#5ad4ff" strokeWidth="2" />
		<circle cx="24" cy="15" r="2.4" fill="#5ad4ff" />
		<circle cx="17" cy="28" r="2.4" fill="#5ad4ff" />
		<circle cx="31" cy="28" r="2.4" fill="#5ad4ff" />
	</svg>
);

export default function SiteChrome({ children }: { children: ReactNode }) {
	const dispatch = useAppDispatch();
	const navigate = useNavigate();
	const [showLogin, setShowLogin] = useState(false);
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [remember, setRemember] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const closeLogin = () => {
		if (submitting) return;
		setShowLogin(false);
	};

	const handleAdminLogin = async (e: FormEvent) => {
		e.preventDefault();
		if (!username.trim() || !password.trim()) {
			message.error('Enter username and password');
			return;
		}
		setSubmitting(true);
		try {
			const res = await api.verifyOTP(username.trim(), password.trim(), '');
			dispatch(loginSuccess({ token: res.token, user: res.user }));
			message.success(`Welcome, ${res.user.name}!`);
			setShowLogin(false);
			navigate(res.user.role === 'Agent' ? '/timesheet' : '/dashboard', { replace: true });
		} catch (err: unknown) {
			message.error(err instanceof Error ? err.message : 'Invalid credentials');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="sc">
			<style>{CSS}</style>

			<header className="sc-header">
				<div className="sc-header-inner">
					<Link to="/home" className="sc-brand">
						{brandLogo}
						ASK&nbsp;US&nbsp;SOLUTIONS
					</Link>
					<nav className="sc-nav">
						{navLinks.map((n) => (
							<NavLink
								key={n.to}
								to={n.to}
								className={({ isActive }) => (isActive ? 'sc-nav-link sc-active' : 'sc-nav-link')}
							>
								{n.label}
							</NavLink>
						))}
					</nav>
					<button type="button" className="sc-login-btn" onClick={() => setShowLogin(true)}>
						Login
					</button>
				</div>
			</header>

			<main className="sc-main">{children}</main>

			<footer className="sc-footer">
				<div className="sc-footer-inner">
					<div className="sc-footer-grid">
						<div>
							<div className="sc-footer-brand">
								{brandLogo}
								ASK US SOLUTIONS
							</div>
							<p className="sc-footer-tagline">
								Building the intelligence layer behind mobility, insurance, lending, and AI-driven support — one
								connected platform.
							</p>
						</div>
						<div>
							<div className="sc-footer-heading">Company</div>
							<ul className="sc-footer-links">
								<li><Link to="/home">Home</Link></li>
								<li><Link to="/about">About Us</Link></li>
								<li><Link to="/careers">Careers</Link></li>
								<li><Link to="/contact">Contact</Link></li>
							</ul>
						</div>
						<div>
							<div className="sc-footer-heading">Solutions</div>
							<ul className="sc-footer-links">
								<li><Link to="/products">AskUs AI Agents</Link></li>
								<li><Link to="/products/o2-taxi">O2 Taxi</Link></li>
								<li><Link to="/products/alphaa-insurance">Alphaa Insurance</Link></li>
								<li><Link to="/products/alphaa-loans">Alphaa Loans</Link></li>
							</ul>
						</div>
						<div>
							<div className="sc-footer-heading">Account</div>
							<ul className="sc-footer-links">
								<li><Link to="/services">Our Service</Link></li>
							</ul>
						</div>
						<div>
							<div className="sc-footer-heading">Follow Us</div>
							<div className="sc-footer-social">
								<a href="/home" aria-label="Facebook">
									<svg viewBox="0 0 24 24" fill="currentColor">
										<path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
									</svg>
								</a>
								<a href="/home" aria-label="Twitter">
									<svg viewBox="0 0 24 24" fill="currentColor">
										<path d="M22 5.9c-.7.3-1.5.6-2.3.7.8-.5 1.5-1.3 1.8-2.2-.8.5-1.7.8-2.6 1a4.1 4.1 0 0 0-7 3.7A11.6 11.6 0 0 1 3.6 4.9a4.1 4.1 0 0 0 1.3 5.5c-.7 0-1.3-.2-1.9-.5v.1a4.1 4.1 0 0 0 3.3 4 4.2 4.2 0 0 1-1.8.1 4.1 4.1 0 0 0 3.8 2.9A8.3 8.3 0 0 1 2 18.6a11.6 11.6 0 0 0 6.3 1.9c7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.1Z" />
									</svg>
								</a>
								<a href="/home" aria-label="LinkedIn">
									<svg viewBox="0 0 24 24" fill="currentColor">
										<path d="M6.9 8.4H3.4V21H6.9V8.4ZM5.2 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM21 21v-7c0-3.4-1.8-5-4.3-5-2 0-2.9 1.1-3.3 1.9V8.4H10v12.6h3.4v-7c0-.9.2-1.9 1.6-1.9 1.4 0 1.6 1.2 1.6 2v6.9H21Z" />
									</svg>
								</a>
								<a href="/home" aria-label="Instagram">
									<svg viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 8.4A3.6 3.6 0 1 0 12 15.6 3.6 3.6 0 0 0 12 8.4Zm0 5.9a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6Zm4.6-6.1a.85.85 0 1 1-1.7 0 .85.85 0 0 1 1.7 0ZM21 7.5A4.5 4.5 0 0 0 16.5 3h-9A4.5 4.5 0 0 0 3 7.5v9A4.5 4.5 0 0 0 7.5 21h9a4.5 4.5 0 0 0 4.5-4.5v-9ZM19.6 16.5a3.1 3.1 0 0 1-3.1 3.1h-9a3.1 3.1 0 0 1-3.1-3.1v-9a3.1 3.1 0 0 1 3.1-3.1h9a3.1 3.1 0 0 1 3.1 3.1v9Z" />
									</svg>
								</a>
							</div>
						</div>
					</div>
					<div className="sc-footer-bottom">&copy; {new Date().getFullYear()} AskusNext Global Solutions Private Limited. All rights reserved.</div>
				</div>
			</footer>

			{showLogin && (
				<div className="sc-modal-overlay" onClick={closeLogin}>
					<div className="sc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
						<button type="button" className="sc-modal-close" aria-label="Close" onClick={closeLogin}>
							&times;
						</button>
						<div className="sc-modal-eyebrow">
							<span className="sc-modal-sq" />
							RESTRICTED ACCESS
						</div>
						<h3 className="sc-modal-title">Admin Sign In</h3>
						<p className="sc-modal-sub">
							Access is provisioned by an Admin or Super Admin. Use the username and password issued to you.
						</p>
						<form onSubmit={handleAdminLogin}>
							<label className="sc-modal-label" htmlFor="sc-username">Username</label>
							<input
								id="sc-username"
								className="sc-modal-input"
								type="text"
								placeholder="Enter username"
								autoComplete="username"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								autoFocus
							/>
							<label className="sc-modal-label" htmlFor="sc-password">Password</label>
							<input
								id="sc-password"
								className="sc-modal-input"
								type="password"
								placeholder="••••••••"
								autoComplete="current-password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
							<div className="sc-modal-row">
								<label className="sc-modal-remember">
									<input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
									Remember me
								</label>
								<Link className="sc-modal-contact" to="/contact" onClick={closeLogin}>
									Contact Admin for access
								</Link>
							</div>
							<button type="submit" className="sc-modal-submit" disabled={submitting}>
								{submitting ? 'Signing in…' : 'Sign In'}
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

const CSS = `
.sc{ --ink:#060a14; --steel:#0d1526; --cyan:#5ad4ff; --white:#eef6ff; --mono:'SFMono-Regular',Consolas,'Courier New',monospace;
	min-height:100vh; display:flex; flex-direction:column; background:var(--ink); color:var(--white);
	font-family:'Segoe UI',system-ui,-apple-system,sans-serif; }

.sc-header{ position:sticky; top:0; z-index:50; background:rgba(6,10,20,0.86); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); border-bottom:1px solid rgba(90,212,255,0.16); }
.sc-header-inner{ max-width:1400px; margin:0 auto; padding:14px 6vw; display:flex; align-items:center; gap:clamp(12px,2.2vw,42px); }
.sc-brand{ display:flex; align-items:center; gap:10px; font-family:var(--mono); font-weight:700; letter-spacing:0.05em; font-size:clamp(16px,2vw,26px); color:var(--white); text-decoration:none; white-space:nowrap; }
.sc-logo{ width:26px; height:26px; flex-shrink:0; filter:drop-shadow(0 0 8px rgba(255,255,255,0.5)); }
.sc-nav{ display:flex; flex-wrap:nowrap; justify-content:flex-end; gap:clamp(8px,1.2vw,20px); margin-left:auto; }
.sc-nav-link{ font-family:var(--mono); font-size:clamp(13px,1.25vw,17px); font-weight:700; letter-spacing:0.02em; text-transform:uppercase; color:var(--white); text-decoration:none; padding-bottom:3px; border-bottom:1px solid transparent; transition:color .2s ease,border-color .2s ease; white-space:nowrap; }
.sc-nav-link:hover{ color:var(--cyan); border-color:rgba(90,212,255,0.6); }
.sc-nav-link.sc-active{ color:var(--cyan); border-color:var(--cyan); }
.sc-login-btn{ background:rgba(255,255,255,0.06); border:1.5px solid var(--white); color:var(--white); font-family:var(--mono); font-weight:700; font-size:clamp(13px,1.25vw,17px); letter-spacing:0.1em; text-transform:uppercase; padding:9px 18px; cursor:pointer; white-space:nowrap; transition:background .25s ease,color .25s ease,box-shadow .25s ease; }
.sc-login-btn:hover{ background:var(--cyan); color:#04101c; box-shadow:0 0 18px rgba(90,212,255,0.6); }

.sc-main{ flex:1; }

/* generic page section helpers */
.sc-section{ position:relative; max-width:1180px; margin:0 auto; padding:clamp(48px,7vw,96px) 6vw; }
.sc-eyebrow{ display:flex; align-items:center; gap:9px; font-family:var(--mono); font-size:11px; letter-spacing:0.24em; text-transform:uppercase; color:var(--cyan); }
.sc-glyph{ width:10px; height:10px; background:var(--cyan); box-shadow:0 0 10px rgba(90,212,255,0.9); }
.sc-title{ margin:16px 0 14px; font-size:clamp(24px,3.4vw,40px); font-weight:700; line-height:1.12; letter-spacing:-0.01em; max-width:18ch; }
.sc-sub{ font-size:clamp(15px,1.5vw,18px); line-height:1.7; color:var(--white); max-width:60ch; }
.sc-grid{ margin-top:44px; display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:22px; }
.sc-card{ background:rgba(255,255,255,0.03); border:1px solid rgba(90,212,255,0.18); padding:26px 24px; color:var(--white); text-decoration:none; transition:border-color .2s ease,transform .2s ease; }
.sc-card:hover{ border-color:rgba(90,212,255,0.5); transform:translateY(-3px); }
.sc-num{ font-family:var(--mono); font-size:13px; letter-spacing:0.2em; color:var(--cyan); }
.sc-card h4{ margin:12px 0 8px; font-size:19px; font-weight:700; color:var(--white); }
.sc-card:hover h4{ color:var(--cyan); }
.sc-card p{ font-size:14.5px; line-height:1.65; color:rgba(238,246,255,0.6); margin:0; }
.sc-tag{ display:inline-block; font-family:var(--mono); font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:var(--cyan); border:1px solid rgba(90,212,255,0.4); padding:3px 8px; margin-bottom:10px; }

/* product detail pages */
.sc-detail{ display:flex; gap:44px; align-items:flex-start; margin-top:40px; flex-wrap:wrap; }
.sc-detail-img{ width:380px; max-width:100%; height:auto; border:1px solid rgba(90,212,255,0.3); box-shadow:0 14px 44px rgba(0,0,0,0.5); flex-shrink:0; }
.sc-detail-lead{ flex:1; min-width:260px; font-size:clamp(15px,1.5vw,17px); line-height:1.8; color:rgba(238,246,255,0.72); }
.sc-prose{ margin-top:32px; }
.sc-prose p{ font-size:15px; line-height:1.9; color:rgba(238,246,255,0.7); margin:0 0 18px; }
.sc-back{ display:inline-block; margin-top:36px; font-family:var(--mono); font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--cyan); border:1px solid rgba(90,212,255,0.5); padding:9px 18px; text-decoration:none; transition:background .2s ease,color .2s ease; }
.sc-back:hover{ background:var(--cyan); color:#04101c; }
.sc-select{ background:rgba(255,255,255,0.03); border:1px solid rgba(238,246,255,0.18); color:var(--white); font-size:14px; padding:12px 13px; font-family:inherit; }
.sc-select option{ background:#0a1120; color:var(--white); }
.sc-form-note{ font-size:12.5px; color:rgba(238,246,255,0.5); margin-top:2px; }

/* contact */
.sc-contact-wrap{ margin-top:44px; display:grid; grid-template-columns:1fr 1fr; gap:40px; }
.sc-crow{ display:flex; gap:14px; margin-bottom:20px; }
.sc-dot2{ width:8px; height:8px; margin-top:6px; background:var(--cyan); box-shadow:0 0 8px rgba(90,212,255,1); flex-shrink:0; }
.sc-clabel{ font-family:var(--mono); font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:var(--white); }
.sc-cval{ font-size:14.5px; margin-top:4px; color:var(--white); }
.sc-contact-form{ display:flex; flex-direction:column; gap:14px; }
.sc-contact-form input,.sc-contact-form textarea{ background:rgba(255,255,255,0.03); border:1px solid rgba(238,246,255,0.18); color:var(--white); font-size:14px; padding:12px 13px; font-family:inherit; }
.sc-contact-form textarea{ min-height:110px; resize:vertical; }
.sc-contact-form button{ align-self:flex-start; background:var(--cyan); color:#04101c; border:none; font-family:var(--mono); font-weight:700; letter-spacing:0.18em; text-transform:uppercase; font-size:12px; padding:13px 26px; cursor:pointer; transition:box-shadow .25s ease; }
.sc-contact-form button:hover{ box-shadow:0 0 24px rgba(90,212,255,0.65); }

/* careers apply */
.sc-apply{ margin-top:44px; max-width:760px; border:1px solid rgba(90,212,255,0.18); background:rgba(255,255,255,0.03); padding:34px 32px; }
.sc-apply h3{ margin:0 0 6px; font-size:22px; font-weight:700; color:var(--white); }
.sc-apply-lead{ margin:0 0 24px; font-size:14.5px; line-height:1.6; color:rgba(238,246,255,0.7); }
.sc-apply-form{ display:flex; flex-direction:column; gap:16px; }
.sc-field-row{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.sc-field{ display:flex; flex-direction:column; gap:7px; min-width:0; }
.sc-flabel{ font-family:var(--mono); font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:var(--cyan); }
.sc-apply-form input,.sc-apply-form select,.sc-apply-form textarea{ box-sizing:border-box; max-width:100%; background:rgba(255,255,255,0.03); border:1px solid rgba(238,246,255,0.18); color:var(--white); font-size:14px; padding:12px 13px; font-family:inherit; width:100%; }
.sc-apply-form textarea{ min-height:110px; resize:vertical; }
.sc-apply-form option{ background:#0a1120; color:var(--white); }
.sc-apply-form input[type=file]{ padding:10px 13px; cursor:pointer; }
.sc-apply-form input[type=file]::file-selector-button{ background:var(--cyan); color:#04101c; border:none; font-family:var(--mono); font-weight:700; letter-spacing:0.1em; text-transform:uppercase; font-size:11px; padding:8px 14px; margin-right:12px; cursor:pointer; }
.sc-apply-form button{ align-self:flex-start; margin-top:6px; background:var(--cyan); color:#04101c; border:none; font-family:var(--mono); font-weight:700; letter-spacing:0.18em; text-transform:uppercase; font-size:12px; padding:14px 30px; cursor:pointer; transition:box-shadow .25s ease; }
.sc-apply-form button:hover{ box-shadow:0 0 24px rgba(90,212,255,0.65); }
@media (max-width:640px){ .sc-field-row{ grid-template-columns:1fr; } }

/* success modal */
.sc-success-overlay{ position:fixed; inset:0; background:rgba(3,7,15,0.78); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:1000; padding:20px; animation:sc-fade .2s ease; }
.sc-success-modal{ background:var(--steel); border:1px solid rgba(90,212,255,0.25); padding:42px 38px; max-width:430px; width:100%; text-align:center; box-shadow:0 24px 70px rgba(0,0,0,0.55); animation:sc-pop .28s ease; }
.sc-success-tick{ width:88px; height:88px; margin:0 auto 22px; border-radius:50%; background:rgba(46,204,113,0.12); border:3px solid #2ecc71; display:flex; align-items:center; justify-content:center; }
.sc-success-tick svg{ width:46px; height:46px; color:#2ecc71; }
.sc-success-modal h3{ margin:0 0 10px; font-size:23px; font-weight:700; color:var(--white); }
.sc-success-modal p{ margin:0 0 26px; font-size:14.5px; line-height:1.6; color:rgba(238,246,255,0.72); }
.sc-success-close{ background:var(--cyan); color:#04101c; border:none; font-family:var(--mono); font-weight:700; letter-spacing:0.16em; text-transform:uppercase; font-size:12px; padding:13px 34px; cursor:pointer; transition:box-shadow .25s ease; }
.sc-success-close:hover{ box-shadow:0 0 24px rgba(90,212,255,0.65); }
@keyframes sc-fade{ from{opacity:0;} to{opacity:1;} }
@keyframes sc-pop{ from{opacity:0; transform:scale(0.9);} to{opacity:1; transform:scale(1);} }

/* footer */
.sc-footer{ background:var(--ink); border-top:1px solid rgba(90,212,255,0.14); padding:64px 8vw 28px; }
.sc-footer-inner{ max-width:1180px; margin:0 auto; }
.sc-footer-grid{ display:grid; grid-template-columns:1.4fr 1fr 1fr 1fr 0.9fr; gap:28px; }
.sc-footer-brand{ display:flex; align-items:center; gap:10px; font-family:var(--mono); font-weight:700; letter-spacing:0.06em; font-size:14px; color:var(--white); }
.sc-footer-brand .sc-logo{ width:28px; height:28px; }
.sc-footer-tagline{ margin-top:14px; font-size:13px; color:rgba(238,246,255,0.55); line-height:1.7; max-width:34ch; }
.sc-footer-heading{ font-family:var(--mono); font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:var(--cyan); margin-bottom:16px; }
.sc-footer-links{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:11px; }
.sc-footer-links a{ color:rgba(238,246,255,0.68); font-size:13px; text-decoration:none; transition:color .2s ease; }
.sc-footer-links a:hover{ color:var(--cyan); }
.sc-footer-social{ display:flex; gap:12px; }
.sc-footer-social a{ width:34px; height:34px; border-radius:50%; border:1px solid rgba(90,212,255,0.3); display:flex; align-items:center; justify-content:center; color:var(--white); transition:border-color .2s ease,color .2s ease; }
.sc-footer-social a:hover{ border-color:var(--cyan); color:var(--cyan); }
.sc-footer-social svg{ width:15px; height:15px; }
.sc-footer-bottom{ margin-top:48px; padding-top:22px; border-top:1px solid rgba(90,212,255,0.12); display:flex; align-items:center; justify-content:center; font-size:12.5px; color:rgba(238,246,255,0.45); }

/* admin sign in modal */
.sc-modal-overlay{ position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(6,10,20,0.1); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); animation:sc-fade .2s ease; }
@keyframes sc-fade{ from{ opacity:0; } to{ opacity:1; } }
.sc-modal{ position:relative; width:100%; max-width:420px; background:rgba(10,17,32,0.92); border:1px solid rgba(90,212,255,0.45); box-shadow:0 24px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(90,212,255,0.08); padding:30px 30px 32px; color:var(--white); animation:sc-pop .22s ease; }
@keyframes sc-pop{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
.sc-modal-close{ position:absolute; top:14px; right:14px; width:30px; height:30px; line-height:1; background:rgba(255,255,255,0.06); border:1px solid rgba(238,246,255,0.2); color:var(--white); font-size:20px; cursor:pointer; transition:background .2s ease,border-color .2s ease; }
.sc-modal-close:hover{ background:rgba(255,255,255,0.14); border-color:var(--cyan); }
.sc-modal-eyebrow{ display:flex; align-items:center; gap:8px; font-family:var(--mono); font-size:10px; letter-spacing:0.28em; text-transform:uppercase; color:var(--cyan); }
.sc-modal-sq{ width:9px; height:9px; background:var(--cyan); box-shadow:0 0 8px rgba(90,212,255,0.9); }
.sc-modal-title{ margin:12px 0 6px; font-size:22px; font-weight:700; color:var(--white); }
.sc-modal-sub{ margin:0 0 22px; font-size:13px; line-height:1.6; color:rgba(238,246,255,0.6); }
.sc-modal-label{ display:block; font-family:var(--mono); font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:rgba(238,246,255,0.55); margin-bottom:7px; }
.sc-modal-input{ width:100%; box-sizing:border-box; background:rgba(255,255,255,0.04); border:1px solid rgba(90,212,255,0.35); color:var(--white); font-size:14px; padding:12px 13px; font-family:inherit; margin-bottom:18px; outline:none; transition:border-color .2s ease,box-shadow .2s ease; }
.sc-modal-input:focus{ border-color:var(--cyan); box-shadow:0 0 0 3px rgba(90,212,255,0.18); }
.sc-modal-input::placeholder{ color:rgba(238,246,255,0.35); }
.sc-modal-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:22px; }
.sc-modal-remember{ display:flex; align-items:center; gap:8px; font-size:12.5px; color:rgba(238,246,255,0.75); cursor:pointer; }
.sc-modal-remember input{ accent-color:var(--cyan); width:14px; height:14px; }
.sc-modal-contact{ font-size:12.5px; color:rgba(238,246,255,0.6); text-decoration:none; transition:color .2s ease; }
.sc-modal-contact:hover{ color:var(--cyan); }
.sc-modal-submit{ width:100%; background:var(--cyan); color:#04101c; border:none; cursor:pointer; font-family:var(--mono); font-weight:700; letter-spacing:0.2em; text-transform:uppercase; font-size:13px; padding:14px; transition:box-shadow .25s ease,opacity .2s ease; }
.sc-modal-submit:hover{ box-shadow:0 0 24px rgba(90,212,255,0.6); }
.sc-modal-submit:disabled{ opacity:0.6; cursor:default; box-shadow:none; }

@media (max-width:900px){ .sc-footer-grid{ grid-template-columns:1fr 1fr; } .sc-contact-wrap{ grid-template-columns:1fr; } }
@media (max-width:760px){ .sc-nav{ display:none; } }
`;
