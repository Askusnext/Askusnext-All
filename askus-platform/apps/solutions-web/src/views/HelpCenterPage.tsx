import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spin } from 'antd';
import PublicLayout from '../components/PublicLayout';
import customerApi, { type KBArticle } from '../api/customerApi';

const categories = [
	{ value: '', label: 'All' },
	{ value: 'O2Taxi', label: '02 Taxi' },
	{ value: 'AlphaaInsurance', label: 'Alphaa Insurance' },
	{ value: 'AlphaaLoans', label: 'Alphaa Loans' },
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
				<p style={styles.bannerSubtitle}>Answers for 02 Taxi, Alphaa Insurance, and Alphaa Loans customers.</p>
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
							key={c.value}
							type="button"
							style={{ ...styles.pill, ...(category === c.value ? styles.pillActive : {}) }}
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
		background: 'linear-gradient(135deg, #0F2747 0%, #143B69 100%)',
		color: '#FFF',
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
		color: 'rgba(255,255,255,.8)',
		fontSize: '1rem',
	},
	search: {
		marginTop: 24,
		width: 'min(480px, 100%)',
		padding: '13px 18px',
		borderRadius: 999,
		border: 0,
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
		border: '1px solid #E7ECF3',
		background: '#FFF',
		color: '#5b6b83',
		fontWeight: 700,
		fontSize: '.82rem',
		cursor: 'pointer',
	},
	pillActive: {
		background: '#0F2747',
		borderColor: '#0F2747',
		color: '#FFF',
	},
	empty: {
		background: '#FFF',
		borderRadius: 14,
		padding: '40px 24px',
		textAlign: 'center',
		color: '#5b6b83',
		border: '1px solid #E7ECF3',
	},
	grid: {
		display: 'grid',
		gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
		gap: 18,
	},
	card: {
		display: 'block',
		background: '#FFF',
		borderRadius: 14,
		padding: '20px 22px',
		textDecoration: 'none',
		border: '1px solid #E7ECF3',
		boxShadow: '0 4px 20px rgba(15,39,71,.06)',
	},
	cardCategory: {
		fontSize: '.74rem',
		fontWeight: 700,
		color: '#C8102E',
		letterSpacing: 0.4,
		textTransform: 'uppercase',
	},
	cardTitle: {
		marginTop: 8,
		fontSize: '1rem',
		fontWeight: 700,
		color: '#0F2747',
	},
};
