import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { CUSTOMER_KEYS, clearSession } from '../api/session';
import Brand from './Brand';

export default function CustomerPortalLayout({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const customerRaw = localStorage.getItem('askus_customer');
	const customer = customerRaw ? JSON.parse(customerRaw) : null;

	const handleLogout = () => {
		clearSession(CUSTOMER_KEYS);
		localStorage.removeItem('askus_customer');
		navigate('/customer/login', { replace: true });
	};

	return (
		<div className="customer-portal">
			<header className="customer-header">
				<div className="customer-header-inner">
					<Link to="/customer/tickets" aria-label="Askus customer account"><Brand /></Link>
					<nav className="customer-nav" aria-label="Customer navigation">
						<NavLink to="/customer/tickets" end>My Tickets</NavLink>
						<NavLink to="/customer/tickets/new">New Ticket</NavLink>
						<Link to="/help">Help Center</Link>
					</nav>
					<div className="customer-account">
						<span>{customer?.name}</span>
						<button type="button" className="workspace-logout" onClick={handleLogout}>Log out</button>
					</div>
				</div>
			</header>
			<main className="customer-main">{children}</main>
			<footer className="customer-footer">Askus Next Global Solutions Private Limited</footer>
		</div>
	);
}
