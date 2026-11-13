import SiteChrome from '../components/SiteChrome';

const pillars = [
	{ n: '01', h: 'Product Engineering', p: 'We build and maintain the mobile and web applications that power our platforms end to end.' },
	{ n: '02', h: 'Reliable Infrastructure', p: 'Systems designed for uptime, security, and scale — so operations never slow down.' },
	{ n: '03', h: 'People First', p: 'A small, focused team that builds close to the people who use what we make every day.' },
];

export default function AboutPage() {
	return (
		<SiteChrome>
			<section className="sc-section">
				<h2 className="sc-title">A software company building the intelligence behind everyday movement.</h2>
				<p className="sc-sub">
					AskusNext Global Solutions Private Limited designs and operates the technology layer that keeps mobility, insurance, lending, and field
					operations connected — from the apps riders and customers use, to the systems that keep everything in sync
					behind the scenes.
				</p>
				<div className="sc-grid">
					{pillars.map((c) => (
						<div key={c.n} className="sc-card">
							<h4>{c.h}</h4>
							<p>{c.p}</p>
						</div>
					))}
				</div>
			</section>
		</SiteChrome>
	);
}
