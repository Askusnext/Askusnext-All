import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Empty, Input, Select, Space, Table, Tabs, Tag, Tooltip, Typography, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useAppSelector } from '../store';
import { isAdminRole } from '../access';
import {
  ACTIVITY_LIVE, AREA_LABEL, activityApi, ago, timeOnly, whenFull,
  type ActivityArea, type ActivityItem, type StaffMember, type SummaryRow, type WorkloadRow,
} from '../api/activity';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const areaOptions = (Object.keys(AREA_LABEL) as ActivityArea[]).map((a) => ({ value: a, label: AREA_LABEL[a].label }));
const rangeIso = (r: [Dayjs, Dayjs]) => ({ from: r[0].startOf('day').toISOString(), to: r[1].endOf('day').add(1, 'millisecond').toISOString() });

function AreaTag({ area }: { area: ActivityArea }) {
  const a = AREA_LABEL[area] ?? { label: area, color: 'default' };
  return <Tag color={a.color} style={{ marginRight: 0 }}>{a.label}</Tag>;
}

export default function ActivityPage() {
  const me = useAppSelector((s) => s.auth.user);
  const isAdmin = isAdminRole(me?.role);

  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs()]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [workload, setWorkload] = useState<WorkloadRow[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [error, setError] = useState('');

  const [tab, setTab] = useState('team');
  const [person, setPerson] = useState<string | undefined>();
  const [area, setArea] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);

  const loadTeam = useCallback(async () => {
    if (!ACTIVITY_LIVE) return;
    setTeamLoading(true);
    try {
      const { from, to } = rangeIso(range);
      const [s, sm, w] = await Promise.all([activityApi.staff(), activityApi.summary(from, to), activityApi.workload()]);
      setStaff(s); setSummary(sm); setWorkload(w); setError('');
    } catch (e) { setError(errText(e)); } finally { setTeamLoading(false); }
  }, [range]);

  const loadFeed = useCallback(async (more = false) => {
    if (!ACTIVITY_LIVE) return;
    setFeedLoading(true);
    try {
      const { from, to } = rangeIso(range);
      const res = await activityApi.list({ userId: person, module: area, q: search.trim() || undefined, from, to, limit: 50, before: more && next ? next : undefined });
      setItems((cur) => (more ? [...cur, ...res.items] : res.items));
      setNext(res.nextBefore);
      setError('');
    } catch (e) { setError(errText(e)); } finally { setFeedLoading(false); }
  }, [range, person, area, search, next]);

  useEffect(() => { void loadTeam(); }, [loadTeam]);
  // reload the feed whenever a filter changes (not when paging)
  useEffect(() => { void loadFeed(false); }, [range, person, area, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // a person row combines who they are, what they did, and what they hold
  const team = useMemo(() => {
    const byId = new Map(summary.map((s) => [s.userId, s]));
    const work = new Map(workload.map((w) => [w.userId ?? 'none', w]));
    const people = staff.filter((p) => isAdmin || p.id === me?.id || work.has(p.id));
    return people.map((p) => ({ ...p, s: byId.get(p.id), w: work.get(p.id) }));
  }, [staff, summary, workload, isAdmin, me?.id]);
  const unassigned = workload.find((w) => w.userId === null);

  const exportCsv = () => {
    const rows = [['Time', 'Person', 'Role', 'Area', 'Action', 'Item', 'What happened'], ...items.map((i) => [i.at, i.actorName, i.actorRole, i.module, i.action, i.entityLabel ?? '', i.summary])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `activity_${range[0].format('YYYY-MM-DD')}_${range[1].format('YYYY-MM-DD')}.csv`; a.click();
    URL.revokeObjectURL(url);
    message.success(`Exported ${items.length} rows`);
  };

  const teamColumns: ColumnsType<(typeof team)[number]> = [
    { title: 'Person', render: (_, r) => (<div><div style={{ fontWeight: 600 }}>{r.name}{r.id === me?.id && <Tag color="blue" style={{ marginLeft: 6 }}>You</Tag>}</div><Text type="secondary" style={{ fontSize: 12 }}>{r.role}</Text></div>) },
    { title: 'Actions', align: 'right', sorter: (a, b) => (a.s?.total ?? 0) - (b.s?.total ?? 0), render: (_, r) => <b>{r.s?.total ?? 0}</b> },
    { title: 'Loans', align: 'right', render: (_, r) => r.s?.byModule.loans ?? 0 },
    { title: 'Insurance', align: 'right', render: (_, r) => r.s?.byModule.insurance ?? 0 },
    { title: 'Tickets', align: 'right', render: (_, r) => r.s?.byModule.tickets ?? 0 },
    { title: 'Opened records', align: 'right', render: (_, r) => r.s?.views ?? 0 },
    { title: 'First / last activity', render: (_, r) => (r.s ? <span>{timeOnly(r.s.first)} – {timeOnly(r.s.last)}<br /><Text type="secondary" style={{ fontSize: 12 }}>last {ago(r.s.last)}</Text></span> : <Text type="secondary">No activity</Text>) },
    {
      title: 'Open work now', align: 'right',
      render: (_, r) => (r.w ? (
        <Tooltip title={`Loans ${r.w.loans} · Insurance ${r.w.insurance} · Tickets ${r.w.tickets}`}><Tag color={r.w.total > 0 ? 'gold' : 'default'}>{r.w.total} open</Tag></Tooltip>
      ) : <Tag>0 open</Tag>),
    },
  ];

  const feedColumns: ColumnsType<ActivityItem> = [
    { title: 'When', width: 150, render: (_, i) => (<Tooltip title={whenFull(i.at)}><span>{timeOnly(i.at)}<br /><Text type="secondary" style={{ fontSize: 11 }}>{new Date(i.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {ago(i.at)}</Text></span></Tooltip>) },
    { title: 'Who', width: 170, render: (_, i) => (<div><div style={{ fontWeight: 600 }}>{i.actorName}</div><Text type="secondary" style={{ fontSize: 12 }}>{i.actorRole}</Text></div>) },
    { title: 'Area', width: 110, render: (_, i) => <AreaTag area={i.module} /> },
    { title: 'What happened', dataIndex: 'summary' },
    { title: 'Item', width: 190, render: (_, i) => (i.entityLabel ? <Text code style={{ fontSize: 11 }}>{i.entityLabel}</Text> : '—') },
  ];

  if (!ACTIVITY_LIVE) {
    return (
      <div style={{ padding: 28 }}>
        <Title level={3}>Activity</Title>
        <Alert type="info" showIcon message="Connect to the backend to track activity"
          description="Activity is recorded by the AskUs API. Create apps/solutions-web/.env.local with NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api, restart the dev server and sign in again." />
      </div>
    );
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Activity</Title>
          <Text type="secondary">{isAdmin ? 'Everything your team does across loans, insurance, tickets, timesheets and work tracking.' : 'Your own activity, and what the team is working on.'}</Text>
        </div>
        <Space wrap>
          <RangePicker value={range} onChange={(r) => r && r[0] && r[1] && setRange([r[0] as unknown as Dayjs, r[1] as unknown as Dayjs])} allowClear={false} disabledDate={(d) => d.isAfter(dayjs(), 'day')} />
          <Button icon={<ReloadOutlined />} onClick={() => { void loadTeam(); void loadFeed(false); }} loading={teamLoading || feedLoading}>Refresh</Button>
        </Space>
      </div>
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Could not load activity" description={error} />}

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'team',
            label: 'Team',
            children: (
              <>
                {unassigned && unassigned.total > 0 && (
                  <Alert style={{ marginBottom: 12 }} type="warning" showIcon
                    message={`${unassigned.total} open item${unassigned.total === 1 ? '' : 's'} with nobody assigned`}
                    description={`Loans ${unassigned.loans} · Insurance ${unassigned.insurance} · Tickets ${unassigned.tickets}. Open Askus Financial Services or Insurance Requests and assign them.`} />
                )}
                <Table
                  rowKey="id" size="small" loading={teamLoading} columns={teamColumns} dataSource={team} pagination={false}
                  onRow={(r) => ({ onClick: () => { setPerson(r.id); setTab('feed'); }, style: { cursor: 'pointer' } })}
                  locale={{ emptyText: <Empty description="No staff yet" /> }} scroll={{ x: 900 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>Click a person to see everything they did in this period.</Text>
              </>
            ),
          },
          {
            key: 'feed',
            label: 'Activity feed',
            children: (
              <>
                <Space style={{ marginBottom: 12 }} wrap>
                  {isAdmin && (
                    <Select allowClear placeholder="Everyone" value={person} onChange={setPerson} style={{ width: 200 }}
                      options={staff.map((s) => ({ value: s.id, label: `${s.name} (${s.role})` }))} showSearch optionFilterProp="label" />
                  )}
                  <Select allowClear placeholder="All areas" value={area} onChange={setArea} style={{ width: 160 }} options={areaOptions} />
                  <Input.Search allowClear placeholder="Search reference, name, text" style={{ width: 260 }} onSearch={setSearch} />
                  <Button icon={<DownloadOutlined />} disabled={items.length === 0} onClick={exportCsv}>Export CSV</Button>
                </Space>
                <Table<ActivityItem>
                  rowKey="id" size="small" loading={feedLoading && items.length === 0} columns={feedColumns} dataSource={items} pagination={false}
                  locale={{ emptyText: <Empty description="No activity in this period" /> }} scroll={{ x: 800 }}
                />
                {next && <div style={{ textAlign: 'center', marginTop: 12 }}><Button loading={feedLoading} onClick={() => void loadFeed(true)}>Load more</Button></div>}
                {items.length > 0 && <Text type="secondary" style={{ fontSize: 12 }}>{items.length} shown{next ? ', more available' : ''}.</Text>}
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
