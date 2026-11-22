import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightOutlined } from '@ant-design/icons';
import '../styles/erp.css';

export type Tone = 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'pink' | 'teal' | 'slate';

export function PageHeader({ eyebrow, title, subtitle, crumbs, actions }: {
  eyebrow?: string; title: string; subtitle?: ReactNode; crumbs?: string; actions?: ReactNode;
}) {
  return (
    <header className="erp-header">
      <div className="erp-header-text">
        {eyebrow && <span className="erp-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {crumbs && <span className="erp-crumbs">{crumbs}</span>}
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="erp-header-actions">{actions}</div>}
    </header>
  );
}

export interface Stat { label: string; value: ReactNode; hint?: string; tone?: Tone; icon?: ReactNode; to?: string }

export function StatGrid({ stats, solid }: { stats: Stat[]; solid?: boolean }) {
  return (
    <div className={`erp-stats${solid ? ' is-solid' : ''}`}>
      {stats.map((s) => {
        const body = (
          <>
            <div className="erp-stat-top">
              <span className="erp-stat-label">{s.label}</span>
              {s.icon && <span className="erp-stat-icon" aria-hidden>{s.icon}</span>}
            </div>
            <strong className="erp-stat-value">{s.value}</strong>
            {s.hint && <span className="erp-stat-hint">{s.hint}</span>}
          </>
        );
        return s.to
          ? <Link key={s.label} to={s.to} className={`erp-stat tone-${s.tone ?? 'blue'}`}>{body}</Link>
          : <div key={s.label} className={`erp-stat tone-${s.tone ?? 'blue'}`}>{body}</div>;
      })}
    </div>
  );
}

export interface HubCard { title: string; description: string; to: string; icon: ReactNode; tone?: Tone; badge?: string; cta?: string }

export function HubGrid({ cards }: { cards: HubCard[] }) {
  return (
    <div className="erp-hub">
      {cards.map((c) => (
        <Link key={c.to + c.title} to={c.to} className={`erp-hub-card tone-${c.tone ?? 'blue'}`}>
          <div className="erp-hub-top">
            <span className="erp-hub-icon" aria-hidden>{c.icon}</span>
            {c.badge && <span className="erp-hub-badge">{c.badge}</span>}
          </div>
          <h3>{c.title}</h3>
          <p>{c.description}</p>
          <span className="erp-hub-cta">{c.cta ?? `Manage ${c.title}`} <ArrowRightOutlined aria-hidden /></span>
        </Link>
      ))}
    </div>
  );
}

export function Panel({ title, extra, children, className }: { title: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`erp-panel ${className ?? ''}`}>
      <div className="erp-panel-head"><h2>{title}</h2>{extra}</div>
      <div className="erp-panel-body">{children}</div>
    </section>
  );
}

/** Horizontal bar list, used for funnels and distributions. */
export function BarList({ items, total, tone = 'blue' }: { items: { label: string; value: number; tone?: Tone; suffix?: string; to?: string }[]; total?: number; tone?: Tone }) {
  const max = total ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="erp-bars">
      {items.map((i) => {
        const pct = max ? Math.round((i.value / max) * 100) : 0;
        const body = (
          <>
            <div className="erp-bar-row"><span>{i.label}</span><span><em>{pct}%</em> {i.suffix ?? i.value}</span></div>
            <div className="erp-bar-track"><div className={`erp-bar-fill tone-${i.tone ?? tone}`} style={{ width: `${pct}%` }} /></div>
          </>
        );
        return <li key={i.label}>{i.to ? <Link to={i.to} className="erp-bar-link">{body}</Link> : body}</li>;
      })}
    </ul>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="erp-empty">{children}</div>;
}
