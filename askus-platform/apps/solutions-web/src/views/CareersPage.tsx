import { useState } from 'react';
import SiteChrome from '../components/SiteChrome';

const openings = [
	{ title: 'Operations Manager', team: '02 Taxi', location: 'Coimbatore', type: 'Full-time' },
	{ title: 'Claims Associate', team: 'Alphaa Insurance', location: 'Chennai', type: 'Full-time' },
	{ title: 'Loan Officer', team: 'Alphaa Loans', location: 'Coimbatore', type: 'Full-time' },
	{ title: 'Customer Support Executive', team: '02 Taxi', location: 'Chennai', type: 'Full-time' },
	{ title: 'Software Engineer, TMS Platform', team: 'AskusNext Global Solutions Private Limited', location: 'Coimbatore', type: 'Full-time' },
	{ title: 'Fleet Coordinator', team: '02 Taxi', location: 'Chennai', type: 'Full-time' },
];

const CAREERS_EMAIL = 'careers@askussolutions.in';

export default function CareersPage() {
	const [showSuccess, setShowSuccess] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = e.currentTarget;
		setSubmitting(true);
		try {
			await fetch(`https://formsubmit.co/${CAREERS_EMAIL}`, {
				method: 'POST',
				body: new FormData(form),
				mode: 'no-cors',
			});
			form.reset();
			setShowSuccess(true);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<SiteChrome>
			<section className="sc-section">
				<h2 className="sc-title">Build with us.</h2>
				<p className="sc-sub">
					Help us build the mobility, insurance, and lending experience millions of people rely on. Here's what's
					currently open.
				</p>
				<div className="sc-grid">
					{openings.map((job) => (
						<div key={job.title} className="sc-card">
							<span className="sc-tag">{job.team}</span>
							<h4>{job.title}</h4>
							<p>
								{job.location} &middot; {job.type}
							</p>
						</div>
					))}
				</div>

				<div className="sc-apply">
					<h3>Apply now</h3>
					<p className="sc-apply-lead">
						Send us your details and resume — our team reviews every application and will reach out if there's a fit.
					</p>
					<form className="sc-apply-form" onSubmit={handleSubmit}>
						<input type="hidden" name="_subject" value="New career application" />
						<input type="hidden" name="_captcha" value="false" />
						<input type="hidden" name="_template" value="table" />

						<div className="sc-field-row">
							<div className="sc-field">
								<label className="sc-flabel" htmlFor="firstName">
									First name
								</label>
								<input id="firstName" name="First name" type="text" placeholder="First name" required />
							</div>
							<div className="sc-field">
								<label className="sc-flabel" htmlFor="lastName">
									Last name
								</label>
								<input id="lastName" name="Last name" type="text" placeholder="Last name" required />
							</div>
						</div>

						<div className="sc-field-row">
							<div className="sc-field">
								<label className="sc-flabel" htmlFor="email">
									Email
								</label>
								<input id="email" name="Email" type="email" placeholder="you@example.com" required />
							</div>
							<div className="sc-field">
								<label className="sc-flabel" htmlFor="mobile">
									Mobile number
								</label>
								<input id="mobile" name="Mobile number" type="tel" placeholder="Mobile number" required />
							</div>
						</div>

						<div className="sc-field">
							<label className="sc-flabel" htmlFor="position">
								Position
							</label>
							<select id="position" name="Position" required defaultValue="">
								<option value="" disabled>
									Select a role
								</option>
								{openings.map((job) => (
									<option key={job.title} value={job.title}>
										{job.title} — {job.location}
									</option>
								))}
								<option value="Open Application">Open Application</option>
							</select>
						</div>

						<div className="sc-field">
							<label className="sc-flabel" htmlFor="resume">
								Resume (PDF or DOC)
							</label>
							<input
								id="resume"
								name="Resume"
								type="file"
								accept=".pdf,.doc,.docx"
								required
							/>
						</div>

						<div className="sc-field">
							<label className="sc-flabel" htmlFor="message">
								Message (optional)
							</label>
							<textarea id="message" name="Message" placeholder="Tell us a bit about yourself" />
						</div>

						<button type="submit" disabled={submitting}>
							{submitting ? 'Submitting…' : 'Submit Application'}
						</button>
					</form>
				</div>
			</section>

			{showSuccess && (
				<div className="sc-success-overlay" onClick={() => setShowSuccess(false)}>
					<div className="sc-success-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
						<div className="sc-success-tick">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
								<path d="M20 6 9 17l-5-5" />
							</svg>
						</div>
						<h3>Application Submitted!</h3>
						<p>Thanks for applying. Our team has received your details and resume, and will reach out if there's a fit.</p>
						<button type="button" className="sc-success-close" onClick={() => setShowSuccess(false)}>
							Close
						</button>
					</div>
				</div>
			)}
		</SiteChrome>
	);
}
