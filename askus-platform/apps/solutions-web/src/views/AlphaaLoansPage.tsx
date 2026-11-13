import { Link } from 'react-router-dom';
import SiteChrome from '../components/SiteChrome';
import loansImg from '../assets/solution-alphaa-loans.jpeg';

const features = [
	{ title: 'Quick approval', text: 'Get a lending decision in as little as 24 hours.' },
	{ title: 'Flexible EMIs', text: 'Repayment plans built around a driver-partner’s daily earnings.' },
	{ title: 'Vehicle & working capital', text: 'Finance a new vehicle or cover day-to-day operating costs.' },
	{ title: 'Minimal documentation', text: 'A simple application process with support at every step.' },
];

export default function AlphaaLoansPage() {
	return (
		<SiteChrome>
			<section className="sc-section">
				<h2 className="sc-title">Alphaa Loans</h2>
				<div className="sc-detail">
					<img className="sc-detail-img" src={loansImg} alt="Alphaa Loans" />
					<p className="sc-detail-lead">
						Alphaa Loans gives drivers, fleet owners, and small businesses fast, fair access to the money they need to
						move forward. It is financing designed around real earnings and real workdays — quick to approve,
						transparent on cost, and flexible enough to fit the way people actually earn.
					</p>
				</div>
				<div className="sc-prose">
					<p>
						Applying is simple and takes only minutes, with a short form and minimal documentation instead of stacks of
						paperwork. Approvals move quickly, often within twenty-four hours, so an opportunity is never lost to slow
						processing. Whether you want to finance a new vehicle, upgrade an existing one, or cover the day-to-day
						working capital that keeps operations running, there is a plan built for the purpose.
					</p>
					<p>
						Repayment is where Alphaa Loans truly stands apart. EMIs are structured around a driver-partner's daily
						earnings rather than a rigid calendar, so instalments stay manageable even when income varies week to week.
						Interest rates are clear and disclosed upfront, with no hidden charges and no surprises later. You always
						know the total cost before you commit, and every statement is easy to read and available online.
					</p>
					<p>
						Support runs through the entire journey. A guided application helps you submit the right details the first
						time, and a dedicated team is on hand to answer questions before, during, and after disbursal. For fleet
						owners, financing can scale across multiple vehicles, while individual drivers get personal attention and
						plans matched to their goals. Smart reminders keep repayments on track and help build a stronger credit
						profile over time.
					</p>
					<p>
						The outcome is dependable financing that helps people grow — buy the vehicle, take the contract, expand the
						fleet, or simply smooth out a tough month. Alphaa Loans turns ambition into achievable steps, with money you
						can access quickly and repay on terms that respect how you earn.
					</p>
				</div>
				<div className="sc-grid">
					{features.map((f) => (
						<div key={f.title} className="sc-card">
							<h4>{f.title}</h4>
							<p>{f.text}</p>
						</div>
					))}
				</div>
				<Link to="/products" className="sc-back">
					← Back to Solutions
				</Link>
			</section>
		</SiteChrome>
	);
}
