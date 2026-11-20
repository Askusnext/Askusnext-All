import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spin } from 'antd';
import PublicLayout from '../components/PublicLayout';
import customerApi, { type KBArticle } from '../api/customerApi';

const categories = [
	{ value: '', label: 'All' },
	{ value: 'O2Taxi', label: '02 Taxi' },
	{ value: 'AlphaaInsurance', label: 'Askus Insurance' },
	{ value: 'AlphaaLoans', label: 'Askus Financial Services' },
	{ value: 'General', label: 'General' },
];

export default function HelpCenterPage() {
	const [articles, setArticles] = useState<KBArticle[]>([]);
	const [loading, setLoading] = useState(true);
	const [category, setCategory] = useState('');
	const [search, setSearch] = useState('');

	useEffect(() => {
		setLoading(true);
		customerApi.getArticles({ category: category || undefined, search: search || undefined })
			.then(setArticles)
			.finally(() => setLoading(false));
	}, [category, search]);

	return (
		<PublicLayout>
			<section style={styles.banner}>
				<h1 style={styles.bannerTitle}>Help Center</h1>
				<p style={styles.bannerSubtitle}>Answers for 02 Taxi, Askus Insurance, and Askus Financial Services customers.</p>
				<input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search help articles…"
					style={styles.search}
				/>
			</section>

			<section style={styles.section}>
				<div style={styles.pillRow}>
					{categories.map((c) => (
						<button
							className="action-button"
							aria-pressed={category === c.value}
							key={c.value}
							type="button"
							style={styles.pill}
							onClick={() => setCategory(c.value)}
						>
							{c.label}
						</button>
					))}
				</div>

				{loading ? (
					<div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
				) : articles.length === 0 ? (
					<div style={styles.empty}>No articles found.</div>
				) : (
					<div style={styles.grid}>
						{articles.map((a) => (
							<Link key={a.id} to={`/help/${a.slug}`} style={styles.card}>
								<div style={styles.cardCategory}>{categories.find((c) => c.value === a.category)?.label || a.category}</div>
								<div style={styles.cardTitle}>{a.title}</div>
							</Link>
						))}
					</div>
				)}
			</section>
		</PublicLayout>
	);
}

const styles: Record<string, React.CSSProperties> = {
	banner: {
		background: '#eff6ff',
		color: '#172b4d',
		padding: '64px 24px',
		textAlign: 'center',
	},
	bannerTitle: {
		margin: 0,
		fontSize: 'clamp(1.6rem, 4vw, 2.6rem)',
		fontWeight: 800,
	},
	bannerSubtitle: {
		marginTop: 12,
		color: '#334155',
		fontSize: '1rem',
	},
	search: {
		marginTop: 24,
		width: 'min(480px, 100%)',
		padding: '13px 18px',
		borderRadius: 999,
		border: '1px solid #dbe5f4',
		fontSize: '.95rem',
	},
	section: {
		maxWidth: 1100,
		margin: '0 auto',
		padding: '40px 24px 64px',
	},
	pillRow: {
		display: 'flex',
		gap: 8,
		flexWrap: 'wrap',
		marginBottom: 28,
	},
	pill: {
		padding: '8px 16px',
		borderRadius: 999,
		fontWeight: 500,
		fontSize: '.82rem',
		cursor: 'pointer',
	},
	empty: {
		background: '#FFF',
		borderRadius: 14,
		padding: '40px 24px',
		textAlign: 'center',
		color: '#334155',
		border: '1px solid #dbe5f4',
	},
	grid: {
		display: 'grid',
		gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
		gap: 18,
	},
	card: {
		display: 'block',
		background: '#FFF',
		borderRadius: 14,
		padding: '20px 22px',
		textDecoration: 'none',
		border: '1px solid #dbe5f4',
		boxShadow: '0 4px 20px rgba(15,39,71,.06)',
	},
	cardCategory: {
		fontSize: '.74rem',
		fontWeight: 700,
		color: '#1e40af',
		letterSpacing: 0.4,
		textTransform: 'uppercase',
	},
	cardTitle: {
		marginTop: 8,
		fontSize: '1rem',
		fontWeight: 700,
		color: '#172b4d',
	},
};
