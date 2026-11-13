import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spin, message } from 'antd';
import CustomerPortalLayout from '../components/CustomerPortalLayout';
import customerApi, { type CustomerTicket } from '../api/customerApi';

const statusColors: Record<string, string> = {
	Open: '#C8102E',
	InProgress: '#B8860B',
	Completed: '#1E8E3E',
	Closed: '#5b6b83',
};

export default function CustomerTicketsPage() {
	const [tickets, setTickets] = useState<CustomerTicket[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		customerApi.getTickets()
			.then(setTickets)
			.catch((err) => message.error((err as Error).message || 'Failed to load tickets'))
			.finally(() => setLoading(false));
	}, []);

	return (
		<CustomerPortalLayout>
			<div style={styles.headerRow}>
				<h1 style={styles.title}>My Tickets</h1>
				<Link to="/customer/tickets/new" style={styles.newBtn}>+ New Ticket</Link>
			</div>

			{loading ? (
				<div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
			) : tickets.length === 0 ? (
				<div style={styles.empty}>
					<div style={{ fontSize: 15, fontWeight: 700, color: '#0F2747' }}>No tickets yet</div>
					<div style={{ marginTop: 6, color: '#5b6b83', fontSize: 13 }}>Raise a ticket if you need help with 02 Taxi, Alphaa Insurance, or Alphaa Loans.</div>
				</div>
			) : (
				<div style={styles.list}>
					{tickets.map((t) => (
						<Link key={t.id} to={`/customer/tickets/${t.id}`} style={styles.row}>
							<div>
								<div style={styles.rowTitle}>{t.title}</div>
								<div style={styles.rowMeta}>{t.ticketNumber} · {t.ticketType}</div>
							</div>
							<span style={{ ...styles.badge, color: statusColors[t.status] || '#5b6b83' }}>{t.status}</span>
						</Link>
					))}
				</div>
			)}
		</CustomerPortalLayout>
	);
}

const styles: Record<string, React.CSSProperties> = {
	headerRow: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 24,
		flexWrap: 'wrap',
		gap: 12,
	},
	title: {
		margin: 0,
		fontSize: '1.5rem',
		fontWeight: 800,
		color: '#0F2747',
	},
	newBtn: {
		background: '#C8102E',
		color: '#FFF',
		textDecoration: 'none',
		fontWeight: 700,
		fontSize: '.88rem',
		padding: '10px 18px',
		borderRadius: 8,
	},
	empty: {
		background: '#FFF',
		borderRadius: 14,
		padding: '40px 24px',
		textAlign: 'center',
		border: '1px solid #E7ECF3',
	},
	list: {
		display: 'flex',
		flexDirection: 'column',
		gap: 12,
	},
	row: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		background: '#FFF',
		borderRadius: 12,
		padding: '16px 20px',
		border: '1px solid #E7ECF3',
		textDecoration: 'none',
		gap: 12,
	},
	rowTitle: {
		fontWeight: 700,
		color: '#0F2747',
		fontSize: '.95rem',
	},
	rowMeta: {
		marginTop: 4,
		fontSize: '.8rem',
		color: '#5b6b83',
	},
	badge: {
		fontWeight: 700,
		fontSize: '.8rem',
		whiteSpace: 'nowrap',
	},
};
