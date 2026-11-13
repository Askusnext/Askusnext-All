import { useState } from 'react';
import SiteChrome from '../components/SiteChrome';

const CONTACT_EMAIL = 'contact@askussolutions.in';

const QUERIES: Record<string, string[]> = {
	Rider: [
		'Driver Behaviour',
		'Account Activation/Deactivation Request',
		'Driver Appreciation',
		'Ride Fare Related',
		'Ride Payment Related',
		'Unable to Login',
		'Unable to Request a Ride',
		'Collaboration',
		'Other',
	],
	Driver: [
		'How to Join as a Driver',
		'Driver Account Activation Request',
		'Driver Account Deactivation Request',
		'Document Change Request',
		'Mobile Number Change Request',
		'Unable to Login to Driver Account',
		'Help to Register as a Driver',
		'Other',
	],
};

export default function ContactPage() {
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [mobile, setMobile] = useState('');
	const [role, setRole] = useState('');
	const [query, setQuery] = useState('');
	const [message, setMessage] = useState('');
	const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

	const handleRoleChange = (value: string) => {
		setRole(value);
		setQuery('');
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setStatus('sending');
		try {
			const res = await fetch(`https://formsubmit.co/ajax/${CONTACT_EMAIL}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({
					name,
					email,
					mobile,
					role,
					query,
					message,
					_subject: `[${role}] ${query}`,
				}),
			});
			if (!res.ok) throw new Error('Request failed');
			setStatus('sent');
			setName('');
			setEmail('');
			setMobile('');
			setRole('');
			setQuery('');
			setMessage('');
		} catch {
			setStatus('error');
		}
	};

	return (
		<SiteChrome>
			<section className="sc-section">
				<h2 className="sc-title">Get in touch.</h2>
				<p className="sc-sub">
					Questions about our platform or interested in working together — reach out and we'll get back to you.
				</p>
				<div className="sc-contact-wrap">
					<div className="sc-contact-info">
						<div className="sc-crow">
							<span className="sc-dot2" />
							<div>
								<div className="sc-clabel">Email</div>
								<div className="sc-cval">{CONTACT_EMAIL}</div>
							</div>
						</div>
						<div className="sc-crow">
							<span className="sc-dot2" />
							<div>
								<div className="sc-clabel">Office</div>
								<div className="sc-cval">Coimbatore, Tamil Nadu, India</div>
							</div>
						</div>
						<div className="sc-crow">
							<span className="sc-dot2" />
							<div>
								<div className="sc-clabel">Hours</div>
								<div className="sc-cval">Mon – Sat, 9:00 AM – 6:00 PM</div>
							</div>
						</div>
					</div>
					<form className="sc-contact-form" onSubmit={handleSubmit}>
						<input
							type="text"
							placeholder="Your name"
							required
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
						<input
							type="email"
							placeholder="Your email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
						<input
							type="tel"
							placeholder="Your mobile number"
							required
							value={mobile}
							onChange={(e) => setMobile(e.target.value)}
						/>
						<select
							className="sc-select"
							required
							value={role}
							onChange={(e) => handleRoleChange(e.target.value)}
						>
							<option value="" disabled>
								You are a…
							</option>
							<option value="Driver">Driver</option>
							<option value="Rider">Rider</option>
						</select>
						<select
							className="sc-select"
							required
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							disabled={!role}
						>
							<option value="" disabled>
								{role ? 'Select your query' : 'Select a role first'}
							</option>
							{(QUERIES[role] || []).map((q) => (
								<option key={q} value={q}>
									{q}
								</option>
							))}
						</select>
						<textarea
							placeholder="Your message"
							required
							value={message}
							onChange={(e) => setMessage(e.target.value)}
						/>
						<button type="submit" disabled={status === 'sending'}>
							{status === 'sending' ? 'Sending…' : 'Send Message'}
						</button>
						{status === 'sent' && (
							<p className="sc-form-note">Thanks — your message has been sent to our team.</p>
						)}
						{status === 'error' && (
							<p className="sc-form-note">Something went wrong. Please email us directly at {CONTACT_EMAIL}.</p>
						)}
					</form>
				</div>
			</section>
		</SiteChrome>
	);
}
