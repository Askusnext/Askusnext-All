import { Link } from 'react-router-dom';
import { ArrowRightOutlined, CarOutlined, CheckOutlined, RobotOutlined, SafetyCertificateOutlined, WalletOutlined } from '@ant-design/icons';
import SiteChrome from '../components/SiteChrome';
import Brand from '../components/Brand';
import SolutionVisual from '../components/SolutionVisual';

const solutions = [
	{
		to: '/products/ai-agents',
		key: 'ai',
		name: 'AskUs AI Agents',
		tag: 'Intelligent automation',
		desc: 'Always-on digital teammates for conversations, bookings, and follow-ups. Less routine work. More human connection.',
		icon: RobotOutlined,
	},
	{
		to: '/products/o2-taxi',
		key: 'taxi',
		name: 'O2 Taxi',
		tag: 'Connected mobility',
		desc: 'Bikes, autos, cars, and shared rides on one connected network. Making everyday journeys simpler.',
		icon: CarOutlined,
	},
	{
		to: '/products/alphaa-insurance',
		key: 'insurance',
		name: 'Askus Insurance',
		tag: 'Everyday protection',
		desc: 'Straightforward cover for your vehicle and livelihood. Explore policies, manage renewals, and get claims support.',
		icon: SafetyCertificateOutlined,
	},
	{
		to: '/products/alphaa-loans',
		key: 'loans',
		name: 'Askus Financial Services',
		tag: 'Simpler financing',
		desc: 'Paperless applications and clear repayment options. Financing designed around real people and everyday needs.',
		icon: WalletOutlined,
	},
] as const;

export default function LandingPage() {
	return (
		<SiteChrome animated>
				<section className="lp-hero lp-container" aria-labelledby="home-title">
					<div className="lp-hero-copy">
						<div className="lp-eyebrow"><span className="lp-status-dot" /> Connected intelligence. Real possibilities.</div>
						<h1 id="home-title">One network.<br />Every service,<br /><span>moving in sync.</span></h1>
						<p className="lp-hero-sub">Smarter support. Seamless mobility. Simpler finance. We bring AI, rides, insurance, and lending together to move everyday life forward.</p>
						<div className="lp-actions">
							<a className="lp-button lp-button-primary" href="#solutions">Explore our solutions <ArrowRightOutlined aria-hidden /></a>
							<Link className="lp-button lp-button-secondary" to="/contact">Let's talk <ArrowRightOutlined aria-hidden /></Link>
						</div>
						<div className="lp-hero-note"><span className="lp-note-line" /> Technology that connects. Services that matter.</div>
					</div>

					<div className="lp-network" role="img" aria-label="Askus connects AI agents, mobility, insurance, and lending in one ecosystem">
						<div className="lp-network-grid" />
						<div className="lp-network-orbit lp-network-orbit-outer" />
						<div className="lp-network-orbit lp-network-orbit-inner" />
						<svg className="lp-connections" viewBox="0 0 500 500" fill="none" aria-hidden="true">
							<path d="M250 250 126 110M250 250 389 160M250 250 110 350M250 250 363 410" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 7" />
							<circle cx="187" cy="180" r="4" fill="currentColor" />
							<circle cx="320" cy="205" r="4" fill="currentColor" />
							<circle cx="180" cy="300" r="4" fill="currentColor" />
							<circle cx="307" cy="330" r="4" fill="currentColor" />
						</svg>
						<div className="lp-network-center" aria-hidden="true">
							<Brand />
						</div>
						{solutions.map((solution) => (
							<div key={solution.key} className={`lp-network-card lp-network-${solution.key}`} aria-hidden="true">
								<span className={`lp-icon lp-icon-${solution.key}`}><solution.icon /></span>
								<div><strong>{solution.name}</strong><span>{solution.tag}</span></div>
							</div>
						))}
						<div className="lp-network-caption" aria-hidden="true"><span className="lp-status-dot" /> Built to work better, together</div>
					</div>
				</section>

				<div className="lp-platforms">
					<div className="lp-container lp-platforms-inner">
						<p>One ecosystem.<br /><strong>Four ways forward.</strong></p>
						{solutions.map((solution) => (
							<Link key={solution.key} to={solution.to}><solution.icon aria-hidden /><span>{solution.name}</span></Link>
						))}
					</div>
				</div>

				<section className="lp-solutions" id="solutions" aria-labelledby="solutions-title">
					<div className="lp-container">
						<div className="lp-section-heading">
							<div>
								<p className="lp-kicker">OUR SOLUTIONS</p>
								<h2 id="solutions-title">Different needs.<br /><span>One connected world.</span></h2>
							</div>
							<p>Purpose-built platforms that take the complexity out of everyday life. Discover what moves you forward.</p>
						</div>
						<div className="lp-solution-grid">
							{solutions.map((solution, index) => (
								<article key={solution.key} className="lp-solution-card">
									<div className="lp-solution-image">
										<SolutionVisual kind={solution.key} />
										<span className="lp-card-number">0{index + 1}</span>
									</div>
									<div className="lp-solution-body">
										<span className={`lp-icon lp-icon-${solution.key}`}><solution.icon aria-hidden /></span>
										<p className="lp-card-tag">{solution.tag}</p>
										<h3>{solution.name}</h3>
										<p className="lp-card-desc">{solution.desc}</p>
										<Link className="lp-card-link" to={solution.to} aria-label={`Explore ${solution.name}`}>Explore solution <ArrowRightOutlined aria-hidden /></Link>
									</div>
								</article>
							))}
						</div>
					</div>
				</section>

				<section className="lp-about lp-container" aria-labelledby="about-title">
					<div>
						<p className="lp-kicker">THE ASKUS APPROACH</p>
						<h2 id="about-title">Built around people.<br /><span>Connected by technology.</span></h2>
					</div>
					<div className="lp-about-copy">
						<p>At Askus Next Global Solutions Private Limited, we build and operate the technology behind AI-driven support, mobility, insurance, and lending. Different services, with one shared purpose: making the everyday feel effortless.</p>
						<ul>
							<li><CheckOutlined aria-hidden /> People-first experiences</li>
							<li><CheckOutlined aria-hidden /> Connected services</li>
							<li><CheckOutlined aria-hidden /> Intelligent automation</li>
						</ul>
						<Link className="lp-text-link" to="/about">Get to know Askus <ArrowRightOutlined aria-hidden /></Link>
					</div>
				</section>

				<section className="lp-cta lp-container" aria-labelledby="cta-title">
					<div><p className="lp-kicker">LET'S MOVE FORWARD</p><h2 id="cta-title">Your next possibility<br />starts with a conversation.</h2></div>
					<Link className="lp-button lp-button-primary" to="/contact">Connect with us <ArrowRightOutlined aria-hidden /></Link>
				</section>
		</SiteChrome>
	);
}
