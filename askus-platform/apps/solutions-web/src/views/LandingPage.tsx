import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { api } from '../api/mockApi';
import { useAppDispatch, loginSuccess } from '../store';
import heroSlide1 from '../assets/hero-slide-1.png';
import heroSlide2 from '../assets/hero-slide-2.png';
import heroSlide3 from '../assets/hero-slide-3.png';
import solutionAiAgents from '../assets/solution-ai-agents.jpeg';
import solutionO2Taxi from '../assets/solution-o2-taxi.jpeg';
import solutionAlphaaInsurance from '../assets/solution-alphaa-insurance.jpeg';
import solutionAlphaaLoans from '../assets/solution-alphaa-loans.jpeg';

// Rotating Ken Burns background built from the hero-slide-* assets.
const heroSlides = [heroSlide1, heroSlide2, heroSlide3];

const solutions = [
	{
		to: '/products/ai-agents',
		key: 'ai-agents',
		name: 'AskUs AI Agents',
		tag: 'Automation',
		desc: 'AskUs AI Agents are always-on digital teammates that talk to your customers the way your best staff would. They answer questions, take bookings, resolve complaints, and follow up on payments without ever clocking out. Trained on your own policies and data, they understand context and reply in natural language across chat, voice, and email. Every conversation is logged, so nothing slips through the cracks and your team keeps full visibility. Routine work is handled in seconds, freeing people to focus on the cases that truly need a human touch. The agents hand off smoothly to a live person whenever a query gets too complex. They scale instantly during peak hours without extra hiring or overtime. Over time they learn from real interactions and get sharper at solving problems. Multilingual by design, they meet each customer in the language they are most comfortable with. The result is faster support, lower costs, and customers who feel genuinely heard.',
	},
	{
		to: '/products/o2-taxi',
		key: 'o2-taxi',
		name: 'O2 Taxi',
		tag: 'Mobility',
		desc: 'O2 Taxi brings bikes, autos, cars, and shared rides together on one connected mobility network built for the whole city. A single tap matches riders with the nearest verified driver and the fairest fare for the trip. Live GPS tracking keeps every journey visible to riders, families, and the operations team in real time. Transparent, upfront pricing means no haggling and no surprises when the ride ends. Drivers get steady demand, clear earnings, and tools that make each shift simpler to run. Shared options let commuters split routes and save money while easing traffic on busy roads. Safety features like trip sharing, SOS, and driver verification are built in from the start. Cashless payments and instant digital receipts make every ride quick and accountable. Smart routing avoids congestion so people reach their destination sooner. It is everyday transport made reliable, affordable, and genuinely stress-free.',
	},
	{
		to: '/products/alphaa-insurance',
		key: 'alphaa-insurance',
		name: 'Alphaa Insurance',
		tag: 'Protection',
		desc: 'Alphaa Insurance makes protecting your vehicle and livelihood simple, transparent, and fast. Clear policy plans are written in plain language, so you always know exactly what is covered. Instant premium checks let you see accurate pricing in seconds before you commit to anything. Buying or renewing a policy takes minutes and happens entirely online without paperwork. When something goes wrong, guided digital claims move quickly with real support at every step. Coverage is designed for both individual commuters and full fleets that need reliable protection. Reminders keep your policy active so you are never caught off guard by a lapse. Every document lives in one place, ready to access whenever you need it. Fair pricing is backed by honest terms with no hidden clauses buried in fine print. It is dependable cover that gives drivers real peace of mind on every trip.',
	},
	{
		to: '/products/alphaa-loans',
		key: 'alphaa-loans',
		name: 'Alphaa Loans',
		tag: 'Finance',
		desc: 'Alphaa Loans delivers quick, paperless financing built for the pace of everyday life. Apply in minutes from your phone and get a clear decision without long branch visits. Approvals are fast because eligibility is checked digitally against transparent, upfront criteria. Flexible repayment plans are shaped around your income so instalments stay comfortable. Funds for a new vehicle, working capital, or an urgent need reach you without delay. Interest rates and charges are shown clearly before you accept, with no hidden surprises. Every step, from application to disbursal, is tracked so you always know where you stand. Repayments and statements sit in one dashboard that is easy to manage on the go. Responsible lending checks keep borrowing healthy and sustainable for the long run. It is financing that feels fast, fair, and genuinely built around real people.',
	},
];

// 300x300 human-interaction image per solution key.
const solutionImages: Record<string, string> = {
	'ai-agents': solutionAiAgents,
	'o2-taxi': solutionO2Taxi,
	'alphaa-insurance': solutionAlphaaInsurance,
	'alphaa-loans': solutionAlphaaLoans,
};
const solutionImage = (key: string): string | undefined => solutionImages[key];

// Fallback 300x300 illustration of a person interacting with an AI system.
const humanAiScene = (
	<svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
		<defs>
			<linearGradient id="hai-bg" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stopColor="#0a1526" />
				<stop offset="1" stopColor="#102237" />
			</linearGradient>
			<radialGradient id="hai-glow" cx="0.72" cy="0.34" r="0.6">
				<stop offset="0" stopColor="#1f4a66" />
				<stop offset="1" stopColor="#0a1526" stopOpacity="0" />
			</radialGradient>
		</defs>
		<rect width="300" height="300" fill="url(#hai-bg)" />
		<rect width="300" height="300" fill="url(#hai-glow)" />
		{/* person */}
		<circle cx="84" cy="118" r="26" fill="none" stroke="#5ad4ff" strokeWidth="3" />
		<path d="M40 214 Q40 158 84 158 Q128 158 128 214 Z" fill="rgba(90,212,255,0.06)" stroke="#5ad4ff" strokeWidth="3" />
		{/* ai panel */}
		<rect x="172" y="86" width="92" height="70" rx="12" fill="rgba(90,212,255,0.08)" stroke="#5ad4ff" strokeWidth="2.5" />
		<line x1="218" y1="86" x2="218" y2="72" stroke="#5ad4ff" strokeWidth="2.5" />
		<circle cx="218" cy="68" r="4" fill="#5ad4ff" />
		<circle cx="198" cy="120" r="6" fill="#5ad4ff" />
		<circle cx="238" cy="120" r="6" fill="#5ad4ff" />
		<path d="M204 138 Q218 148 232 138" stroke="#5ad4ff" strokeWidth="2.5" fill="none" />
		{/* connection */}
		<path d="M128 150 C150 150 158 128 172 124" stroke="#5ad4ff" strokeWidth="2" strokeDasharray="4 6" />
		<circle cx="150" cy="150" r="3" fill="#5ad4ff" />
		<circle cx="172" cy="124" r="3" fill="#5ad4ff" />
		{/* floating nodes */}
		<circle cx="150" cy="70" r="3" fill="#5ad4ff" opacity="0.7" />
		<circle cx="250" cy="196" r="3" fill="#5ad4ff" opacity="0.7" />
		<circle cx="96" cy="60" r="2.5" fill="#5ad4ff" opacity="0.6" />
	</svg>
);


const navLinks = [
	{ to: '/home', label: 'Home' },
	{ to: '/about', label: 'About Us' },
	{ to: '/products', label: 'Solutions' },
	{ to: '/services', label: 'Our Service' },
	{ to: '/careers', label: 'Careers' },
	{ to: '/contact', label: 'Contact' },
];

const brandLogo = (
	<svg className="lp-logo" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
		<polygon points="24,3 43,13.5 43,34.5 24,45 5,34.5 5,13.5" fill="none" stroke="#ffffff" strokeWidth="2.2" />
		<path d="M24 15 L31 28 H17 Z" fill="none" stroke="#5ad4ff" strokeWidth="2" />
		<circle cx="24" cy="15" r="2.4" fill="#5ad4ff" />
		<circle cx="17" cy="28" r="2.4" fill="#5ad4ff" />
		<circle cx="31" cy="28" r="2.4" fill="#5ad4ff" />
	</svg>
);

export default function LandingPage() {
	const netRef = useRef<SVGSVGElement | null>(null);
	const particleRef = useRef<HTMLDivElement | null>(null);
	const [slide, setSlide] = useState(0);

	// ── Admin Sign In modal ───────────────────────────────────────────────────
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

	useEffect(() => {
		if (heroSlides.length < 2) return;
		const id = setInterval(() => setSlide((s) => (s + 1) % heroSlides.length), 6000);
		return () => clearInterval(id);
	}, []);

	useEffect(() => {
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const SVGNS = 'http://www.w3.org/2000/svg';
		const rnd = (n: number) => Math.random() * n;

		const net = netRef.current;
		if (net && !reduce) {
			const W = 1200;
			const H = 700;
			const nodes: Array<[number, number]> = [];
			for (let i = 0; i < 14; i++) nodes.push([rnd(W), rnd(H)]);
			const speeds = ['', ' slow', ' fast'];
			for (let i = 0; i < nodes.length; i++) {
				const [x1, y1] = nodes[i];
				const [x2, y2] = nodes[(i + 1 + Math.floor(rnd(3))) % nodes.length];
				const mx = (x1 + x2) / 2 + rnd(120) - 60;
				const my = (y1 + y2) / 2 + rnd(120) - 60;
				const path = document.createElementNS(SVGNS, 'path');
				path.setAttribute('d', `M ${x1},${y1} Q ${mx},${my} ${x2},${y2}`);
				path.setAttribute('class', 'lp-netline' + speeds[Math.floor(rnd(3))]);
				net.appendChild(path);
			}
			for (const [x, y] of nodes) {
				const c = document.createElementNS(SVGNS, 'circle');
				c.setAttribute('cx', String(x));
				c.setAttribute('cy', String(y));
				c.setAttribute('r', '3');
				c.setAttribute('class', 'lp-node');
				net.appendChild(c);
			}
		}

		const field = particleRef.current;
		if (field && !reduce) {
			const count = window.innerWidth < 600 ? 14 : 24;
			for (let i = 0; i < count; i++) {
				const p = document.createElement('span');
				p.className = 'lp-p';
				p.style.left = `${rnd(100)}%`;
				p.style.setProperty('--drift', `${rnd(60) - 30}px`);
				p.style.animationDuration = `${(rnd(10) + 10).toFixed(2)}s`;
				p.style.animationDelay = `${rnd(12).toFixed(2)}s`;
				field.appendChild(p);
			}
		}

		return () => {
			if (netRef.current) netRef.current.innerHTML = '';
			if (particleRef.current) particleRef.current.innerHTML = '';
		};
	}, []);

	return (
		<div className="lp">
			<style>{CSS}</style>

			{/* ---------- HERO STAGE ---------- */}
			<div className="lp-stage" id="home">
				<div className="lp-stage-bg">
					{heroSlides.length > 0 && (
						<div className="lp-slides">
							{heroSlides.map((src, i) => (
								<div key={i} className={`lp-slide${i === slide ? ' active' : ''}`}>
									<img src={src} alt="" className={`lp-kb lp-kb-${i % 3}`} />
								</div>
							))}
						</div>
					)}
					<div className="lp-scan" />
					<svg className="lp-netlayer" ref={netRef} viewBox="0 0 1200 700" preserveAspectRatio="none" />
					<div className="lp-particles" ref={particleRef} />
					<div className="lp-veil" />
				</div>

				<div className="lp-topbar">
					<Link to="/home" className="lp-brand" aria-label="AskusNext Global Solutions Private Limited — Home">
						{brandLogo}
						ASK&nbsp;US&nbsp;SOLUTIONS
					</Link>
					<nav className="lp-nav">
						{navLinks.map((n) => (
							<Link key={n.to} to={n.to}>
								{n.label}
							</Link>
						))}
					</nav>
					<button type="button" className="lp-login-btn" onClick={() => setShowLogin(true)}>
						Login
					</button>
				</div>

				<div className="lp-orbit lp-o1">
					<span className="lp-tick" />
				</div>
				<div className="lp-orbit lp-o2" />
				<div className="lp-orbit lp-o3" />

				<div className="lp-radar">
					<svg viewBox="0 0 200 200">
						<circle className="lp-ring" cx="100" cy="100" r="90" />
						<circle className="lp-ring" cx="100" cy="100" r="60" />
						<circle className="lp-ring" cx="100" cy="100" r="30" />
						<g className="lp-sweeparm">
							<path d="M100,100 L100,10 A90,90 0 0,1 155,35 Z" fill="url(#lpg)" opacity="0.55" />
						</g>
						<defs>
							<linearGradient id="lpg" x1="0" y1="0" x2="1" y2="1">
								<stop offset="0%" stopColor="#5ad4ff" stopOpacity="0.7" />
								<stop offset="100%" stopColor="#5ad4ff" stopOpacity="0" />
							</linearGradient>
						</defs>
					</svg>
				</div>

				<div className="lp-hero-content">
					<div className="lp-eyebrow">Connected Intelligence</div>
					<h1 className="lp-h1">One network. Every service, moving in sync.</h1>
					<p className="lp-sub">
						From AI-driven support to fleet mobility, insurance, and lending — every service reports, reacts, and adapts
						in real time. The technology backbone AskusNext Global Solutions Private Limited builds and runs.
					</p>
				</div>

				<div className="lp-ticker">
					<div className="lp-ticker-track">
						ASKUS AI AGENT &nbsp;&nbsp;•&nbsp;&nbsp; O2 TAXI &nbsp;&nbsp;•&nbsp;&nbsp; ALPHAA INSURANCE &nbsp;&nbsp;•&nbsp;&nbsp;
						ALPHAA LOANS &nbsp;&nbsp;•&nbsp;&nbsp; ASKUS AI AGENT &nbsp;&nbsp;•&nbsp;&nbsp; O2 TAXI &nbsp;&nbsp;•&nbsp;&nbsp;
						ALPHAA INSURANCE &nbsp;&nbsp;•&nbsp;&nbsp; ALPHAA LOANS &nbsp;&nbsp;•&nbsp;&nbsp;
					</div>
				</div>
			</div>

			{/* ---------- SOLUTIONS ---------- */}
			<section className="lp-section" id="solutions">
				<div className="lp-inner">
					<h2 className="lp-section-title">Four platforms. One intelligence layer.</h2>
					<p className="lp-section-sub">
						Everything AskusNext Global Solutions Private Limited builds and operates, from AI-driven support to mobility, insurance, and lending.
					</p>
					<div className="lp-sol-list">
						{solutions.map((s) => {
							const img = solutionImage(s.key);
							return (
								<div key={s.name} className="lp-sol-row">
									<div className="lp-sol-media">{img ? <img src={img} alt={s.name} /> : humanAiScene}</div>
									<div className="lp-sol-body">
										<h3 className="lp-sol-name">{s.name}</h3>
										<p className="lp-sol-desc">{s.desc}</p>
										<Link to={s.to} className="lp-sol-link">
											Learn more →
										</Link>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</section>

			{/* ---------- FOOTER ---------- */}
			<footer className="lp-footer">
				<div className="lp-footer-inner">
					<div className="lp-footer-grid">
						<div>
							<div className="lp-footer-brand">
								{brandLogo}
								ASK US SOLUTIONS
							</div>
							<p className="lp-footer-tagline">
								Building the intelligence layer behind mobility, insurance, lending, and AI-driven support — one
								connected platform.
							</p>
						</div>
						<div>
							<div className="lp-footer-heading">Company</div>
							<ul className="lp-footer-links">
								<li><Link to="/home">Home</Link></li>
								<li><Link to="/about">About Us</Link></li>
								<li><Link to="/careers">Careers</Link></li>
								<li><Link to="/contact">Contact</Link></li>
							</ul>
						</div>
						<div>
							<div className="lp-footer-heading">Solutions</div>
							<ul className="lp-footer-links">
								<li><Link to="/products">AskUs AI Agents</Link></li>
								<li><Link to="/products/o2-taxi">O2 Taxi</Link></li>
								<li><Link to="/products/alphaa-insurance">Alphaa Insurance</Link></li>
								<li><Link to="/products/alphaa-loans">Alphaa Loans</Link></li>
							</ul>
						</div>
						<div>
							<div className="lp-footer-heading">Account</div>
							<ul className="lp-footer-links">
								<li><Link to="/services">Our Service</Link></li>
							</ul>
						</div>
						<div>
							<div className="lp-footer-heading">Follow Us</div>
							<div className="lp-footer-social">
								<a href="#home" aria-label="Facebook">
									<svg viewBox="0 0 24 24" fill="currentColor">
										<path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
									</svg>
								</a>
								<a href="#home" aria-label="Twitter">
									<svg viewBox="0 0 24 24" fill="currentColor">
										<path d="M22 5.9c-.7.3-1.5.6-2.3.7.8-.5 1.5-1.3 1.8-2.2-.8.5-1.7.8-2.6 1a4.1 4.1 0 0 0-7 3.7A11.6 11.6 0 0 1 3.6 4.9a4.1 4.1 0 0 0 1.3 5.5c-.7 0-1.3-.2-1.9-.5v.1a4.1 4.1 0 0 0 3.3 4 4.2 4.2 0 0 1-1.8.1 4.1 4.1 0 0 0 3.8 2.9A8.3 8.3 0 0 1 2 18.6a11.6 11.6 0 0 0 6.3 1.9c7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.1Z" />
									</svg>
								</a>
								<a href="#home" aria-label="LinkedIn">
									<svg viewBox="0 0 24 24" fill="currentColor">
										<path d="M6.9 8.4H3.4V21H6.9V8.4ZM5.2 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM21 21v-7c0-3.4-1.8-5-4.3-5-2 0-2.9 1.1-3.3 1.9V8.4H10v12.6h3.4v-7c0-.9.2-1.9 1.6-1.9 1.4 0 1.6 1.2 1.6 2v6.9H21Z" />
									</svg>
								</a>
								<a href="#home" aria-label="Instagram">
									<svg viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 8.4A3.6 3.6 0 1 0 12 15.6 3.6 3.6 0 0 0 12 8.4Zm0 5.9a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6Zm4.6-6.1a.85.85 0 1 1-1.7 0 .85.85 0 0 1 1.7 0ZM21 7.5A4.5 4.5 0 0 0 16.5 3h-9A4.5 4.5 0 0 0 3 7.5v9A4.5 4.5 0 0 0 7.5 21h9a4.5 4.5 0 0 0 4.5-4.5v-9ZM19.6 16.5a3.1 3.1 0 0 1-3.1 3.1h-9a3.1 3.1 0 0 1-3.1-3.1v-9a3.1 3.1 0 0 1 3.1-3.1h9a3.1 3.1 0 0 1 3.1 3.1v9Z" />
									</svg>
								</a>
							</div>
						</div>
					</div>
					<div className="lp-footer-bottom">&copy; {new Date().getFullYear()} AskusNext Global Solutions Private Limited. All rights reserved.</div>
				</div>
			</footer>

			{/* ---------- ADMIN SIGN IN MODAL ---------- */}
			{showLogin && (
				<div className="lp-modal-overlay" onClick={closeLogin}>
					<div className="lp-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
						<button type="button" className="lp-modal-close" aria-label="Close" onClick={closeLogin}>
							&times;
						</button>
						<div className="lp-modal-eyebrow">
							<span className="lp-modal-sq" />
							RESTRICTED ACCESS
						</div>
						<h3 className="lp-modal-title">Admin Sign In</h3>
						<p className="lp-modal-sub">
							Access is provisioned by an Admin or Super Admin. Use the username and password issued to you.
						</p>
						<form onSubmit={handleAdminLogin}>
							<label className="lp-modal-label" htmlFor="lp-username">Username</label>
							<input
								id="lp-username"
								className="lp-modal-input"
								type="text"
								placeholder="Enter username"
								autoComplete="username"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								autoFocus
							/>
							<label className="lp-modal-label" htmlFor="lp-password">Password</label>
							<input
								id="lp-password"
								className="lp-modal-input"
								type="password"
								placeholder="••••••••"
								autoComplete="current-password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
							<div className="lp-modal-row">
								<label className="lp-modal-remember">
									<input
										type="checkbox"
										checked={remember}
										onChange={(e) => setRemember(e.target.checked)}
									/>
									Remember me
								</label>
								<a className="lp-modal-contact" href="#contact" onClick={closeLogin}>
									Contact Admin for access
								</a>
							</div>
							<button type="submit" className="lp-modal-submit" disabled={submitting}>
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
.lp{
	--ink:#060a14; --steel:#0d1526; --cyan:#5ad4ff; --white:#eef6ff;
	--mono:'SFMono-Regular',Consolas,'Courier New',monospace;
	background:var(--ink); color:var(--white);
	font-family:'Segoe UI',Roboto,Arial,sans-serif;
	overflow-x:hidden; width:100%;
}
.lp a{ text-decoration:none; }

/* ---------- STAGE ---------- */
.lp-stage{ position:relative; width:100%; height:100vh; min-height:600px; overflow:hidden; background:var(--ink); }
.lp-stage-bg{ position:absolute; inset:0; z-index:0; background:radial-gradient(circle at 50% 38%, #0d1526 0%, #060a14 72%); }
.lp-slides{ position:absolute; inset:0; z-index:0; overflow:hidden; }
.lp-slide{ position:absolute; inset:0; opacity:0; transition:opacity 1.4s ease; }
.lp-slide.active{ opacity:1; }
.lp-slide img{ position:absolute; top:50%; left:50%; min-width:106%; min-height:106%; width:auto; height:auto; max-width:none; transform:translate(-50%,-50%) scale(1.06); filter:saturate(1.08) contrast(1.03) brightness(0.8); will-change:transform; }
.lp-slide.active .lp-kb-0{ animation:lp-kbA 16s ease-in-out forwards; }
.lp-slide.active .lp-kb-1{ animation:lp-kbB 16s ease-in-out forwards; }
.lp-slide.active .lp-kb-2{ animation:lp-kbC 16s ease-in-out forwards; }
@keyframes lp-kbA{ 0%{ transform:translate(-50%,-50%) scale(1.22) translate(3%,1%); } 100%{ transform:translate(-50%,-50%) scale(1.0) translate(-5%,-3%); } }
@keyframes lp-kbB{ 0%{ transform:translate(-50%,-50%) scale(1.0) translate(-4%,2%); } 100%{ transform:translate(-50%,-50%) scale(1.26) translate(4%,-2.5%); } }
@keyframes lp-kbC{ 0%{ transform:translate(-50%,-50%) scale(1.2) translate(-3%,-3%); } 100%{ transform:translate(-50%,-50%) scale(1.0) translate(5%,2%); } }
.lp-scan{ position:absolute; inset:-20% -20%; z-index:1; pointer-events:none; background:linear-gradient(100deg, transparent 42%, rgba(90,212,255,0.10) 50%, transparent 58%); background-size:250% 250%; animation:lp-sweep 5.5s linear infinite; mix-blend-mode:screen; }
@keyframes lp-sweep{ 0%{ background-position:130% 130%; } 100%{ background-position:-30% -30%; } }
.lp-netlayer{ position:absolute; inset:0; z-index:2; width:100%; height:100%; pointer-events:none; mix-blend-mode:screen; opacity:0.9; }
.lp-netline{ fill:none; stroke:var(--cyan); stroke-width:1.4; stroke-linecap:round; filter:drop-shadow(0 0 4px rgba(90,212,255,0.9)); stroke-dasharray:8 14; animation:lp-dash 3.2s linear infinite; opacity:0.7; }
.lp-netline.slow{ animation-duration:5.4s; opacity:0.4; stroke-width:1; }
.lp-netline.fast{ animation-duration:1.9s; opacity:0.9; }
@keyframes lp-dash{ to{ stroke-dashoffset:-220; } }
.lp-node{ fill:var(--cyan); filter:drop-shadow(0 0 6px rgba(90,212,255,1)); animation:lp-nodepulse 2.4s ease-in-out infinite; }
@keyframes lp-nodepulse{ 0%,100%{ opacity:0.55; } 50%{ opacity:1; } }
.lp-particles{ position:absolute; inset:0; z-index:3; pointer-events:none; }
.lp-p{ position:absolute; bottom:-10px; width:3px; height:3px; border-radius:50%; background:var(--cyan); box-shadow:0 0 8px 2px rgba(90,212,255,0.85); animation-name:lp-rise; animation-timing-function:linear; animation-iteration-count:infinite; }
@keyframes lp-rise{ 0%{ transform:translateY(0) translateX(0); opacity:0; } 10%{ opacity:0.9; } 90%{ opacity:0.6; } 100%{ transform:translateY(-115vh) translateX(var(--drift,20px)); opacity:0; } }
.lp-veil{ position:absolute; inset:0; z-index:3; pointer-events:none; background:linear-gradient(180deg, rgba(3,6,14,0.5) 0%, rgba(3,6,14,0.12) 30%, rgba(3,6,14,0.12) 55%, rgba(3,6,14,0.75) 100%); }

/* top bar */
.lp-topbar{
	position:absolute; top:18px; left:50%; transform:translateX(-50%); z-index:9;
	display:flex; flex-wrap:nowrap; align-items:center; justify-content:flex-start;
	gap:clamp(12px,2.2vw,42px); width:92vw; max-width:1400px;
}
.lp-brand{
	font-family:var(--mono); font-size:clamp(16px,2vw,26px); font-weight:700; letter-spacing:0.05em;
	color:var(--white); display:flex; align-items:center; gap:10px; white-space:nowrap; text-decoration:none; cursor:pointer;
}
.lp-logo{ width:clamp(22px,2.4vw,32px); height:clamp(22px,2.4vw,32px); flex-shrink:0; filter:drop-shadow(0 0 8px rgba(255,255,255,0.6)); }
.lp-nav{ display:flex; flex-wrap:nowrap; justify-content:flex-end; gap:clamp(8px,1.2vw,20px); margin-left:auto; }
.lp-nav a{
	font-family:var(--mono); font-size:clamp(13px,1.25vw,17px); font-weight:700; letter-spacing:0.02em;
	text-transform:uppercase; color:var(--white); padding-bottom:3px; border-bottom:1px solid transparent;
	transition:color .2s ease,border-color .2s ease; white-space:nowrap;
}
.lp-nav a:hover{ color:var(--cyan); border-color:rgba(90,212,255,0.6); }
.lp-login-btn{
	background:rgba(255,255,255,0.06); border:1.5px solid var(--white); color:var(--white);
	font-family:var(--mono); font-weight:700; font-size:clamp(13px,1.25vw,17px); letter-spacing:0.1em;
	text-transform:uppercase; padding:9px 18px; white-space:nowrap;
	transition:background .25s ease,color .25s ease,box-shadow .25s ease;
}
.lp-login-btn:hover{ background:var(--cyan); color:#04101c; box-shadow:0 0 18px rgba(90,212,255,0.6); }

/* status */
.lp-status{
	position:absolute; top:74px; left:50%; transform:translateX(-50%); z-index:6;
	font-family:var(--mono); font-size:11px; letter-spacing:0.2em; color:rgba(90,212,255,0.85);
	display:flex; gap:10px; align-items:center; pointer-events:none; white-space:nowrap;
}
.lp-dot{ width:6px; height:6px; border-radius:50%; background:var(--cyan); box-shadow:0 0 8px rgba(90,212,255,1); animation:lp-blink 1.4s ease-in-out infinite; }
@keyframes lp-blink{ 0%,100%{opacity:1;} 50%{opacity:0.25;} }

/* orbits */
.lp-orbit{ position:absolute; top:46%; left:52%; z-index:4; pointer-events:none; border:1px solid rgba(90,212,255,0.5); border-radius:50%; transform:translate(-50%,-50%); box-shadow:0 0 18px rgba(90,212,255,0.15) inset; }
.lp-o1{ width:220px; height:220px; animation:lp-spin 10s linear infinite; border-style:dashed; }
.lp-o2{ width:300px; height:300px; animation:lp-spinrev 16s linear infinite; opacity:0.4; }
.lp-o3{ width:160px; height:160px; animation:lp-spin 7s linear infinite reverse; opacity:0.7; }
@keyframes lp-spin{ to{ transform:translate(-50%,-50%) rotate(360deg); } }
@keyframes lp-spinrev{ from{ transform:translate(-50%,-50%) rotate(360deg); } to{ transform:translate(-50%,-50%) rotate(0deg); } }
.lp-tick{ position:absolute; width:6px; height:6px; background:var(--cyan); border-radius:50%; top:-3px; left:50%; box-shadow:0 0 8px rgba(90,212,255,1); }

/* radar */
.lp-radar{ position:absolute; width:300px; height:300px; top:8%; right:4%; z-index:4; pointer-events:none; border-radius:50%; opacity:0.55; }
.lp-radar svg{ width:100%; height:100%; }
.lp-ring{ fill:none; stroke:rgba(90,212,255,0.4); stroke-width:1; }
.lp-sweeparm{ transform-origin:100px 100px; animation:lp-radarspin 4s linear infinite; }
@keyframes lp-radarspin{ to{ transform:rotate(360deg); } }

/* hero content (bottom-left) */
.lp-hero-content{ position:absolute; inset:0; z-index:6; display:flex; flex-direction:column; justify-content:flex-end; padding:6vh 6vw calc(6vh + 40px); pointer-events:none; }
.lp-eyebrow{ font-family:var(--mono); letter-spacing:0.42em; text-transform:uppercase; font-size:14px; font-weight:700; color:var(--white); text-shadow:0 2px 14px rgba(0,0,0,.75); }
.lp-h1{ font-size:clamp(28px,5vw,58px); font-weight:700; line-height:1.05; max-width:16ch; margin-top:14px; letter-spacing:-0.01em; text-shadow:0 4px 24px rgba(0,0,0,.7); }
.lp-sub{ margin-top:16px; max-width:52ch; font-size:clamp(14px,1.6vw,17px); color:rgba(238,246,255,0.85); line-height:1.55; text-shadow:0 2px 14px rgba(0,0,0,.7); }
.lp-hero-actions{ margin-top:26px; display:flex; gap:14px; flex-wrap:wrap; pointer-events:auto; }
.lp-btn-primary{ padding:13px 28px; font-weight:700; font-size:.95rem; background:linear-gradient(135deg,#5fd6ff,#2f8fd0); color:#02131f; box-shadow:0 8px 24px -8px rgba(95,214,255,.7); }
.lp-btn-ghost{ padding:13px 28px; font-weight:700; font-size:.95rem; border:1px solid rgba(255,255,255,.5); color:#eaf6ff; background:rgba(0,0,0,.25); }
.lp-btn-primary:hover{ box-shadow:0 0 22px rgba(90,212,255,0.65); }
.lp-btn-ghost:hover{ border-color:var(--cyan); color:var(--cyan); }

/* ticker */
.lp-ticker{ position:absolute; bottom:0; left:0; right:0; height:34px; overflow:hidden; z-index:7; background:linear-gradient(90deg,rgba(90,212,255,0.14),rgba(3,6,14,0.7)); border-top:1px solid rgba(90,212,255,0.4); pointer-events:none; }
.lp-ticker-track{ position:absolute; white-space:nowrap; font-family:var(--mono); font-size:13px; font-weight:700; letter-spacing:0.14em; color:var(--white); line-height:34px; animation:lp-tick 26s linear infinite; }
@keyframes lp-tick{ from{ transform:translateX(0);} to{ transform:translateX(-50%);} }

/* ---------- SECTIONS ---------- */
.lp-section{ position:relative; background:var(--steel); padding:80px 8vw 90px; border-top:1px solid rgba(90,212,255,0.12); overflow:hidden; }
.lp-section::before{ content:""; position:absolute; inset:0; pointer-events:none; background:radial-gradient(circle at 15% 20%, rgba(90,212,255,0.07), transparent 40%),radial-gradient(circle at 85% 80%, rgba(90,212,255,0.05), transparent 40%); }
.lp-inner{ position:relative; max-width:1180px; margin:0 auto; }
.lp-section-eyebrow{ font-family:var(--mono); letter-spacing:0.32em; text-transform:uppercase; font-size:11px; color:var(--cyan); display:flex; align-items:center; gap:8px; }
.lp-glyph{ width:7px; height:7px; background:var(--cyan); box-shadow:0 0 8px rgba(90,212,255,1); }
.lp-section-title{ font-size:clamp(24px,3.4vw,40px); font-weight:700; margin-top:14px; max-width:18ch; letter-spacing:-0.01em; }
.lp-section-sub{ margin-top:14px; max-width:60ch; color:rgba(238,246,255,0.68); font-size:15px; line-height:1.7; }

/* about */
.lp-about-grid{ margin-top:44px; display:grid; grid-template-columns:repeat(3,1fr); gap:22px; }
.lp-about-card{ background:rgba(255,255,255,0.03); border:1px solid rgba(90,212,255,0.15); padding:26px 22px; }
.lp-about-card .lp-num{ font-family:var(--mono); color:var(--cyan); font-size:12px; letter-spacing:0.2em; }
.lp-about-card h4{ margin-top:10px; font-size:17px; }
.lp-about-card p{ margin-top:8px; font-size:13.5px; color:rgba(238,246,255,0.6); line-height:1.6; }

/* solutions */
.lp-sol-list{ margin-top:48px; display:flex; flex-direction:column; gap:56px; }
.lp-sol-row{ display:flex; align-items:center; gap:48px; }
.lp-sol-row:nth-child(even){ flex-direction:row-reverse; }
.lp-sol-media{ width:300px; height:300px; flex-shrink:0; overflow:hidden; border:1px solid rgba(90,212,255,0.3); background:#0a1526; box-shadow:0 12px 40px rgba(0,0,0,0.45); }
.lp-sol-media svg,.lp-sol-media img{ width:300px; height:300px; object-fit:cover; display:block; }
.lp-sol-body{ flex:1; min-width:0; }
.lp-tag{ display:inline-block; font-family:var(--mono); font-size:9.5px; letter-spacing:0.16em; text-transform:uppercase; color:var(--cyan); background:rgba(90,212,255,0.1); border:1px solid rgba(90,212,255,0.3); padding:3px 9px; }
.lp-sol-name{ margin:12px 0 12px; font-size:22px; font-weight:800; letter-spacing:0.01em; }
.lp-sol-desc{ font-size:14px; color:rgba(238,246,255,0.7); line-height:1.75; }
.lp-sol-link{ display:inline-block; margin-top:16px; font-family:var(--mono); font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--cyan); border:1px solid rgba(90,212,255,0.5); padding:9px 18px; transition:background .2s ease,color .2s ease; }
.lp-sol-link:hover{ background:var(--cyan); color:#04101c; }

/* careers */
.lp-careers-list{ margin-top:40px; display:flex; flex-direction:column; gap:1px; background:rgba(90,212,255,0.15); }
.lp-career-row{ background:var(--steel); display:flex; align-items:center; justify-content:space-between; gap:20px; padding:20px 22px; flex-wrap:wrap; }
.lp-role{ font-size:15.5px; font-weight:600; }
.lp-meta{ font-family:var(--mono); font-size:11px; letter-spacing:0.1em; color:rgba(238,246,255,0.55); margin-top:4px; }
.lp-career-apply{ font-family:var(--mono); font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:var(--cyan); border:1px solid rgba(90,212,255,0.5); padding:9px 16px; white-space:nowrap; transition:background .2s ease,color .2s ease; }
.lp-career-apply:hover{ background:var(--cyan); color:#04101c; }

/* contact */
.lp-contact-wrap{ margin-top:44px; display:grid; grid-template-columns:1fr 1fr; gap:40px; }
.lp-crow{ display:flex; gap:14px; margin-bottom:20px; }
.lp-dot2{ width:8px; height:8px; margin-top:6px; background:var(--cyan); box-shadow:0 0 8px rgba(90,212,255,1); flex-shrink:0; }
.lp-clabel{ font-family:var(--mono); font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:rgba(238,246,255,0.5); }
.lp-cval{ font-size:14.5px; margin-top:4px; }
.lp-contact-form{ display:flex; flex-direction:column; gap:14px; }
.lp-contact-form input,.lp-contact-form textarea{ background:rgba(255,255,255,0.03); border:1px solid rgba(238,246,255,0.18); color:var(--white); font-size:14px; padding:12px 13px; font-family:inherit; }
.lp-contact-form textarea{ min-height:110px; resize:vertical; }
.lp-contact-form button{ align-self:flex-start; background:var(--cyan); color:#04101c; border:none; font-family:var(--mono); font-weight:700; letter-spacing:0.18em; text-transform:uppercase; font-size:12px; padding:13px 26px; cursor:pointer; transition:box-shadow .25s ease; }
.lp-contact-form button:hover{ box-shadow:0 0 24px rgba(90,212,255,0.65); }

/* footer */
.lp-footer{ position:relative; background:var(--ink); border-top:1px solid rgba(90,212,255,0.14); padding:64px 8vw 28px; }
.lp-footer-inner{ max-width:1180px; margin:0 auto; }
.lp-footer-grid{ display:grid; grid-template-columns:1.4fr 1fr 1fr 1fr 0.9fr; gap:28px; }
.lp-footer-brand{ display:flex; align-items:center; gap:10px; font-family:var(--mono); font-weight:700; letter-spacing:0.06em; font-size:14px; color:var(--white); }
.lp-footer-brand .lp-logo{ width:28px; height:28px; }
.lp-footer-tagline{ margin-top:14px; font-size:13px; color:rgba(238,246,255,0.55); line-height:1.7; max-width:34ch; }
.lp-footer-heading{ font-family:var(--mono); font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:var(--cyan); margin-bottom:16px; }
.lp-footer-links{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:11px; }
.lp-footer-links a{ color:rgba(238,246,255,0.68); font-size:13px; transition:color .2s ease; }
.lp-footer-links a:hover{ color:var(--cyan); }
.lp-footer-social{ display:flex; gap:12px; }
.lp-footer-social a{ width:34px; height:34px; border-radius:50%; border:1px solid rgba(90,212,255,0.3); display:flex; align-items:center; justify-content:center; color:var(--white); transition:border-color .2s ease,color .2s ease; }
.lp-footer-social a:hover{ border-color:var(--cyan); color:var(--cyan); }
.lp-footer-social svg{ width:15px; height:15px; }
.lp-footer-bottom{ margin-top:48px; padding-top:22px; border-top:1px solid rgba(90,212,255,0.12); display:flex; align-items:center; justify-content:center; font-size:12.5px; color:rgba(238,246,255,0.45); }

@media (max-width:900px){
	.lp-footer-grid{ grid-template-columns:1fr 1fr; }
	.lp-sol-row,.lp-sol-row:nth-child(even){ flex-direction:column; text-align:center; }
	.lp-sol-media{ width:100%; max-width:300px; margin:0 auto; }
	.lp-status{ display:none; }
}
@media (max-width:820px){
	.lp-about-grid{ grid-template-columns:1fr; }
	.lp-contact-wrap{ grid-template-columns:1fr; }
	.lp-nav{ display:none; }
	.lp-radar{ width:180px; height:180px; }
	.lp-o2{ display:none; }
}

/* admin sign in modal */
.lp-modal-overlay{
	position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px;
	background:rgba(6,10,20,0.1);
	-webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px);
	animation:lp-fade .2s ease;
}
@keyframes lp-fade{ from{ opacity:0; } to{ opacity:1; } }
.lp-modal{
	position:relative; width:100%; max-width:420px;
	background:rgba(10,17,32,0.92); border:1px solid rgba(90,212,255,0.45);
	box-shadow:0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(90,212,255,0.08);
	padding:30px 30px 32px; color:var(--white); animation:lp-pop .22s ease;
}
@keyframes lp-pop{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
.lp-modal-close{
	position:absolute; top:14px; right:14px; width:30px; height:30px; line-height:1;
	background:rgba(255,255,255,0.06); border:1px solid rgba(238,246,255,0.2); color:var(--white);
	font-size:20px; cursor:pointer; transition:background .2s ease,border-color .2s ease;
}
.lp-modal-close:hover{ background:rgba(255,255,255,0.14); border-color:var(--cyan); }
.lp-modal-eyebrow{ display:flex; align-items:center; gap:8px; font-family:var(--mono); font-size:10px; letter-spacing:0.28em; text-transform:uppercase; color:var(--cyan); }
.lp-modal-sq{ width:9px; height:9px; background:var(--cyan); box-shadow:0 0 8px rgba(90,212,255,0.9); }
.lp-modal-title{ margin:12px 0 6px; font-size:22px; font-weight:700; color:var(--white); }
.lp-modal-sub{ margin:0 0 22px; font-size:13px; line-height:1.6; color:rgba(238,246,255,0.6); }
.lp-modal-label{ display:block; font-family:var(--mono); font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:rgba(238,246,255,0.55); margin-bottom:7px; }
.lp-modal-input{
	width:100%; box-sizing:border-box; background:rgba(255,255,255,0.04); border:1px solid rgba(90,212,255,0.35);
	color:var(--white); font-size:14px; padding:12px 13px; font-family:inherit; margin-bottom:18px; outline:none;
	transition:border-color .2s ease,box-shadow .2s ease;
}
.lp-modal-input:focus{ border-color:var(--cyan); box-shadow:0 0 0 3px rgba(90,212,255,0.18); }
.lp-modal-input::placeholder{ color:rgba(238,246,255,0.35); }
.lp-modal-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:22px; }
.lp-modal-remember{ display:flex; align-items:center; gap:8px; font-size:12.5px; color:rgba(238,246,255,0.75); cursor:pointer; }
.lp-modal-remember input{ accent-color:var(--cyan); width:14px; height:14px; }
.lp-modal-contact{ font-size:12.5px; color:rgba(238,246,255,0.6); transition:color .2s ease; }
.lp-modal-contact:hover{ color:var(--cyan); }
.lp-modal-submit{
	width:100%; background:var(--cyan); color:#04101c; border:none; cursor:pointer;
	font-family:var(--mono); font-weight:700; letter-spacing:0.2em; text-transform:uppercase; font-size:13px; padding:14px;
	transition:box-shadow .25s ease,opacity .2s ease;
}
.lp-modal-submit:hover{ box-shadow:0 0 24px rgba(90,212,255,0.6); }
.lp-modal-submit:disabled{ opacity:0.6; cursor:default; box-shadow:none; }
`;
