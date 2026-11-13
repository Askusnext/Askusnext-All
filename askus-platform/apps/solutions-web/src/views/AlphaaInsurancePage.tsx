import { Link } from 'react-router-dom';
import SiteChrome from '../components/SiteChrome';
import insuranceImg from '../assets/solution-alphaa-insurance.jpeg';

const features = [
	{ title: 'Instant policy issuance', text: 'Get a vehicle insurance policy issued in minutes, online.' },
	{ title: 'Cashless claims', text: 'Repairs at network garages settled directly with the insurer.' },
	{ title: 'Fleet-friendly pricing', text: 'Bulk cover for taxi fleets alongside plans for personal vehicles.' },
	{ title: 'Doorstep support', text: 'Claims agents available to assist at the site of an incident.' },
];

export default function AlphaaInsurancePage() {
	return (
		<SiteChrome>
			<section className="sc-section">
				<h2 className="sc-title">Alphaa Insurance</h2>
				<div className="sc-detail">
					<img className="sc-detail-img" src={insuranceImg} alt="Alphaa Insurance" />
					<p className="sc-detail-lead">
						Alphaa Insurance makes protecting your vehicle and livelihood simple, transparent, and genuinely fast. It
						is cover designed for both everyday commuters and full taxi fleets — clear on what it protects, honest on
						what it costs, and quick when you actually need it most.
					</p>
				</div>
				<div className="sc-prose">
					<p>
						Every policy plan is written in plain language, so you always know exactly what is covered and what is not.
						There are no dense clauses buried in fine print and no confusing jargon to decode. Instant premium checks let
						you see accurate pricing in seconds, before you commit a single rupee. Buying or renewing then takes just a
						few minutes and happens entirely online, without paperwork or branch visits.
					</p>
					<p>
						When something goes wrong, the moment that matters most, Alphaa Insurance moves quickly. Guided digital
						claims walk you through each step, and cashless repairs at network garages are settled directly with the
						insurer, so you are not left out of pocket. For incidents on the road, claims agents can assist right at the
						site, turning a stressful situation into a managed one. Every document lives in one place, ready to access
						the instant you need it.
					</p>
					<p>
						Coverage is built to scale with you. Individual commuters get straightforward, affordable protection, while
						taxi fleets benefit from bulk pricing and cover tailored to how they operate. Smart reminders keep your
						policy active so you are never caught off guard by a lapse or an expired renewal. Fair pricing is backed by
						honest terms, and support is only ever a message away.
					</p>
					<p>
						The result is dependable protection that gives drivers and fleet owners real peace of mind on every single
						trip. Whether you drive for a living or simply want your family vehicle secured, Alphaa Insurance is cover
						you can understand, afford, and trust when it counts.
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
