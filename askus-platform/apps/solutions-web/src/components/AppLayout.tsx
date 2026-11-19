import { useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CloseOutlined, MenuOutlined } from '@ant-design/icons';
import { logout, useAppDispatch, useAppSelector } from '../store';
import { STAFF_KEYS, clearSession } from '../api/session';
import { NAV_ITEMS, canOpen } from '../access';
import PresenceGate from './PresenceGate';
import Brand from './Brand';
import { stopPresenceForLogout } from '../presence/session';

export default function AppLayout() {
	const dispatch = useAppDispatch();
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const user = useAppSelector((state) => state.auth.user);
	const isAuthenticated = Boolean(localStorage.getItem('tms_token'));
	const [menuOpen, setMenuOpen] = useState(false);
	const menuButton = useRef<HTMLButtonElement>(null);
	const visibleItems = NAV_ITEMS.filter((item) => canOpen(user, item));

	const handleLogout = () => {
		stopPresenceForLogout(); // End presence while the token is still valid.
		clearSession(STAFF_KEYS);
		dispatch(logout());
		navigate('/home', { replace: true });
	};

	if (!isAuthenticated) return <Outlet />;

	return (
		<div className="workspace">
			<aside className="workspace-sidebar" onKeyDown={(event) => {
				if (event.key === 'Escape' && menuOpen) {
					setMenuOpen(false);
					menuButton.current?.focus();
				}
			}}>
				<div className="workspace-brand-row">
					<Link to="/home" aria-label="Askus Next Global Solutions Private Limited home"><Brand /></Link>
					<button ref={menuButton} className="workspace-menu" type="button" aria-expanded={menuOpen} aria-controls="workspace-navigation" aria-label={menuOpen ? 'Close workspace navigation' : 'Open workspace navigation'} onClick={() => setMenuOpen(!menuOpen)}>
						{menuOpen ? <CloseOutlined aria-hidden /> : <MenuOutlined aria-hidden />}
					</button>
				</div>
				<div id="workspace-navigation" className={`workspace-panel${menuOpen ? ' is-open' : ''}`}>
					<p className="workspace-label">Team workspace</p>
					<nav className="workspace-nav" aria-label="Workspace navigation">
						{visibleItems.map((item) => (
							<NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>
								{item.label}
							</NavLink>
						))}
					</nav>
					<div className="workspace-profile">
						<strong>{user?.name ?? 'Signed in user'}</strong>
						<span>{user?.role === 'SuperAdmin' ? 'Super Admin' : user?.role ?? 'Agent'}</span>
						<div className="workspace-presence"><PresenceGate role={user?.role} /></div>
						<button type="button" className="workspace-logout" onClick={handleLogout}>Logout</button>
					</div>
				</div>
			</aside>
			<main className="workspace-main">
				<div className="workspace-heading">
					<span>Workspace / <strong>{visibleItems.find((item) => pathname.startsWith(item.to))?.label ?? 'Overview'}</strong></span>
					<Link to="/home">Visit website</Link>
				</div>
				<div className="workspace-content"><Outlet /></div>
			</main>
		</div>
	);
}
