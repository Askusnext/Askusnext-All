import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Spin } from 'antd';
import PublicLayout from '../components/PublicLayout';
import customerApi, { type KBArticle } from '../api/customerApi';

const categoryLabels: Record<string, string> = {
	O2Taxi: '02 Taxi',
	AlphaaInsurance: 'Alphaa Insurance',
	AlphaaLoans: 'Alphaa Loans',
	General: 'General',
};

export default function HelpArticlePage() {
	const { slug } = useParams();
	const [article, setArticle] = useState<KBArticle | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	useEffect(() => {
		if (!slug) return;
		setLoading(true);
		customerApi.getArticleBySlug(slug)
			.then(setArticle)
			.catch(() => setNotFound(true))
			.finally(() => setLoading(false));
	}, [slug]);

	return (
		<PublicLayout>
			<section style={styles.section}>
				<Link to="/help" style={styles.backLink}>← Back to Help Center</Link>

				{loading ? (
					<div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
				) : notFound || !article ? (
					<div style={styles.empty}>Article not found.</div>
				) : (
					<div style={styles.card}>
						<div style={styles.category}>{categoryLabels[article.category] || article.category}</div>
						<h1 style={styles.title}>{article.title}</h1>
						<p style={styles.body}>{article.body}</p>
					</div>
				)}
			</section>
		</PublicLayout>
	);
}

const styles: Record<string, React.CSSProperties> = {
	section: {
		maxWidth: 800,
		margin: '0 auto',
		padding: '48px 24px 64px',
	},
	backLink: {
		display: 'inline-block',
		marginBottom: 24,
		color: '#5b6b83',
		fontWeight: 600,
		fontSize: '.88rem',
		textDecoration: 'none',
	},
	card: {
		background: '#FFF',
		borderRadius: 14,
		padding: '32px 32px',
		border: '1px solid #E7ECF3',
	},
	category: {
		fontSize: '.78rem',
		fontWeight: 700,
		color: '#C8102E',
		letterSpacing: 0.4,
		textTransform: 'uppercase',
	},
	title: {
		margin: '10px 0 0',
		fontSize: '1.6rem',
		fontWeight: 800,
		color: '#0F2747',
	},
	body: {
		marginTop: 20,
		color: '#334155',
		fontSize: '1rem',
		lineHeight: 1.7,
		whiteSpace: 'pre-wrap',
	},
	empty: {
		background: '#FFF',
		borderRadius: 14,
		padding: '40px 24px',
		textAlign: 'center',
		color: '#5b6b83',
		border: '1px solid #E7ECF3',
	},
};
