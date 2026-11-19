import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Select, Space, Table, Tag, Typography, message } from 'antd';
import { ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { ticketingApi, type RenewalRow, type Renewals } from '../api/ticketing';
import { StatusBadge } from '../components/shared';
import type { TicketStatus } from '../types';

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/** Policies expiring soon or already expired. A renewal ticket is opened automatically when a finished policy enters the window. */
export default function RenewalsPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Renewals | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await ticketingApi.renewals(days)); } catch (e) { message.error(errText(e)); } finally { setLoading(false); }
  }, [days]);
  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    setRunning(true);
    try {
      const r = await ticketingApi.generateRenewals();
      message.success(r.created ? `Opened ${r.created} renewal ticket${r.created > 1 ? 's' : ''}: ${r.tickets.join(', ')}` : 'No new renewals are due');
      await load();
    } catch (e) { message.error(errText(e)); } finally { setRunning(false); }
  };

  const columns: ColumnsType<RenewalRow> = [
    { title: 'Reg. no.', dataIndex: 'vehicleRegNo', render: (v: string | null) => <strong>{v ?? '—'}</strong> },
    { title: 'Customer', render: (_, r) => <div>{r.customerName}<div style={{ fontSize: 11, color: '#475569' }}>{r.customerMobile}</div></div> },
    { title: 'Insurer', dataIndex: 'insurer' },
    { title: 'Expiry', dataIndex: 'expiryDate', render: (d: string, r) => (
      <Space direction="vertical" size={0}>
        <span>{d}</span>
        <Tag color={r.daysLeft < 0 ? 'red' : r.daysLeft <= 7 ? 'volcano' : 'orange'} style={{ width: 'fit-content' }}>
          {r.daysLeft < 0 ? `expired ${-r.daysLeft}d ago` : r.daysLeft === 0 ? 'expires today' : `in ${r.daysLeft}d`}
        </Tag>
      </Space>
    ) },
    { title: 'Source ticket', dataIndex: 'ticketNumber', render: (n: string, r) => <a onClick={() => navigate(`/tickets/${r.ticketId}`)}>{n}</a> },
    { title: 'Renewal ticket', render: (_, r) => r.renewalTicket
      ? <Space><a onClick={() => navigate(`/tickets/${r.renewalTicket!.id}`)}>{r.renewalTicket.ticketNumber}</a><StatusBadge status={r.renewalTicket.status as TicketStatus} /></Space>
      : <Typography.Text type="secondary">not opened yet</Typography.Text> },
  ];

  const table = (rows: RenewalRow[]) => (
    <Table<RenewalRow> rowKey="ticketId" size="small" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 15, hideOnSinglePage: true }} scroll={{ x: 'max-content' }} />
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Renewals</h2>
          <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>Insurance policies about to expire, and ones that already have</p>
        </div>
        <Space wrap>
          <Select value={days} onChange={setDays} style={{ width: 150 }} options={[{ value: 7, label: 'Next 7 days' }, { value: 15, label: 'Next 15 days' }, { value: 30, label: 'Next 30 days' }, { value: 60, label: 'Next 60 days' }, { value: 90, label: 'Next 90 days' }]} />
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button type="primary" icon={<ThunderboltOutlined />} loading={running} onClick={generate}>Open renewal tickets now</Button>
        </Space>
      </div>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Renewal tickets open by themselves" description="Every few hours the system opens an Insurance ticket for each finished policy that is within the renewal window (30 days by default) and has none yet. The ticket is Critical within 7 days, High within 15." />
      <Card size="small" title={<>Expiring soon <Tag color="orange">{data?.expiring.length ?? 0}</Tag></>} style={{ marginBottom: 16 }}>{table(data?.expiring ?? [])}</Card>
      <Card size="small" title={<>Already expired <Tag color="red">{data?.expired.length ?? 0}</Tag></>}>{table(data?.expired ?? [])}</Card>
    </div>
  );
}
