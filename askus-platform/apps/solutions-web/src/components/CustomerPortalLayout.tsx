import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { CUSTOMER_KEYS, clearSession } from '../api/session';

export default function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
	const navigate = useNavigate();
	const customerRaw = sessionStorage.getItem('askus_customer');
	const customer = customerRaw ? JSON.parse(customerRaw) : null;

	const handleLogout = () => {
		clearSession(CUSTOMER_KEYS);
		sessionStorage.removeItem('askus_customer');
		navigate('/customer/login', { replace: true });
	};

	return (
		<div style={styles.page}>
			<header style={styles.header}>
				<div style={styles.headerInner}>
					<Link to="/customer/tickets" style={styles.brand}>ASK US SOLUTIONS · My Account</Link>
					<nav style={styles.nav}>
						<NavLink to="/customer/tickets" style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}>
							My Tickets
						</NavLink>
						<NavLink to="/customer/tickets/new" style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}>
							New Ticket
						</NavLink>
						<Link to="/help" style={styles.navLink}>Help Center</Link>
						<span style={styles.customerName}>{customer?.name}</span>
						<button type="button" style={styles.logoutBtn} onClick={handleLogout}>Log out</button>
					</nav>
				</div>
			</header>
			<main style={styles.main}>{children}</main>
		</div>
	);
}

const styles: Record<string, React.CSSProperties> = {
	page: {
		minHeight: '100vh',
		background: '#F4F7FB',
		fontFamily: "'Segoe UI', system-ui, sans-serif",
	},
	header: {
		background: 'linear-gradient(180deg, #0F2747 0%, #143B69 100%)',
		boxShadow: '0 2px 16px rgba(15, 39, 71, 0.25)',
	},
	headerInner: {
		maxWidth: 1100,
		margin: '0 auto',
		padding: '16px 24px',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 16,
		flexWrap: 'wrap',
	},
	brand: {
		fontWeight: 800,
		fontSize: 16,
		color: '#FFF',
		textDecoration: 'none',
		whiteSpace: 'nowrap',
	},
	nav: {
		display: 'flex',
		alignItems: 'center',
		gap: 20,
		flexWrap: 'wrap',
	},
	navLink: {
		color: 'rgba(255,255,255,0.82)',
		textDecoration: 'none',
		fontWeight: 600,
		fontSize: 14,
	},
	navLinkActive: {
		color: '#FFF',
	},
	customerName: {
		color: 'rgba(255,255,255,0.7)',
		fontSize: 13,
	},
	logoutBtn: {
		background: '#C8102E',
		color: '#FFF',
		border: 0,
		fontWeight: 700,
		fontSize: 13,
		padding: '8px 16px',
		borderRadius: 999,
		cursor: 'pointer',
	},
	main: {
		maxWidth: 1100,
		margin: '0 auto',
		padding: '32px 24px 64px',
	},
};
