import { useRef, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowRightOutlined, CloseOutlined, MenuOutlined } from '@ant-design/icons';
import Brand from './Brand';
import StaffLoginModal from './StaffLoginModal';
import '../styles/site.css';
import '../styles/public-pages.css';

const navLinks = [
	{ to: '/home', label: 'Home' },
	{ to: '/about', label: 'About Us' },
	{ to: '/products', label: 'Solutions' },
	{ to: '/careers', label: 'Careers' },
	{ to: '/contact', label: 'Contact' },
];

const products = [
	{ to: '/products/ai-agents', label: 'AskUs AI Agents' },
	{ to: '/products/o2-taxi', label: 'O2 Taxi' },
	{ to: '/products/alphaa-insurance', label: 'Askus Insurance' },
	{ to: '/products/alphaa-loans', label: 'Askus Financial Services' },
];

export default function SiteChrome({ children }: { children: ReactNode }) {
	const [showLogin, setShowLogin] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const menuButton = useRef<HTMLButtonElement>(null);
	const closeLogin = () => setShowLogin(false);

	return (
		<div className="lp" id="home">
			<a className="lp-skip" href="#main-content">Skip to content</a>
			<header className="lp-header">
				<div className="lp-container lp-topbar" onKeyDown={(event) => {
					if (event.key === 'Escape' && menuOpen) {
						setMenuOpen(false);
						menuButton.current?.focus();
					}
				}}>
					<Link to="/home" className="lp-brand" aria-label="Askus Next Global Solutions Private Limited home"><Brand /></Link>
					<nav id="site-navigation" className={`lp-nav${menuOpen ? ' lp-nav-open' : ''}`} aria-label="Main navigation">
						{navLinks.map((link) => (
							<NavLink key={link.to} to={link.to} onClick={() => setMenuOpen(false)}>{link.label}</NavLink>
						))}
					</nav>
					<button className="lp-login" type="button" onClick={() => { setMenuOpen(false); setShowLogin(true); }}>
						Login <ArrowRightOutlined aria-hidden />
					</button>
					<button ref={menuButton} className="lp-menu" type="button" aria-expanded={menuOpen} aria-controls="site-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen(!menuOpen)}>
						{menuOpen ? <CloseOutlined aria-hidden /> : <MenuOutlined aria-hidden />}
					</button>
				</div>
			</header>

			<main className="lp-main" id="main-content" tabIndex={-1}>
				{children}
			</main>

			<footer className="lp-footer">
				<div className="lp-container">
					<div className="lp-footer-grid">
						<div>
							<Link to="/home" className="lp-brand" aria-label="Askus Next Global Solutions Private Limited home"><Brand /></Link>
							<p className="lp-footer-tagline">One intelligence layer.<br />A world of connected possibilities.</p>
						</div>
						<div>
							<h2>Company</h2>
							<ul>{navLinks.filter((link) => link.to !== '/products').map((link) => <li key={link.to}><Link to={link.to}>{link.label}</Link></li>)}</ul>
						</div>
						<div>
							<h2>Our solutions</h2>
							<ul>{products.map((product) => <li key={product.to}><Link to={product.to}>{product.label}</Link></li>)}</ul>
						</div>
						<div>
							<h2>Get in touch</h2>
							<ul><li><Link to="/contact">Contact our team <ArrowRightOutlined aria-hidden /></Link></li><li><button type="button" onClick={() => setShowLogin(true)}>Staff login <ArrowRightOutlined aria-hidden /></button></li></ul>
						</div>
					</div>
					<div className="lp-footer-bottom"><span>&copy; {new Date().getFullYear()} Askus Next Global Solutions Private Limited. All rights reserved.</span><a href="#home">Back to top <span aria-hidden="true">&uarr;</span></a></div>
				</div>
			</footer>
			<StaffLoginModal open={showLogin} onClose={closeLogin} contact={<Link to="/contact" onClick={closeLogin}>Need access? Contact Admin</Link>} />
		</div>
	);
}
