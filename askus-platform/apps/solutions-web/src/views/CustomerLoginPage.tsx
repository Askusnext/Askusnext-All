import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import customerApi from '../api/customerApi';

export default function CustomerLoginPage() {
	const [identifier, setIdentifier] = useState('');
	const [code, setCode] = useState('');
	const [codeSent, setCodeSent] = useState(false);
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	const handleSendCode = async () => {
		if (!identifier.trim()) {
			message.error('Enter your mobile number or email');
			return;
		}
		setLoading(true);
		try {
			await customerApi.requestOtp(identifier.trim());
			setCodeSent(true);
			message.success('Verification code sent');
		} catch (err) {
			message.error((err as Error).message || 'Could not send code');
		} finally {
			setLoading(false);
		}
	};

	const handleVerify = async () => {
		if (!/^\d{6}$/.test(code.trim())) {
			message.error('Enter the 6-digit code');
			return;
		}
		setLoading(true);
		try {
			const { customer } = await customerApi.verifyOtp(identifier.trim(), code.trim());
			sessionStorage.setItem('askus_customer', JSON.stringify(customer));
			navigate('/customer/tickets', { replace: true });
		} catch (err) {
			message.error((err as Error).message || 'Login failed');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div style={styles.page}>
			<div style={styles.card}>
				<Link to="/home" style={styles.backLink}>← Back to AskusNext Global Solutions Private Limited</Link>
				<h1 style={styles.title}>Customer Login</h1>
				<p style={styles.subtitle}>Track your 02 Taxi, Alphaa Insurance, or Alphaa Loans support tickets.</p>

				<label style={styles.label}>Mobile number or email</label>
				<input
					type="text"
					value={identifier}
					onChange={(e) => setIdentifier(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && !codeSent && handleSendCode()}
					style={styles.input}
					placeholder="9876543210 or you@example.com"
					readOnly={codeSent}
					autoFocus
				/>

				{codeSent && (
					<>
						<label style={styles.label}>Verification code</label>
						<input
							type="text"
							inputMode="numeric"
							autoComplete="one-time-code"
							maxLength={6}
							value={code}
							onChange={(e) => setCode(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
							style={styles.input}
							placeholder="6-digit code"
							autoFocus
						/>
					</>
				)}

				<button type="button" style={styles.submitBtn} onClick={codeSent ? handleVerify : handleSendCode} disabled={loading}>
					{loading ? 'Please wait…' : codeSent ? 'Verify and Log In' : 'Send Code'}
				</button>

				<p style={styles.footerText}>
					New here? Just enter your mobile or email — your account is created on first sign-in.
				</p>
			</div>
		</div>
	);
}

const styles: Record<string, React.CSSProperties> = {
	page: {
		minHeight: '100vh',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		background: 'linear-gradient(135deg, #0F2747 0%, #143B69 100%)',
		fontFamily: "'Segoe UI', system-ui, sans-serif",
		padding: 24,
	},
	card: {
		background: '#FFF',
		borderRadius: 16,
		padding: '36px 32px',
		width: 400,
		maxWidth: '100%',
		boxShadow: '0 20px 60px rgba(0,0,0,.3)',
	},
	backLink: {
		fontSize: 13,
		fontWeight: 600,
		color: '#5b6b83',
		textDecoration: 'none',
	},
	title: {
		margin: '20px 0 4px',
		fontSize: '1.6rem',
		fontWeight: 800,
		color: '#0F2747',
	},
	subtitle: {
		margin: 0,
		color: '#5b6b83',
		fontSize: '.9rem',
	},
	label: {
		display: 'block',
		marginTop: 20,
		marginBottom: 6,
		fontSize: '.82rem',
		fontWeight: 700,
		color: '#0F2747',
	},
	input: {
		width: '100%',
		padding: '11px 14px',
		borderRadius: 8,
		border: '1px solid #E7ECF3',
		fontSize: '.95rem',
		boxSizing: 'border-box',
	},
	submitBtn: {
		width: '100%',
		marginTop: 26,
		padding: '13px 0',
		borderRadius: 8,
		border: 0,
		background: '#C8102E',
		color: '#FFF',
		fontWeight: 700,
		fontSize: '.95rem',
		cursor: 'pointer',
	},
	footerText: {
		marginTop: 18,
		textAlign: 'center',
		fontSize: '.88rem',
		color: '#5b6b83',
	},
	link: {
		color: '#C8102E',
		fontWeight: 700,
		textDecoration: 'none',
	},
};
