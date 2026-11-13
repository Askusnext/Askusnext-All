import { Link } from 'react-router-dom';
import SiteChrome from '../components/SiteChrome';
import taxiImg from '../assets/solution-o2-taxi.jpeg';

const features = [
	{ title: 'Verified drivers', text: 'Every driver on the platform is background-checked and rated by riders.' },
	{ title: 'Live tracking', text: 'Riders and dispatch can see the exact location of every trip in real time.' },
	{ title: 'Cashless payments', text: 'Pay by card, wallet, or UPI — no cash required at drop-off.' },
	{ title: '24/7 support', text: 'Round-the-clock support for riders and drivers, every day of the year.' },
];

export default function O2TaxiPage() {
	return (
		<SiteChrome>
			<section className="sc-section">
				<h2 className="sc-title">O2 Taxi</h2>
				<div className="sc-detail">
					<img className="sc-detail-img" src={taxiImg} alt="O2 Taxi driver and vehicle" />
					<p className="sc-detail-lead">
						O2 Taxi is a single connected mobility network that brings bikes, autos, cars, and shared rides together
						across the whole city. One tap is all it takes to reach the nearest verified driver at a fair, upfront
						price — no haggling, no surprises, no waiting in the dark.
					</p>
				</div>
				<div className="sc-prose">
					<p>
						Every journey begins with a match. The moment you request a ride, our system finds the closest available
						driver and locks in a transparent fare, so there is never any negotiation at the door. Live GPS tracking
						then keeps the entire trip visible to you, your family, and the operations team in real time. If plans
						change, you can share your route with a loved one or trigger an in-app SOS in a single tap.
					</p>
					<p>
						Safety sits at the centre of everything we do. Drivers are background-checked, verified, and continuously
						rated by the riders they serve. Vehicles are monitored for the health of the wider fleet, and every trip is
						logged for full accountability. Cashless payments through card, wallet, or UPI mean you step out at your
						destination without fumbling for change, and a digital receipt lands instantly in your ride history.
					</p>
					<p>
						For everyday commuters, shared bike, auto, and car options let you split a common route and travel for
						noticeably less while easing congestion on busy roads. Smart routing avoids traffic hotspots so you arrive
						sooner, and demand-aware dispatch keeps wait times short even during peak hours. For our driver-partners,
						O2 Taxi means steady demand, clear earnings, and simple tools that make each and every shift easier to run.
					</p>
					<p>
						Round-the-clock human support is always a message away for both riders and drivers, on every single day of
						the year. Whether it is a quick question, a lost item, or an urgent concern, real help is ready the moment
						you need it. O2 Taxi is, quite simply, everyday transport made reliable, affordable, and genuinely
						stress-free.
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
