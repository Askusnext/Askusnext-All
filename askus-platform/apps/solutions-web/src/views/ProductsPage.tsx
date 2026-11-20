import { Link } from 'react-router-dom';
import SiteChrome from '../components/SiteChrome';
import SolutionVisual from '../components/SolutionVisual';

const products = [
	{
		to: '/products/ai-agents',
		kind: 'ai',
		name: 'AskUs AI Agents',
		blurb: 'Always-on AI assistants that answer questions, resolve requests, and act across your systems.',
	},
	{
		to: '/products/o2-taxi',
		kind: 'taxi',
		name: '02 Taxi',
		blurb: 'On-demand rides across the city, tracked end-to-end for safety and reliability.',
	},
	{
		to: '/products/alphaa-insurance',
		kind: 'insurance',
		name: 'Askus Insurance',
		blurb: 'Vehicle and driver insurance cover, built for fleets and everyday commuters alike.',
	},
	{
		to: '/products/alphaa-loans',
		kind: 'loans',
		name: 'Askus Financial Services',
		blurb: 'Fast, flexible financing for vehicles and working capital.',
	},
] as const;

export default function ProductsPage() {
	return (
		<SiteChrome>
			<section className="sc-section">
				<h2 className="sc-title">Four platforms. One intelligence layer.</h2>
				<p className="sc-sub">
					Everything Askus Next Global Solutions Private Limited builds and operates, from AI-driven support to mobility, insurance, and lending.
				</p>
				<div className="sc-grid">
					{products.map((p) => (
						<Link key={p.to} to={p.to} className="sc-card">
							<SolutionVisual kind={p.kind} />
							<h4>{p.name}</h4>
							<p>{p.blurb}</p>
						</Link>
					))}
				</div>
			</section>
		</SiteChrome>
	);
}
