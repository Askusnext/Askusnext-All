import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, DatePicker, Form, InputNumber, Popconfirm, Progress, Select, Space, Statistic, Table, Tabs, Tag, Typography, message } from 'antd';
import { DownloadOutlined, PauseCircleOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useAppSelector } from '../store';
import { isAdminRole } from '../access';
import {
  downloadHours, hoursLabel, monitoringApi,
  type LiveRow, type LiveState, type MyMonitoring, type SettingsView, type SummaryRow, type TrackingMethod,
} from '../api/monitoring';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const STATE: Record<LiveState, { label: string; color: string }> = {
  working: { label: 'Working', color: 'green' },
  idle: { label: 'Idle', color: 'orange' },
  offline: { label: 'Offline', color: 'default' },
};
const METHOD_LABEL: Record<TrackingMethod, string> = { agent: 'Desktop agent', manual: 'Manual start/stop' };
const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return dayjs(iso).format('DD MMM, HH:mm');
};

// ───────────────────────── My hours ─────────────────────────

function MyHours() {
  const [me, setMe] = useState<MyMonitoring | null>(null);
  const [week, setWeek] = useState<SummaryRow['weeks'][number] | null>(null);
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const m = await monitoringApi.my();
      setMe(m);
      const monday = dayjs().subtract((dayjs().day() + 6) % 7, 'day');
      const rows = await monitoringApi.summary(monday.format('YYYY-MM-DD'), monday.add(6, 'day').format('YYYY-MM-DD'));
      setWeek(rows[0]?.weeks[0] ?? null);
    } catch (e) { message.error(errText(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const id = setInterval(() => void load(), 60_000); return () => clearInterval(id); }, [load]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) message.success(ok); await load(); } catch (e) { message.error(errText(e)); } finally { setBusy(false); }
  };

  if (!me) return null;
  const pct = week && week.targetToDateMinutes > 0 ? Math.min(100, Math.round((week.activeMinutes / week.targetToDateMinutes) * 100)) : 0;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {!me.consent.accepted && (
        <Card title="Work-hour monitoring notice">
          <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Draft wording" description="The final policy text must be reviewed by a lawyer against the DPDP Act 2023 and the IT Act before this is rolled out." />
          <Paragraph>{me.policy.text}</Paragraph>
          <Text type="secondary">You are asked once. The desktop agent will not start until this is accepted.</Text>
          <div style={{ marginTop: 12 }}>
            <Button type="primary" loading={busy} onClick={() => run(() => monitoringApi.consent(me.policy.version), 'Thank you, your acknowledgment is recorded')}>I have read and accept</Button>
          </div>
        </Card>
      )}

      <Card>
        <Space size={32} wrap align="center">
          <Statistic title="Active today" value={hoursLabel(me.todayMinutes)} />
          <Statistic title="Daily target" value={hoursLabel(me.targetMinutesPerDay)} valueStyle={{ fontSize: 20 }} />
          <div style={{ minWidth: 240 }}>
            <Text type="secondary">This week (average over the week, not a daily cut-off)</Text>
            <Progress percent={pct} status={week?.metTarget ? 'success' : 'active'} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {week ? `${hoursLabel(week.activeMinutes)} of ${hoursLabel(week.targetToDateMinutes)} expected so far (${hoursLabel(week.targetMinutes)} for the week)` : ''}
            </Text>
          </div>
          <Tag>{METHOD_LABEL[me.method]}</Tag>
        </Space>
      </Card>

      {me.method === 'manual' ? (
        <Card title="Start and stop work">
          <Paragraph type="secondary">Your hours are recorded by you, not by a desktop agent. Start when you begin working and stop when you finish.</Paragraph>
          {me.running ? (
            <Space>
              <Tag color="green">Running since {dayjs(me.startedAt).format('HH:mm')}</Tag>
              <Button danger icon={<PauseCircleOutlined />} loading={busy} onClick={() => run(() => monitoringApi.manual('stop'), 'Stopped')}>Stop work</Button>
            </Space>
          ) : (
            <Button type="primary" icon={<PlayCircleOutlined />} loading={busy} onClick={() => run(() => monitoringApi.manual('start'), 'Started')}>Start work</Button>
          )}
        </Card>
      ) : (
        <Card title="Desktop agent (Windows)">
          <Paragraph type="secondary">
            The agent runs quietly after you sign in to Windows, shows a tray icon, and records only whether you are active or idle and the name of the app in use. It never records keystrokes, mouse movements or screen contents.
          </Paragraph>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Button type="primary" disabled={!me.consent.accepted} loading={busy} onClick={() => run(async () => setPairing(await monitoringApi.pairingCode()))}>Generate a pairing code</Button>
            {!me.consent.accepted && <Text type="secondary">Accept the notice above first.</Text>}
            {pairing && (
              <Alert
                type="success" showIcon
                message={<span>Pairing code: <Text code copyable style={{ fontSize: 18 }}>{pairing.code}</Text></span>}
                description={<>On your Windows PC run <Text code>node agent.mjs pair --code {pairing.code}</Text>. The code works once and expires at {dayjs(pairing.expiresAt).format('HH:mm')}.</>}
              />
            )}
            <Table
              rowKey="id" size="small" pagination={false} dataSource={me.devices.filter((d) => !d.revoked)} locale={{ emptyText: 'No PC is paired yet' }}
              columns={[
                { title: 'Device', dataIndex: 'deviceName' },
                { title: 'Paired', dataIndex: 'pairedAt', render: (d: string) => dayjs(d).format('DD MMM YYYY') },
                { title: 'Last heartbeat', dataIndex: 'lastSeenAt', render: ago },
                { title: '', render: (_: unknown, d: MyMonitoring['devices'][number]) => <Popconfirm title="Remove this PC? Its agent will stop." onConfirm={() => run(() => monitoringApi.removeDevice(d.id), 'Removed')}><Button size="small" danger>Remove</Button></Popconfirm> },
              ]}
            />
          </Space>
        </Card>
      )}
    </Space>
  );
}

// ───────────────────────── Live status (admin) ─────────────────────────

function LiveStatus() {
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await monitoringApi.live()); } catch (e) { message.error(errText(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); const id = setInterval(() => void load(), 30_000); return () => clearInterval(id); }, [load]);

  const count = (s: LiveState) => rows.filter((r) => r.status === s).length;
  const columns: ColumnsType<LiveRow> = [
    { title: 'Employee', dataIndex: 'employeeName', render: (n: string, r) => <div><div>{n}</div><Text type="secondary" style={{ fontSize: 11 }}>{r.role}</Text></div> },
    { title: 'Status', dataIndex: 'status', render: (s: LiveState) => <Tag color={STATE[s].color}>{STATE[s].label}</Tag>, filters: (Object.keys(STATE) as LiveState[]).map((s) => ({ text: STATE[s].label, value: s })), onFilter: (v, r) => r.status === v },
    { title: 'Tracked by', dataIndex: 'method', render: (m: TrackingMethod, r) => <span>{METHOD_LABEL[m]}{m === 'agent' && r.devices === 0 ? <Tag style={{ marginLeft: 6 }}>no PC paired</Tag> : null}</span> },
    { title: 'App in use', dataIndex: 'activeApp', render: (a: string | null) => a ?? '-' },
    { title: 'Last seen', dataIndex: 'lastSeen', render: ago },
    {
      title: 'Active today', dataIndex: 'todayActiveMinutes',
      sorter: (a, b) => a.todayActiveMinutes - b.todayActiveMinutes,
      render: (m: number, r) => <span>{hoursLabel(m)} <Text type="secondary" style={{ fontSize: 11 }}>of {hoursLabel(r.targetMinutesPerDay)}</Text></span>,
    },
    { title: 'Notice accepted', dataIndex: 'consented', render: (c: boolean) => (c ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>) },
  ];

  return (
    <Card
      title="Who is working right now"
      extra={<Space><Text type="secondary">Refreshes every 30 s</Text><Button icon={<ReloadOutlined />} onClick={load} /></Space>}
    >
      <Space size={32} style={{ marginBottom: 12 }}>
        <Statistic title="Working" value={count('working')} valueStyle={{ color: '#166534' }} />
        <Statistic title="Idle" value={count('idle')} valueStyle={{ color: '#9a3412' }} />
        <Statistic title="Offline" value={count('offline')} />
      </Space>
      <Table rowKey="userId" size="small" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 15, hideOnSinglePage: true }} scroll={{ x: 800 }} />
    </Card>
  );
}

// ───────────────────────── Daily totals ─────────────────────────

function DailyTotals({ isAdmin }: { isAdmin: boolean }) {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract((dayjs().day() + 6) % 7, 'day'), dayjs()]);
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);

  const from = range[0].format('YYYY-MM-DD');
  const to = range[1].format('YYYY-MM-DD');
  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await monitoringApi.summary(from, to)); } catch (e) { message.error(errText(e)); } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);

  const doExport = async (format: 'xlsx' | 'pdf') => {
    setExporting(format);
    try { await downloadHours(from, to, format); } catch (e) { message.error(errText(e)); } finally { setExporting(null); }
  };

  const columns: ColumnsType<SummaryRow> = [
    { title: 'Employee', dataIndex: 'employeeName' },
    { title: 'Tracked by', dataIndex: 'method', render: (m: TrackingMethod) => METHOD_LABEL[m] },
    { title: 'Days with activity', render: (_: unknown, r) => r.days.filter((d) => d.totalActiveMinutes > 0).length, align: 'right' },
    { title: 'Total active', dataIndex: 'totalActiveMinutes', render: hoursLabel, sorter: (a, b) => a.totalActiveMinutes - b.totalActiveMinutes, align: 'right' },
    {
      title: 'Weeks vs target',
      render: (_: unknown, r) => (
        <Space direction="vertical" size={2} style={{ width: 220 }}>
          {r.weeks.map((w) => {
            const base = w.targetToDateMinutes || w.targetMinutes;
            return (
              <div key={w.weekStart} style={{ fontSize: 12 }}>
                <Text type="secondary">Week of {dayjs(w.weekStart).format('DD MMM')}</Text>
                <Progress size="small" percent={base ? Math.min(100, Math.round((w.activeMinutes / base) * 100)) : 0} status={w.metTarget ? 'success' : 'normal'} format={() => `${hoursLabel(w.activeMinutes)} / ${hoursLabel(w.targetMinutes)}`} />
              </div>
            );
          })}
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={isAdmin ? 'Daily and weekly totals' : 'My daily and weekly totals'}
      extra={
        <Space wrap>
          <RangePicker allowClear={false} value={range} onChange={(v) => v && v[0] && v[1] && setRange([v[0] as unknown as Dayjs, v[1] as unknown as Dayjs])} />
          {isAdmin && <Button icon={<DownloadOutlined />} loading={exporting === 'xlsx'} onClick={() => doExport('xlsx')}>Excel</Button>}
          {isAdmin && <Button icon={<DownloadOutlined />} loading={exporting === 'pdf'} onClick={() => doExport('pdf')}>PDF</Button>}
        </Space>
      }
    >
      <Table
        rowKey="userId" size="small" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 800 }}
        expandable={{
          expandedRowRender: (r) => (
            <Table
              rowKey="date" size="small" pagination={false} dataSource={r.days} locale={{ emptyText: 'No activity in this range' }}
              columns={[
                { title: 'Date', dataIndex: 'date', render: (d: string) => dayjs(d).format('ddd, DD MMM') },
                { title: 'Active', dataIndex: 'totalActiveMinutes', render: hoursLabel },
                { title: 'Idle', dataIndex: 'totalIdleMinutes', render: hoursLabel },
                { title: 'First', dataIndex: 'firstActivity', render: (t: string | null) => (t ? dayjs(t).format('HH:mm') : '-') },
                { title: 'Last', dataIndex: 'lastActivity', render: (t: string | null) => (t ? dayjs(t).format('HH:mm') : '-') },
              ]}
            />
          ),
        }}
      />
    </Card>
  );
}

// ───────────────────────── Targets and tracking method (admin) ─────────────────────────

function Targets() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [form] = Form.useForm<{ scope: 'user' | 'role'; target: string; hours?: number; method?: TrackingMethod }>();
  const scope = Form.useWatch('scope', form);

  const load = useCallback(async () => {
    try {
      const [v, live] = await Promise.all([monitoringApi.settings(), monitoringApi.live()]);
      setView(v);
      setStaff(live.map((l) => ({ id: l.userId, name: l.employeeName })));
    } catch (e) { message.error(errText(e)); }
  }, []);
  useEffect(() => { void load(); form.setFieldsValue({ scope: 'role', target: 'Employee' }); }, [load, form]);

  const save = async (v: { scope: 'user' | 'role'; target: string; hours?: number; method?: TrackingMethod }) => {
    try {
      setView(await monitoringApi.saveSetting({ scope: v.scope, target: v.target, targetMinutesPerDay: v.hours === undefined || v.hours === null ? undefined : Math.round(v.hours * 60), trackingMethod: v.method }));
      message.success('Saved');
    } catch (e) { message.error(errText(e)); }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title="Minimum hours and tracking method">
        <Paragraph type="secondary">
          Default: {hoursLabel(view?.defaultTargetMinutesPerDay ?? 480)} a day, averaged over the week, so a short day can be offset by a longer one. Set a different target or tracking method for a role or for one person. A person's rule beats their role's rule.
        </Paragraph>
        <Form form={form} layout="inline" onFinish={save} style={{ rowGap: 8 }}>
          <Form.Item name="scope" rules={[{ required: true }]}><Select style={{ width: 110 }} options={[{ value: 'role', label: 'Role' }, { value: 'user', label: 'Person' }]} onChange={() => form.setFieldValue('target', undefined)} /></Form.Item>
          <Form.Item name="target" rules={[{ required: true, message: 'Choose who' }]}>
            <Select style={{ width: 200 }} placeholder="Choose" options={scope === 'user' ? staff.map((s) => ({ value: s.id, label: s.name })) : ['Admin', 'Employee', 'Agent'].map((r) => ({ value: r, label: r }))} />
          </Form.Item>
          <Form.Item name="hours"><InputNumber min={0} max={24} step={0.5} placeholder="Hours / day" style={{ width: 130 }} /></Form.Item>
          <Form.Item name="method"><Select allowClear style={{ width: 190 }} placeholder="Tracking method" options={[{ value: 'agent', label: METHOD_LABEL.agent }, { value: 'manual', label: METHOD_LABEL.manual }]} /></Form.Item>
          <Button type="primary" htmlType="submit">Save</Button>
        </Form>
      </Card>
      <Card title="Current rules">
        <Table
          rowKey="id" size="small" pagination={false} dataSource={view?.rules ?? []} locale={{ emptyText: 'No custom rules. Everyone uses the defaults.' }}
          columns={[
            { title: 'Applies to', render: (_: unknown, r: SettingsView['rules'][number]) => `${r.scope === 'role' ? 'Role' : 'Person'}: ${r.label}` },
            { title: 'Hours per day', dataIndex: 'targetMinutesPerDay', render: (m: number | null) => (m === null ? 'Default' : hoursLabel(m)) },
            { title: 'Tracking method', dataIndex: 'trackingMethod', render: (m: TrackingMethod | null) => (m ? METHOD_LABEL[m] : 'Default') },
            { title: '', render: (_: unknown, r: SettingsView['rules'][number]) => <Popconfirm title="Remove this rule?" onConfirm={async () => { try { setView(await monitoringApi.removeSetting(r.id)); } catch (e) { message.error(errText(e)); } }}><Button size="small">Remove</Button></Popconfirm> },
          ]}
        />
      </Card>
    </Space>
  );
}

// ───────────────────────── Page ─────────────────────────

export default function WorkHoursPage() {
  const me = useAppSelector((s) => s.auth.user);
  const isAdmin = isAdminRole(me?.role);
  const items = [
    { key: 'mine', label: 'My hours', children: <MyHours /> },
    ...(isAdmin ? [{ key: 'live', label: 'Live status', children: <LiveStatus /> }] : []),
    { key: 'totals', label: 'Daily totals', children: <DailyTotals isAdmin={isAdmin} /> },
    ...(isAdmin ? [{ key: 'targets', label: 'Targets & method', children: <Targets /> }] : []),
  ];
  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginTop: 0 }}>Work hours</Title>
      <Tabs items={items} destroyInactiveTabPane />
    </div>
  );
}
