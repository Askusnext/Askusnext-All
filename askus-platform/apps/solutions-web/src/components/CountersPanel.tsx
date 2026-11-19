import { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography } from 'antd';
import { CATEGORY_LABEL, ticketingApi, type CategoryCounter, type Counters } from '../api/ticketing';

/** Live per-category counters, straight from the ticket data the signed-in person may see. */
export default function CountersPanel() {
  const [data, setData] = useState<Counters | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    ticketingApi.counters().then((d) => live && setData(d)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);

  if (failed) return null; // e.g. no "reports" permission: the other cards still show
  const rows = (data?.categories ?? []).filter((c) => c.queue || c.open || c.expiring || c.expired || ['insurance', 'taxi', 'general', 'daily_activity', 'support'].includes(c.category));

  const num = (v: number, color?: string) => <Typography.Text strong={v > 0} style={{ color: v > 0 ? color : '#475569' }}>{v}</Typography.Text>;
  return (
    <Card size="small" loading={!data} style={{ borderRadius: 10, marginBottom: 20 }}
      title="Live counters by category" extra={data && <Tag>as of {data.asOf}</Tag>}>
      <Table<CategoryCounter> size="small" pagination={false} rowKey="category" dataSource={rows}
        columns={[
          { title: 'Category', dataIndex: 'category', render: (c: string) => CATEGORY_LABEL[c] ?? c },
          { title: 'In queue', dataIndex: 'queue', align: 'right', render: (v: number) => num(v, '#1677ff') },
          { title: 'Open', dataIndex: 'open', align: 'right', render: (v: number) => num(v, '#d46b08') },
          { title: 'Expiring ≤ 30 days', dataIndex: 'expiring', align: 'right', render: (v: number, r) => (r.category === 'insurance' ? num(v, '#d46b08') : '—') },
          { title: 'Expired', dataIndex: 'expired', align: 'right', render: (v: number, r) => (r.category === 'insurance' ? num(v, '#cf1322') : '—') },
        ]}
        summary={() => data && (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}><strong>Total</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right"><strong>{data.totals.queue}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right"><strong>{data.totals.open}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right"><strong>{data.totals.expiring}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right"><strong>{data.totals.expired}</strong></Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        In queue = open or reopened and not yet picked up. Expiring/expired count policies nobody has renewed yet.
      </Typography.Text>
    </Card>
  );
}
