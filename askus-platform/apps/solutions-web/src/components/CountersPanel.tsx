import { useEffect, useState, type ReactNode } from 'react';
import { Skeleton } from 'antd';
import { useNavigate } from 'react-router-dom';
import { AppstoreOutlined, CalendarOutlined, CarOutlined, CustomerServiceOutlined, SafetyOutlined } from '@ant-design/icons';
import { CATEGORY_LABEL, ticketingApi, type Counters } from '../api/ticketing';

const LOOK: Record<string, { icon: ReactNode; tone: string; type: string }> = {
  insurance: { icon: <SafetyOutlined />, tone: 'blue', type: 'Insurance' },
  taxi: { icon: <CarOutlined />, tone: 'green', type: 'O2Taxi' },
  general: { icon: <AppstoreOutlined />, tone: 'amber', type: 'General' },
  daily_activity: { icon: <CalendarOutlined />, tone: 'purple', type: 'DailyActivity' },
  support: { icon: <CustomerServiceOutlined />, tone: 'pink', type: 'Support' },
};

/** Live per-category counters, straight from the ticket data the signed-in person may see. */
export default function CountersPanel() {
  const [data, setData] = useState<Counters | null>(null);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    ticketingApi.counters().then((d) => live && setData(d)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);

  if (failed) return null; // e.g. no "reports" permission: the other cards still show
  const rows = (data?.categories ?? []).filter((c) => c.queue || c.open || c.expiring || c.expired || c.category in LOOK);
  const open = (type?: string) => navigate(type ? `/tickets?type=${type}` : '/tickets');

  return (
    <section className="counters">
      <header className="counters-head">
        <div>
          <h2>Live ticket counters</h2>
          <p>Waiting = open and not yet picked up. Expiring and expired count insurance policies nobody has renewed.</p>
        </div>
        {data && <span className="counters-asof">Updated {data.asOf}</span>}
      </header>

      {!data ? <Skeleton active paragraph={{ rows: 3 }} /> : (
        <>
          <div className="counters-totals" role="list" aria-label="Totals">
            {[
              { k: 'Waiting', v: data.totals.queue, t: 'blue' },
              { k: 'Open', v: data.totals.open, t: 'amber' },
              { k: 'Expiring in 30 days', v: data.totals.expiring, t: 'pink' },
              { k: 'Expired', v: data.totals.expired, t: 'red' },
            ].map((x) => (
              <div key={x.k} role="listitem" className={`counters-total tone-${x.t}`}><strong>{x.v}</strong><span>{x.k}</span></div>
            ))}
          </div>
          <div className="counters-grid">
            {rows.map((c) => {
              const look = LOOK[c.category] ?? { icon: <AppstoreOutlined />, tone: 'slate', type: '' };
              const insurance = c.category === 'insurance';
              return (
                <button key={c.category} type="button" className={`counter-card tone-${look.tone}`} onClick={() => open(look.type)}
                  aria-label={`${CATEGORY_LABEL[c.category] ?? c.category}: ${c.queue} waiting, ${c.open} open. Open tickets`}>
                  <span className="counter-card-top">
                    <span className="counter-card-icon" aria-hidden>{look.icon}</span>
                    <span className="counter-card-name">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                  </span>
                  <span className="counter-card-stats">
                    <span><em>{c.queue}</em>Waiting</span>
                    <span><em>{c.open}</em>Open</span>
                    {insurance && <span className={c.expiring ? 'is-warn' : ''}><em>{c.expiring}</em>Expiring</span>}
                    {insurance && <span className={c.expired ? 'is-bad' : ''}><em>{c.expired}</em>Expired</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
