import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import customerApi from '../api/customerApi';
import { useWhatsAppAvailable } from '../api/useWhatsApp';

export default function CustomerLoginPage() {
	const [identifier, setIdentifier] = useState('');
	const [code, setCode] = useState('');
	const [codeSent, setCodeSent] = useState(false);
	const [needs, setNeeds] = useState<'email' | 'mobile' | null>(null);
	const [otherId, setOtherId] = useState('');
	const [otherCode, setOtherCode] = useState('');
	const [dual, setDual] = useState(false);
	const [emailHint, setEmailHint] = useState('');
	const [mobileChannel, setMobileChannel] = useState<'whatsapp' | 'sms' | null>(null);
	const [mobileHint, setMobileHint] = useState('');
	const [waFailed, setWaFailed] = useState(false);
	const waAvailable = useWhatsAppAvailable();
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	// First sign-in verifies mobile and email; afterwards the code goes to email only.
	// `whatsapp` is chosen by which button was pressed, never carried over, so each press means what it says.
	const sendCode = async (whatsapp: boolean) => {
		if (!identifier.trim()) {
			message.error('Enter your mobile number or email');
			return;
		}
		if (needs && !otherId.trim()) {
			message.error(`Enter your ${needs === 'email' ? 'email address' : 'mobile number'}`);
			return;
		}
		setLoading(true);
		try {
			const res = await customerApi.requestOtp(identifier.trim(), needs ? otherId.trim() : undefined, whatsapp ? 'whatsapp' : undefined);
			if (res.needs) {
				setNeeds(res.needs);
				message.info(`First sign-in: add your ${res.needs === 'email' ? 'email address' : 'mobile number'} to verify`);
				return;
			}
			setDual(res.channels?.length === 2);
			setEmailHint(res.emailHint ?? '');
			setMobileHint(res.mobileHint ?? '');
			setMobileChannel(res.channels?.includes('whatsapp') ? 'whatsapp' : res.channels?.includes('sms') ? 'sms' : null);
			setWaFailed(Boolean(res.whatsappFailed));
			setCode('');
			setOtherCode('');
			setCodeSent(true);
			const mobileWord = res.channels?.includes('whatsapp') ? 'WhatsApp' : 'mobile';
			message.success(res.channels?.length === 2 ? `Codes sent to your ${mobileWord} and email` : res.channels?.includes('whatsapp') ? 'Verification code sent on WhatsApp' : 'Verification code sent to your email');
		} catch (err) {
			message.error((err as Error).message || 'Could not send code');
		} finally {
			setLoading(false);
		}
	};

	const handleSendCode = () => sendCode(false);
	const handleSendWhatsApp = () => sendCode(true);

	const handleVerify = async () => {
		if (!/^\d{6}$/.test(code.trim()) || (dual && !/^\d{6}$/.test(otherCode.trim()))) {
			message.error(dual ? 'Enter both 6-digit codes' : 'Enter the 6-digit code');
			return;
		}
		setLoading(true);
		try {
			const other = dual ? { identifier: otherId.trim() || undefined, code: otherCode.trim() } : undefined;
			const { customer } = await customerApi.verifyOtp(identifier.trim(), code.trim(), other);
			localStorage.setItem('askus_customer', JSON.stringify(customer));
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
					readOnly={codeSent || !!needs}
					autoFocus
				/>

				{needs && !codeSent && (
					<>
						<label style={styles.label}>{needs === 'email' ? 'Email address' : 'Mobile number'} (to verify on first sign-in)</label>
						<input
							type="text"
							value={otherId}
							onChange={(e) => setOtherId(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
							style={styles.input}
							placeholder={needs === 'email' ? 'you@example.com' : '10-digit mobile number'}
							autoFocus
						/>
					</>
				)}

				{codeSent && (
					<>
						<label style={styles.label}>
							{dual
								? `Code sent to ${identifier.includes('@') ? 'your email' : mobileChannel === 'whatsapp' ? 'your WhatsApp' : 'your mobile'}`
								: mobileChannel === 'whatsapp' ? `Verification code (sent on WhatsApp${mobileHint ? ` to ${mobileHint}` : ''})` : `Verification code${emailHint ? ` (sent to ${emailHint})` : ''}`}
						</label>
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
						{dual && (
							<>
								<label style={styles.label}>Code sent to {identifier.includes('@') ? (mobileChannel === 'whatsapp' ? 'your WhatsApp' : 'your mobile') : 'your email'}</label>
								<input
									type="text"
									inputMode="numeric"
									maxLength={6}
									value={otherCode}
									onChange={(e) => setOtherCode(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
									style={styles.input}
									placeholder="6-digit code"
								/>
							</>
						)}
					</>
				)}

				{codeSent && waFailed && (
					<p style={{ fontSize: 12, color: '#b45309', margin: '0 0 10px' }}>
						WhatsApp isn't available right now, so we sent your code {dual ? 'by SMS' : 'to your email'} instead.
					</p>
				)}

				<button type="button" style={styles.submitBtn} onClick={codeSent ? handleVerify : handleSendCode} disabled={loading}>
					{loading ? 'Please wait…' : codeSent ? 'Verify and Log In' : 'Send Code'}
				</button>

				{!codeSent && waAvailable && (
					<button
						type="button"
						onClick={handleSendWhatsApp}
						disabled={loading}
						style={{ ...styles.submitBtn, marginTop: 10, background: '#fff', color: '#128C7E', border: '2px solid #25D366', boxShadow: 'none' }}
					>
						Send code on WhatsApp
					</button>
				)}

				{codeSent && mobileChannel === 'whatsapp' && (
					<p style={{ textAlign: 'center', marginTop: 12, fontSize: 13 }}>
						<a style={{ cursor: 'pointer', color: '#555', textDecoration: 'underline' }} onClick={handleSendCode}>
							Didn't get it on WhatsApp? Send it by {dual ? 'SMS' : 'email'}
						</a>
					</p>
				)}

				<p style={styles.footerText}>
					New here? Enter your mobile or email. On first sign-in we verify both; after that, codes come to your email only.
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
