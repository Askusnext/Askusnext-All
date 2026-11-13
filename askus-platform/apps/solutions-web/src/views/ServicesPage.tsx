import SiteChrome from '../components/SiteChrome';

const services = [
	{ name: 'Bike', blurb: 'Fast, light, and easy through traffic — ideal for quick point-to-point trips.' },
	{ name: 'Car', blurb: 'Comfortable private rides for daily commutes, airport runs, and longer trips.' },
	{ name: 'Auto', blurb: 'The everyday city ride — quick to book, easy on the fare, everywhere in town.' },
	{ name: 'Share Taxi', blurb: 'Split a car ride along a shared route and travel for less.' },
	{ name: 'Share Auto', blurb: 'Shared auto rides on common routes — quick, affordable, and eco-friendly.' },
];

export default function ServicesPage() {
	return (
		<SiteChrome>
			<section className="sc-section">
				<h2 className="sc-title">One platform, every ride.</h2>
				<p className="sc-sub">
					From a quick bike hop to a full car booking, private or shared — our network covers it all.
				</p>
				<div className="sc-grid">
					{services.map((s) => (
						<div key={s.name} className="sc-card">
							<h4>{s.name}</h4>
							<p>{s.blurb}</p>
						</div>
					))}
				</div>
			</section>
		</SiteChrome>
	);
}
