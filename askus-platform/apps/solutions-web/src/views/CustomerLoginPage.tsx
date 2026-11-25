import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import customerApi from '../api/customerApi';
import Brand from '../components/Brand';

export default function CustomerLoginPage() {
	const [identifier, setIdentifier] = useState('');
	const [code, setCode] = useState('');
	const [codeSent, setCodeSent] = useState(false);
	const [needs, setNeeds] = useState<'email' | 'mobile' | null>(null);
	const [otherId, setOtherId] = useState('');
	const [otherCode, setOtherCode] = useState('');
	const [dual, setDual] = useState(false);
	const [emailHint, setEmailHint] = useState('');
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	// First sign-in verifies mobile and email; afterwards the code goes to email only.
	const handleSendCode = async () => {
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
			const res = await customerApi.requestOtp(identifier.trim(), needs ? otherId.trim() : undefined);
			if (res.needs) {
				setNeeds(res.needs);
				message.info(`First sign-in: add your ${res.needs === 'email' ? 'email address' : 'mobile number'} to verify`);
				return;
			}
			setDual(res.channels?.length === 2);
			setEmailHint(res.emailHint ?? '');
			setCodeSent(true);
			message.success(res.channels?.length === 2 ? 'Codes sent to your mobile and email' : 'Verification code sent to your email');
		} catch (err) {
			message.error((err as Error).message || 'Could not send code');
		} finally {
			setLoading(false);
		}
	};

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
		<main className="auth-page">
			<div className="auth-card">
				<Link to="/home" className="auth-brand" aria-label="Askus Next Global Solutions Private Limited home"><Brand /></Link>
				<Link to="/home" className="auth-back">← Back to home</Link>
				<h1>Customer Login</h1>
				<p className="auth-intro">Track your 02 Taxi, Askus Insurance, or Askus Financial Services support tickets.</p>

				<div className="auth-form">
				<label htmlFor="customer-identifier">Mobile number or email</label>
				<input
					id="customer-identifier"
					type="text"
					value={identifier}
					onChange={(e) => setIdentifier(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && !codeSent && handleSendCode()}
					placeholder="9876543210 or you@example.com"
					readOnly={codeSent || !!needs}
					autoFocus
				/>

				{needs && !codeSent && (
					<>
						<label htmlFor="customer-other">{needs === 'email' ? 'Email address' : 'Mobile number'} (to verify on first sign-in)</label>
						<input
							id="customer-other"
							type="text"
							value={otherId}
							onChange={(e) => setOtherId(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
							placeholder={needs === 'email' ? 'you@example.com' : '10-digit mobile number'}
							autoFocus
						/>
					</>
				)}

				{codeSent && (
					<>
						<label htmlFor="customer-code">
							{dual ? `Code sent to ${identifier.includes('@') ? 'your email' : 'your mobile'}` : `Verification code${emailHint ? ` (sent to ${emailHint})` : ''}`}
						</label>
						<input
							id="customer-code"
							type="text"
							inputMode="numeric"
							autoComplete="one-time-code"
							maxLength={6}
							value={code}
							onChange={(e) => setCode(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
							placeholder="6-digit code"
							autoFocus
						/>
						{dual && (
							<>
								<label htmlFor="customer-other-code">Code sent to {identifier.includes('@') ? 'your mobile' : 'your email'}</label>
								<input
									id="customer-other-code"
									type="text"
									inputMode="numeric"
									maxLength={6}
									value={otherCode}
									onChange={(e) => setOtherCode(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
									placeholder="6-digit code"
								/>
							</>
						)}
					</>
				)}

				<button type="button" className="auth-submit" onClick={codeSent ? handleVerify : handleSendCode} disabled={loading}>
					{loading ? 'Please wait…' : codeSent ? 'Verify and Log In' : 'Send Code'}
				</button>
				</div>

				<p className="auth-note">
					New here? Enter your mobile or email. On first sign-in we verify both; after that, codes come to your email only.
				</p>
				<p className="auth-company">Askus Next Global Solutions Private Limited</p>
			</div>
		</main>
	);
}
