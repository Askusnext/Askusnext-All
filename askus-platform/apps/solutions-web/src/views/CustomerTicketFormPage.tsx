import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import CustomerPortalLayout from '../components/CustomerPortalLayout';
import customerApi from '../api/customerApi';

const ticketTypes = [
	{ value: 'O2Taxi', label: '02 Taxi' },
	{ value: 'Insurance', label: 'Alphaa Insurance' },
	{ value: 'Support', label: 'Alphaa Loans / General Support' },
];

const priorities = ['Low', 'Medium', 'High'];

export default function CustomerTicketFormPage() {
	const [title, setTitle] = useState('');
	const [ticketType, setTicketType] = useState('O2Taxi');
	const [priority, setPriority] = useState('Medium');
	const [description, setDescription] = useState('');
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	const handleSubmit = async () => {
		if (!title.trim()) {
			message.error('Please describe your issue in the title');
			return;
		}
		setLoading(true);
		try {
			const ticket = await customerApi.createTicket({ title, ticketType, priority, description });
			message.success('Ticket raised');
			navigate(`/customer/tickets/${ticket.id}`, { replace: true });
		} catch (err) {
			message.error((err as Error).message || 'Failed to raise ticket');
		} finally {
			setLoading(false);
		}
	};

	return (
		<CustomerPortalLayout>
			<h1 style={styles.title}>Raise a New Ticket</h1>

			<div style={styles.card}>
				<label style={styles.label}>Which product is this about?</label>
				<div style={styles.pillRow}>
					{ticketTypes.map((t) => (
						<button
							key={t.value}
							type="button"
							style={{ ...styles.pill, ...(ticketType === t.value ? styles.pillActive : {}) }}
							onClick={() => setTicketType(t.value)}
						>
							{t.label}
						</button>
					))}
				</div>

				<label style={styles.label}>Subject</label>
				<input value={title} onChange={(e) => setTitle(e.target.value)} style={styles.input} placeholder="Briefly describe your issue" />

				<label style={styles.label}>Priority</label>
				<div style={styles.pillRow}>
					{priorities.map((p) => (
						<button
							key={p}
							type="button"
							style={{ ...styles.pill, ...(priority === p ? styles.pillActive : {}) }}
							onClick={() => setPriority(p)}
						>
							{p}
						</button>
					))}
				</div>

				<label style={styles.label}>Details</label>
				<textarea
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					style={styles.textarea}
					rows={5}
					placeholder="Tell us more about what happened"
				/>

				<button type="button" style={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
					{loading ? 'Submitting…' : 'Submit Ticket'}
				</button>
			</div>
		</CustomerPortalLayout>
	);
}

const styles: Record<string, React.CSSProperties> = {
	title: {
		margin: '0 0 20px',
		fontSize: '1.5rem',
		fontWeight: 800,
		color: '#0F2747',
	},
	card: {
		background: '#FFF',
		borderRadius: 14,
		padding: '28px 28px',
		border: '1px solid #E7ECF3',
		maxWidth: 560,
	},
	label: {
		display: 'block',
		marginTop: 20,
		marginBottom: 8,
		fontSize: '.82rem',
		fontWeight: 700,
		color: '#0F2747',
	},
	pillRow: {
		display: 'flex',
		gap: 8,
		flexWrap: 'wrap',
	},
	pill: {
		padding: '8px 16px',
		borderRadius: 999,
		border: '1px solid #E7ECF3',
		background: '#F4F7FB',
		color: '#5b6b83',
		fontWeight: 700,
		fontSize: '.82rem',
		cursor: 'pointer',
	},
	pillActive: {
		background: '#0F2747',
		borderColor: '#0F2747',
		color: '#FFF',
	},
	input: {
		width: '100%',
		padding: '11px 14px',
		borderRadius: 8,
		border: '1px solid #E7ECF3',
		fontSize: '.95rem',
		boxSizing: 'border-box',
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
	submitBtn: {
		marginTop: 24,
		padding: '13px 26px',
		borderRadius: 8,
		border: 0,
		background: '#C8102E',
		color: '#FFF',
		fontWeight: 700,
		fontSize: '.95rem',
		cursor: 'pointer',
	},
};
