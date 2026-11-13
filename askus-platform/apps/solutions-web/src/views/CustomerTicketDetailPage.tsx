import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Spin, message } from 'antd';
import CustomerPortalLayout from '../components/CustomerPortalLayout';
import customerApi, { type CustomerTicket } from '../api/customerApi';

export default function CustomerTicketDetailPage() {
	const { id } = useParams();
	const [ticket, setTicket] = useState<CustomerTicket | null>(null);
	const [loading, setLoading] = useState(true);
	const [reply, setReply] = useState('');
	const [sending, setSending] = useState(false);

	const load = () => {
		if (!id) return;
		customerApi.getTicketById(id)
			.then(setTicket)
			.catch((err) => message.error((err as Error).message || 'Failed to load ticket'))
			.finally(() => setLoading(false));
	};

	useEffect(load, [id]);

	const handleReply = async () => {
		if (!id || !reply.trim()) return;
		setSending(true);
		try {
			await customerApi.addComment(id, reply);
			setReply('');
			load();
		} catch (err) {
			message.error((err as Error).message || 'Failed to send reply');
		} finally {
			setSending(false);
		}
	};

	if (loading) {
		return <CustomerPortalLayout><div style={{ textAlign: 'center', padding: 60 }}><Spin /></div></CustomerPortalLayout>;
	}

	if (!ticket) {
		return <CustomerPortalLayout><div>Ticket not found.</div></CustomerPortalLayout>;
	}

	return (
		<CustomerPortalLayout>
			<Link to="/customer/tickets" style={styles.backLink}>← Back to My Tickets</Link>

			<div style={styles.headerCard}>
				<div style={styles.ticketNumber}>{ticket.ticketNumber} · {ticket.ticketType}</div>
				<h1 style={styles.title}>{ticket.title}</h1>
				<div style={styles.badgeRow}>
					<span style={styles.badge}>{ticket.status}</span>
					<span style={styles.badgeMuted}>{ticket.priority} priority</span>
				</div>
				{ticket.supportTicketData?.description && (
					<p style={styles.description}>{ticket.supportTicketData.description}</p>
				)}
			</div>

			<h2 style={styles.subTitle}>Activity</h2>
			<div style={styles.timeline}>
				{ticket.activityLog.map((log) => (
					<div key={log.id} style={styles.timelineItem}>
						<div style={styles.timelineHeader}>
							<strong>{log.performedByName}</strong> {log.action}
							<span style={styles.timelineDate}>{new Date(log.createdAt).toLocaleString()}</span>
						</div>
						{log.note && <div style={styles.timelineNote}>{log.note}</div>}
					</div>
				))}
			</div>

			<div style={styles.replyBox}>
				<textarea
					value={reply}
					onChange={(e) => setReply(e.target.value)}
					style={styles.textarea}
					rows={3}
					placeholder="Write a reply…"
				/>
				<button type="button" style={styles.replyBtn} onClick={handleReply} disabled={sending}>
					{sending ? 'Sending…' : 'Send Reply'}
				</button>
			</div>
		</CustomerPortalLayout>
	);
}

const styles: Record<string, React.CSSProperties> = {
	backLink: {
		display: 'inline-block',
		marginBottom: 20,
		color: '#5b6b83',
		fontWeight: 600,
		fontSize: '.88rem',
		textDecoration: 'none',
	},
	headerCard: {
		background: '#FFF',
		borderRadius: 14,
		padding: '24px 26px',
		border: '1px solid #E7ECF3',
	},
	ticketNumber: {
		fontSize: '.8rem',
		fontWeight: 700,
		color: '#5b6b83',
		letterSpacing: 0.4,
	},
	title: {
		margin: '6px 0 0',
		fontSize: '1.3rem',
		fontWeight: 800,
		color: '#0F2747',
	},
	badgeRow: {
		marginTop: 12,
		display: 'flex',
		gap: 8,
	},
	badge: {
		background: 'rgba(200,16,46,.1)',
		color: '#C8102E',
		fontSize: '.78rem',
		fontWeight: 700,
		padding: '4px 10px',
		borderRadius: 999,
	},
	badgeMuted: {
		background: '#F4F7FB',
		color: '#5b6b83',
		fontSize: '.78rem',
		fontWeight: 600,
		padding: '4px 10px',
		borderRadius: 999,
	},
	description: {
		marginTop: 16,
		color: '#334155',
		fontSize: '.92rem',
		lineHeight: 1.6,
	},
	subTitle: {
		marginTop: 28,
		marginBottom: 12,
		fontSize: '1.05rem',
		fontWeight: 800,
		color: '#0F2747',
	},
	timeline: {
		display: 'flex',
		flexDirection: 'column',
		gap: 10,
	},
	timelineItem: {
		background: '#FFF',
		borderRadius: 10,
		padding: '14px 16px',
		border: '1px solid #E7ECF3',
		fontSize: '.88rem',
	},
	timelineHeader: {
		color: '#334155',
	},
	timelineDate: {
		float: 'right',
		color: '#94a3b8',
		fontSize: '.78rem',
	},
	timelineNote: {
		marginTop: 6,
		color: '#5b6b83',
	},
	replyBox: {
		marginTop: 24,
	},
	textarea: {
		width: '100%',
		padding: '12px 14px',
		borderRadius: 8,
		border: '1px solid #E7ECF3',
		fontSize: '.9rem',
		boxSizing: 'border-box',
		fontFamily: 'inherit',
		resize: 'vertical',
	},
	replyBtn: {
		marginTop: 12,
		padding: '11px 24px',
		borderRadius: 8,
		border: 0,
		background: '#0F2747',
		color: '#FFF',
		fontWeight: 700,
		fontSize: '.9rem',
		cursor: 'pointer',
	},
};
