import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SiteChrome from '../components/SiteChrome';

const openings = [
	{ title: 'Operations Manager', team: '02 Taxi', location: 'Coimbatore', type: 'Full-time' },
	{ title: 'Claims Associate', team: 'Askus Insurance', location: 'Chennai', type: 'Full-time' },
	{ title: 'Loan Officer', team: 'Askus Financial Services', location: 'Coimbatore', type: 'Full-time' },
	{ title: 'Customer Support Executive', team: '02 Taxi', location: 'Chennai', type: 'Full-time' },
	{ title: 'Software Engineer, TMS Platform', team: 'Askus Next Global Solutions Private Limited', location: 'Coimbatore', type: 'Full-time' },
	{ title: 'Fleet Coordinator', team: '02 Taxi', location: 'Chennai', type: 'Full-time' },
];

const CAREERS_EMAIL = 'careers@askussolutions.in';

export default function CareersPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const position = searchParams.get('position') ?? '';
	const applicationHeading = useRef<HTMLHeadingElement>(null);
	const isApplying = position === 'Open Application' || openings.some((job) => job.title === position);

	useEffect(() => {
		window.scrollTo(0, 0);
		if (isApplying) applicationHeading.current?.focus({ preventScroll: true });
	}, [isApplying]);

	return (
		<SiteChrome>
			<section className="sc-section">
				{!isApplying && <>
				<h2 className="sc-title">Build with us.</h2>
				{position && <p role="alert" className="sc-form-note">This position is not available. Please select an opening below.</p>}
				<p className="sc-sub">
					Help us build the mobility, insurance, and lending experience millions of people rely on. Here's what's
					currently open. Select a position to apply.
				</p>
				<div className="sc-grid">
					{openings.map((job) => (
						<Link key={job.title} className="sc-card sc-job"
							aria-label={`Apply for ${job.title}`} to={`/careers?${new URLSearchParams({ position: job.title })}`}>
							<span className="sc-tag">{job.team}</span>
							<span className="sc-job-title">{job.title}</span>
							<span className="sc-job-meta">
								{job.location} &middot; {job.type}
							</span>
							<span className="sc-job-action">Apply now &rarr;</span>
						</Link>
					))}
				</div>
				<Link className="sc-back" to={`/careers?${new URLSearchParams({ position: 'Open Application' })}`}>
					No matching position? Send an open application
				</Link>
				</>}

				{isApplying && <>
				<Link to="/careers" className="sc-back sc-careers-back">&larr; Back to open positions</Link>
				<div className="sc-apply sc-careers-application" id="career-application">
					<h1 ref={applicationHeading} tabIndex={-1}>Apply now</h1>
					<p className="sc-apply-lead">
						Send us your details and resume — our team reviews every application and will reach out if there's a fit.
					</p>
					<form className="sc-apply-form" action={`https://formsubmit.co/${CAREERS_EMAIL}`} method="POST" encType="multipart/form-data">
						<input type="hidden" name="_subject" value="New career application" />
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
								<input id="email" name="email" type="email" placeholder="you@example.com" required />
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
							<select id="position" name="Position" required value={position} onChange={(event) => setSearchParams({ position: event.target.value })}>
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
								name="attachment"
								type="file"
								accept=".pdf,.doc,.docx"
								aria-describedby="resume-note"
								onChange={(event) => {
									const input = event.currentTarget;
									const file = input.files?.[0];
									input.setCustomValidity(file && file.size > 10_000_000 ? 'Please choose a resume no larger than 10 MB.' : '');
									if (!input.validity.valid) input.reportValidity();
								}}
								required
							/>
							<p id="resume-note" className="sc-form-note">PDF, DOC, or DOCX. Maximum 10 MB.</p>
						</div>

						<div className="sc-field">
							<label className="sc-flabel" htmlFor="message">
								Message (optional)
							</label>
							<textarea id="message" name="Message" placeholder="Tell us a bit about yourself" />
						</div>

						<p className="sc-form-note">
							Your details and resume will be processed by FormSubmit and emailed to {CAREERS_EMAIL}.
							After submitting, you will leave this page to complete verification and view the submission result.
						</p>
						<button type="submit">Submit Application</button>
					</form>
					<p className="sc-form-note">
						Having trouble submitting? Email your details and resume to <a href={`mailto:${CAREERS_EMAIL}`}>{CAREERS_EMAIL}</a>.
					</p>
				</div>
				</>}
			</section>
		</SiteChrome>
	);
}
