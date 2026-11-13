import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout, useAppDispatch, useAppSelector } from '../store';
import { STAFF_KEYS, clearSession } from '../api/session';
import type { UserRole } from '../types';

type NavItem = {
	to: string;
	label: string;
	roles: UserRole[];
};

const navItems: NavItem[] = [
	{ to: '/dashboard', label: 'Dashboard', roles: ['Admin', 'Employee'] },
	{ to: '/board', label: 'Board', roles: ['Admin', 'Employee'] },
	{ to: '/tickets', label: 'Tickets', roles: ['Admin', 'Employee'] },
	{ to: '/analytics', label: 'Analytics', roles: ['Admin', 'Employee'] },
	{ to: '/calendar', label: 'Calendar', roles: ['Admin', 'Employee'] },
	{ to: '/timesheet', label: 'Timesheet', roles: ['Admin', 'Employee', 'Agent'] },
	{ to: '/renewals', label: 'Renewals', roles: ['Admin'] },
	{ to: '/users', label: 'User Management', roles: ['Admin'] },
];

export default function AppLayout() {
	const dispatch = useAppDispatch();
	const navigate = useNavigate();
	const user = useAppSelector((state) => state.auth.user);
	const role = user?.role ?? 'Agent';
	const isAuthenticated = Boolean(sessionStorage.getItem('tms_token'));

	const visibleItems = navItems.filter((item) => item.roles.includes(role));

	const handleLogout = () => {
		clearSession(STAFF_KEYS);
		dispatch(logout());
		navigate('/home', { replace: true });
	};

	// Unauthenticated visits to "/" resolve to the public landing page (via HomeGate)
	// or get redirected to /login by ProtectedRoute on individual routes — either way,
	// skip the authenticated sidebar chrome so nothing flashes in the meantime.
	if (!isAuthenticated) {
		return <Outlet />;
	}

	return (
		<div style={styles.shell}>
			<aside style={styles.sidebar}>
				<div style={styles.brandBlock}>
					<div style={styles.brand}>AskusNext Global Solutions Private Limited</div>
					<div style={styles.meta}>Insurance Management System</div>
				</div>

				<nav style={styles.nav}>
					{visibleItems.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							style={({ isActive }) => ({
								...styles.navLink,
								...(isActive ? styles.navLinkActive : {}),
							})}
						>
							{item.label}
						</NavLink>
					))}
				</nav>

				<div style={styles.footer}>
					<div style={styles.userName}>{user?.name ?? 'Signed in user'}</div>
					<div style={styles.userRole}>{role}</div>
					<button type="button" style={styles.logoutButton} onClick={handleLogout}>
						Logout
					</button>
				</div>
			</aside>

			<main style={styles.main}>
				<Outlet />
			</main>
		</div>
	);
}

const styles: Record<string, React.CSSProperties> = {
	shell: {
		display: 'grid',
		gridTemplateColumns: '260px minmax(0, 1fr)',
		minHeight: '100vh',
		background: '#F4F7FB',
	},
	sidebar: {
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'space-between',
		padding: '28px 18px',
		background: 'linear-gradient(180deg, #0F2747 0%, #143B69 100%)',
		color: '#FFF',
		boxShadow: '8px 0 24px rgba(15, 39, 71, 0.14)',
	},
	brandBlock: {
		padding: '0 14px',
	},
	brand: {
		fontSize: 28,
		fontWeight: 800,
		lineHeight: 1.15,
	},
	meta: {
		marginTop: 8,
		fontSize: 12,
		letterSpacing: 0.6,
		textTransform: 'uppercase',
		color: 'rgba(255, 255, 255, 0.74)',
	},
	nav: {
		display: 'flex',
		flexDirection: 'column',
		gap: 10,
		marginTop: 32,
	},
	navLink: {
		display: 'block',
		padding: '12px 14px',
		borderRadius: 12,
		color: 'rgba(255, 255, 255, 0.86)',
		textDecoration: 'none',
		fontWeight: 600,
		transition: 'background 160ms ease, color 160ms ease',
	},
	navLinkActive: {
		background: 'rgba(255, 255, 255, 0.14)',
		color: '#FFF',
	},
	footer: {
		marginTop: 24,
		padding: '20px 14px 0',
		borderTop: '1px solid rgba(255, 255, 255, 0.14)',
	},
	userName: {
		fontSize: 15,
		fontWeight: 700,
	},
	userRole: {
		marginTop: 4,
		fontSize: 12,
		color: 'rgba(255, 255, 255, 0.74)',
	},
	logoutButton: {
		marginTop: 16,
		width: '100%',
		border: 0,
		borderRadius: 12,
		padding: '11px 14px',
		background: '#C8102E',
		color: '#FFF',
		fontWeight: 700,
		cursor: 'pointer',
	},
	main: {
		minWidth: 0,
		padding: 24,
	},
};
