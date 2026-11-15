import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Input, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAppSelector } from '../store';
import AssignBox from '../components/AssignBox';
import ItemTrail from '../components/ItemTrail';
import { activityApi } from '../api/activity';
import {
  INSURANCE_LIVE, REQUEST_STATUSES, insuranceAdminApi, type InsuranceRequestRow, type RequestStatus,
} from '../api/insuranceAdmin';

const { Title, Text, Paragraph } = Typography;

const STATUS: Record<RequestStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'blue' },
  contacted: { label: 'Contacted', color: 'geekblue' },
  quoted: { label: 'Quoted', color: 'orange' },
  issued: { label: 'Issued', color: 'green' },
  closed: { label: 'Closed', color: 'default' },
};

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const pretty = (s?: string) => (s ? s.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, (c) => c.toUpperCase()) : '—');
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const who = (r: InsuranceRequestRow) => ({
  name: r.kind === 'offline' ? r.applicant?.name ?? '—' : r.name ?? '—',
  mobile: r.kind === 'offline' ? r.applicant?.mobile ?? '' : r.mobile ?? '',
});

function StatusTag({ status }: { status: RequestStatus }) {
  const s = STATUS[status] ?? { label: pretty(status), color: 'default' };
  return <Tag color={s.color}>{s.label}</Tag>;
}

/** Key/value pairs from a loose object, skipping empty values. */
function Facts({ title, data }: { title: string; data?: Record<string, unknown> }) {
  const entries = Object.entries(data ?? {}).filter(([, v]) => v !== '' && v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0));
  if (entries.length === 0) return null;
  return (
    <>
      <Title level={5} style={{ marginTop: 14 }}>{title}</Title>
      <Descriptions size="small" column={2} bordered>
        {entries.map(([k, v]) => (
          <Descriptions.Item key={k} label={pretty(k)}>{Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</Descriptions.Item>
        ))}
      </Descriptions>
    </>
  );
}

export default function InsuranceRequestsPage() {
  const [rows, setRows] = useState<InsuranceRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignFilter, setAssignFilter] = useState<'all' | 'mine' | 'none'>('all');
  const meId = useAppSelector((s) => s.auth.user)?.id;
  const [kind, setKind] = useState<'offline' | 'upload'>('offline');
  const [open, setOpen] = useState<InsuranceRequestRow | null>(null);
  const [status, setStatus] = useState<RequestStatus>('new');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!INSURANCE_LIVE) return;
    setLoading(true);
    try {
      const list = await insuranceAdminApi.list();
      setRows(list);
      setOpen((cur) => (cur ? list.find((r) => r.id === cur.id) ?? cur : cur));
      setError('');
    } catch (e) { setError(errText(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (open) { setStatus(open.status); setNote(open.adminNote ?? ''); } }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // record that this customer's request was opened
  useEffect(() => {
    if (open) void activityApi.view({ module: 'insurance', entityType: 'insurance_request', entityId: open.id, entityLabel: `${who(open).name} (${open.kind === 'offline' ? open.vehicleType : 'documents'})` });
  }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = search.trim().toLowerCase();
  const shown = useMemo(() => rows.filter((r) =>
    r.kind === kind && (statusFilter === 'all' || r.status === statusFilter) &&
    (assignFilter === 'all' || (assignFilter === 'mine' ? r.assignedToId === meId : !r.assignedToId)) &&
    (!q || [who(r).name, who(r).mobile, r.vehicle?.regNumber as string, r.vehicle?.makeModel as string, r.type, r.id].some((v) => (v ?? '').toString().toLowerCase().includes(q))),
  ), [rows, kind, statusFilter, assignFilter, meId, q]);

  const count = (s: RequestStatus) => rows.filter((r) => r.status === s).length;
  const stats = [
    { label: 'All requests', value: rows.length },
    { label: 'New', value: count('new') },
    { label: 'Contacted', value: count('contacted') },
    { label: 'Quoted', value: count('quoted') },
    { label: 'Issued', value: count('issued') },
  ];

  const save = async () => {
    if (!open) return;
    setSaving(true);
    try {
      await insuranceAdminApi.review(open.id, status, note.trim());
      message.success('Updated');
      await load();
    } catch (e) { message.error(errText(e)); } finally { setSaving(false); }
  };

  const columns: ColumnsType<InsuranceRequestRow> = [
    { title: 'Customer', render: (_, r) => (<div><div style={{ fontWeight: 600 }}>{who(r).name}</div><Text type="secondary" style={{ fontSize: 12 }}>{who(r).mobile}</Text></div>) },
    kind === 'offline'
      ? { title: 'Vehicle', render: (_, r) => (<div><div>{(r.vehicle?.makeModel as string) || '—'}</div><Text type="secondary" style={{ fontSize: 12 }}>{(r.vehicle?.regNumber as string) || 'New vehicle'} · {r.vehicleType}</Text></div>) }
      : { title: 'Document type', render: (_, r) => r.type ?? '—' },
    { title: 'Files', render: (_, r) => r.documents.length },
    { title: 'Working on it', render: (_, r) => (r.assignedToName ? <Tag color={r.assignedToId === meId ? 'blue' : 'default'}>{r.assignedToName}</Tag> : <Text type="secondary">Nobody</Text>) },
    { title: 'Status', dataIndex: 'status', render: (s: RequestStatus) => <StatusTag status={s} /> },
    { title: 'Submitted', dataIndex: 'createdAt', render: when },
  ];

  if (!INSURANCE_LIVE) {
    return (
      <div style={{ padding: 28 }}>
        <Title level={3}>Insurance Requests</Title>
        <Alert type="info" showIcon message="Connect to the backend to see insurance requests"
          description="This screen reads real data from the AskUs API. Create apps/solutions-web/.env.local with NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api, restart the dev server and sign in again." />
      </div>
    );
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Insurance Requests</Title>
          <Text type="secondary">Everything customers submit on the insurance site, live from the database.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Refresh</Button>
      </div>
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Could not load insurance requests" description={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        {stats.map((s) => (
          <Card key={s.label} size="small"><Text type="secondary" style={{ fontSize: 12 }}>{s.label}</Text><div style={{ fontSize: 26, fontWeight: 700 }}>{s.value}</div></Card>
        ))}
      </div>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search placeholder="Search name, mobile, vehicle number" allowClear style={{ width: 320 }} onChange={(e) => setSearch(e.target.value)} />
        <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 170 }}
          options={[{ value: 'all', label: 'All statuses' }, ...REQUEST_STATUSES.map((s) => ({ value: s, label: STATUS[s].label }))]} />
        <Select value={assignFilter} onChange={setAssignFilter} style={{ width: 170 }}
          options={[{ value: 'all', label: 'Everyone\'s items' }, { value: 'mine', label: 'Assigned to me' }, { value: 'none', label: 'Unassigned' }]} />
      </Space>

      <Tabs
        activeKey={kind}
        onChange={(k) => setKind(k as 'offline' | 'upload')}
        items={[
          { key: 'offline', label: `Car & bike quotes (${rows.filter((r) => r.kind === 'offline').length})` },
          { key: 'upload', label: `Documents sent (${rows.filter((r) => r.kind === 'upload').length})` },
        ]}
      />
      <Table<InsuranceRequestRow>
        rowKey="id" loading={loading} columns={columns} dataSource={shown}
        onRow={(r) => ({ onClick: () => setOpen(r), style: { cursor: 'pointer' } })}
        locale={{ emptyText: <Empty description="Nothing here yet" /> }} scroll={{ x: 800 }}
      />

      <Drawer open={Boolean(open)} width={700} onClose={() => setOpen(null)} title={open ? <Space>{who(open).name}<StatusTag status={open.status} /></Space> : ''}>
        {open && (
          <>
            <Descriptions size="small" column={2} bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Customer">{who(open).name}</Descriptions.Item>
              <Descriptions.Item label="Mobile">{who(open).mobile || '—'}</Descriptions.Item>
              <Descriptions.Item label="Kind">{open.kind === 'offline' ? `${pretty(open.vehicleType)} insurance quote` : 'Documents sent'}</Descriptions.Item>
              <Descriptions.Item label="Submitted">{when(open.createdAt)}</Descriptions.Item>
              {open.cashbackUpTo ? <Descriptions.Item label="Cashback up to">₹{open.cashbackUpTo}</Descriptions.Item> : null}
              {open.type ? <Descriptions.Item label="Document type">{open.type}</Descriptions.Item> : null}
            </Descriptions>

            <AssignBox assignedToId={open.assignedToId} assignedToName={open.assignedToName}
              onAssign={async (id) => { await insuranceAdminApi.assign(open.id, id); await load(); }} />

            <Title level={5}>Update status</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select value={status} onChange={setStatus} style={{ width: 200 }} options={REQUEST_STATUSES.map((s) => ({ value: s, label: STATUS[s].label }))} />
              <Input.TextArea rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for your team (the customer can see this too)" />
              <Button type="primary" loading={saving} disabled={status === open.status && note.trim() === (open.adminNote ?? '')} onClick={() => void save()}>Save</Button>
              {open.updatedBy && <Text type="secondary" style={{ fontSize: 12 }}>Last updated by {open.updatedBy}, {when(open.updatedAt)}</Text>}
            </Space>

            <Title level={5} style={{ marginTop: 16 }}>Documents</Title>
            {open.documents.length === 0 ? <Text type="secondary">No files attached.</Text> : (
              <Table size="small" pagination={false} rowKey="key" dataSource={open.documents}
                columns={[
                  { title: 'File', render: (_, d) => (<div>{d.name}<br /><Text type="secondary" style={{ fontSize: 12 }}>{d.kind === 'rc' ? 'RC · ' : d.kind === 'policy' ? 'Previous policy · ' : ''}{kb(d.size)}</Text></div>) },
                  { title: '', align: 'right', render: (_, d) => (<Button size="small" icon={<FileTextOutlined />} onClick={() => void insuranceAdminApi.openDocument(d.key).catch((e) => message.error(errText(e)))}>View</Button>) },
                ]}
              />
            )}

            {open.kind === 'offline' && (
              <>
                <Facts title="Applicant" data={open.applicant} />
                <Facts title="Vehicle" data={open.vehicle} />
                <Facts title="Previous policy" data={open.policy} />
                <Facts title="Plan wanted" data={open.plan as Record<string, unknown> | undefined} />
              </>
            )}
            <ItemTrail entityId={open.id} refreshKey={`${open.updatedAt}${open.assignedToId ?? ''}${open.status}`} />
            <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 14 }}>Request ID {open.id}</Paragraph>
          </>
        )}
      </Drawer>
    </div>
  );
}
