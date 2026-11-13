import { Link } from 'react-router-dom';
import SiteChrome from '../components/SiteChrome';
import aiImg from '../assets/solution-ai-agents.jpeg';

const features = [
	{ title: '24/7 availability', text: 'Always-on agents that answer instantly, day or night.' },
	{ title: 'Human handoff', text: 'Seamless escalation to your team when a person is needed.' },
	{ title: 'Trained on your data', text: 'Grounded in your policies, catalogue, and knowledge base.' },
	{ title: 'Multichannel', text: 'One brain across chat, email, voice, and in-app support.' },
];

export default function AIAgentsPage() {
	return (
		<SiteChrome>
			<section className="sc-section">
				<h2 className="sc-title">AskUs AI Agents</h2>
				<div className="sc-detail">
					<img className="sc-detail-img" src={aiImg} alt="AskUs AI Agents" />
					<p className="sc-detail-lead">
						AskUs AI Agents are intelligent virtual assistants that handle customer conversations end to end — answering
						questions, resolving requests, and taking action across your systems. They combine the speed of automation
						with the judgement of a well-trained team member, working around the clock so your customers never wait.
					</p>
				</div>
				<div className="sc-prose">
					<p>
						Each agent is trained on your own data — your policies, product catalogue, pricing, and knowledge base — so
						every answer is accurate and on-brand rather than generic. Instead of rigid menus and scripted replies, the
						agents understand natural language, hold context across a conversation, and respond the way a helpful person
						would. That means fewer misrouted tickets, shorter wait times, and customers who feel genuinely heard.
					</p>
					<p>
						The agents do more than talk. They can look up an order, check a policy, raise a ticket, schedule a
						callback, or trigger a workflow in the tools you already use. Routine, repetitive requests are resolved
						instantly and automatically, freeing your human team to focus on the complex, high-value conversations that
						truly need a personal touch. When a situation calls for a person, the handoff is seamless — full context is
						passed along, so nobody has to repeat themselves.
					</p>
					<p>
						One agent works everywhere your customers are. The same intelligence powers chat on your website, replies to
						email, answers on voice calls, and support inside your app, giving a consistent experience across every
						channel. Conversations, outcomes, and satisfaction are all measured, so you can see what is working and keep
						improving. Guardrails keep responses safe, accurate, and within the boundaries you define.
					</p>
					<p>
						The result is support that scales without adding headcount, resolves faster, and stays available every hour
						of every day. AskUs AI Agents turn customer service from a cost centre into a competitive advantage —
						helping you serve more people, more consistently, at a fraction of the effort.
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
