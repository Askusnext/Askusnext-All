import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Drawer, Empty, Select, Space, Table, Tag, Timeline, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { presenceApi, type HistoryResponse, type PresenceRow, type PresenceState } from '../api/presence';
import { useAppSelector } from '../store';
import { LiveFeed, type Connection } from '../presence/liveFeed';
import { DISCLAIMER, LEGEND, STATE_COLOR, STATE_LABEL, applyFeedEvent, timeInState, type FeedEvent } from '../presence/logic';

const { Title, Text, Paragraph } = Typography;

const CONNECTION_TEXT: Record<Connection, { color: string; text: string }> = {
  connecting: { color: 'blue', text: 'Connecting…' },
  live: { color: 'green', text: 'Live' },
  reconnecting: { color: 'orange', text: 'Reconnecting…' },
  disconnected: { color: 'red', text: 'Disconnected' },
};

/**
 * Presence of the people the signed-in manager may see. What "may see" means is decided by the server on
 * every request and every socket message; the Employee/Agent roles never reach this page at all.
 */
export default function PresencePage() {
  const navigate = useNavigate();
  const role = useAppSelector((s) => s.auth.user?.role);
  const isSuper = role === 'SuperAdmin';

  const [rows, setRows] = useState<Map<string, PresenceRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [offsetMs, setOffsetMs] = useState(0);
  const [, setTick] = useState(0);
  const [filters, setFilters] = useState<{ role?: string; state?: string; adminId?: string }>({});
  const [admins, setAdmins] = useState<{ id: string; name: string }[]>([]);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const load = useCallback(async () => {
    try {
      const res = await presenceApi.team({ ...filtersRef.current, pageSize: 200 });
      setOffsetMs(new Date(res.serverNow).getTime() - Date.now());
      setRows((cur) => applyFeedEvent(cur, { type: 'snapshot', rows: res.rows }));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load presence');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial authorized snapshot, then the scoped live feed. Everything is cleaned up on unmount/logout.
  useEffect(() => {
    void load();
    const feed = new LiveFeed({
      onEvent: (e: FeedEvent) => setRows((cur) => applyFeedEvent(cur, e)),
      onConnection: setConnection,
      onReady: () => void load(), // after a (re)connect, fetch a fresh authorized snapshot before trusting live events
    });
    feed.start();
    const ticker = setInterval(() => setTick((n) => n + 1), 1000);
    const poll = setInterval(() => void load(), 60_000); // fallback if the socket is blocked by a proxy
    return () => {
      feed.stop();
      clearInterval(ticker);
      clearInterval(poll);
    };
  }, [load]);

  useEffect(() => {
    if (isSuper) presenceApi.admins().then(setAdmins).catch(() => undefined);
  }, [isSuper]);

  useEffect(() => { void load(); }, [filters, load]);

  const openHistory = async (r: PresenceRow) => {
    setHistoryFor(r.userId);
    setHistory(null);
    try {
      setHistory(await presenceApi.history(r.userId, 50));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Could not load history');
      setHistoryFor(null);
    }
  };

  const visible = useMemo(
    () => [...rows.values()]
      .filter((r) => (!filters.role || r.role === filters.role) && (!filters.state || r.state === filters.state)
        && (!filters.adminId || (filters.adminId === 'none' ? !r.reportingAdminId : r.reportingAdminId === filters.adminId)))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [rows, filters],
  );

  const stale = connection !== 'live';

  const columns: ColumnsType<PresenceRow> = [
    { title: 'Staff', dataIndex: 'name', key: 'name' },
    { title: 'Role', dataIndex: 'role', key: 'role', render: (r: string) => <Tag>{r}</Tag> },
    ...(isSuper
      ? [{
          title: 'Reporting Admin', key: 'admin',
          render: (_: unknown, r: PresenceRow) => (r.role === 'Admin' ? <Text type="secondary">—</Text> : r.reportingAdminName ?? <Tag color="red">Unassigned</Tag>),
        }]
      : []),
    {
      title: 'Presence', key: 'state',
      render: (_: unknown, r: PresenceRow) => <Tag color={STATE_COLOR[r.state]} style={stale ? { opacity: 0.55 } : undefined}>{STATE_LABEL[r.state]}</Tag>,
    },
    { title: 'Time in state', key: 'since', render: (_: unknown, r: PresenceRow) => timeInState(r, offsetMs) ?? '—' },
    { title: 'Last seen', key: 'last', render: (_: unknown, r: PresenceRow) => (r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString() : '—') },
    { title: '', key: 'h', render: (_: unknown, r: PresenceRow) => <Button size="small" onClick={() => openHistory(r)}>History</Button> },
  ];

  return (
    <div data-testid="presence-page">
      <Space align="center" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
        <div>
          <Title level={3} style={{ margin: 0 }}>Team Presence</Title>
          <Text type="secondary">{isSuper ? 'All Admins, Employees and Agents' : 'Employees and Agents assigned to you'}</Text>
        </div>
        <Space>
          <Tag data-testid="connection-tag" color={CONNECTION_TEXT[connection].color}>{CONNECTION_TEXT[connection].text}</Tag>
          <Button icon={<ReloadOutlined />} onClick={() => load()}>Refresh</Button>
          {isSuper && <Button type="primary" onClick={() => navigate('/users')}>Manage assignments</Button>}
        </Space>
      </Space>

      {stale && (
        <Alert
          data-testid="stale-banner"
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={connection === 'disconnected' ? 'Live updates are off. What you see may be out of date.' : 'Reconnecting. What you see may be out of date until the connection returns.'}
        />
      )}
      {loadError && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={loadError} />}

      <Space wrap style={{ marginBottom: 12 }}>
        <Select allowClear placeholder="Role" style={{ width: 150 }} value={filters.role} onChange={(v) => setFilters((f) => ({ ...f, role: v }))}
          options={[...(isSuper ? [{ value: 'Admin', label: 'Admin' }] : []), { value: 'Employee', label: 'Employee' }, { value: 'Agent', label: 'Agent' }]} />
        <Select allowClear placeholder="Presence state" style={{ width: 200 }} value={filters.state} onChange={(v) => setFilters((f) => ({ ...f, state: v }))}
          options={(Object.keys(STATE_LABEL) as PresenceState[]).map((s) => ({ value: s, label: STATE_LABEL[s] }))} />
        {isSuper && (
          <Select allowClear placeholder="Reporting Admin / team" style={{ width: 230 }} value={filters.adminId} onChange={(v) => setFilters((f) => ({ ...f, adminId: v }))}
            options={[{ value: 'none', label: 'Unassigned' }, ...admins.map((a) => ({ value: a.id, label: a.name }))]} />
        )}
      </Space>

      <Table<PresenceRow>
        rowKey="userId"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={visible}
        pagination={{ pageSize: 25, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description={isSuper ? 'No staff match these filters' : 'No staff are assigned to you yet'} /> }}
      />

      <Card size="small" title="What these states mean" style={{ marginTop: 16 }}>
        {LEGEND.map((l) => (
          <Paragraph key={l.state} style={{ marginBottom: 6 }}>
            <Tag color={STATE_COLOR[l.state]}>{STATE_LABEL[l.state]}</Tag> {l.meaning}
          </Paragraph>
        ))}
        <Alert type="info" showIcon message={DISCLAIMER} style={{ marginTop: 8 }} />
      </Card>

      <Drawer open={!!historyFor} onClose={() => { setHistoryFor(null); setHistory(null); }} title={history ? `${history.name}: recent changes` : 'Recent changes'} width={380}>
        {history ? (
          history.transitions.length ? (
            <Timeline
              items={history.transitions.map((t) => ({
                color: STATE_COLOR[t.to] === 'default' ? 'gray' : STATE_COLOR[t.to],
                children: <span><Tag color={STATE_COLOR[t.to]}>{STATE_LABEL[t.to]}</Tag> {new Date(t.at).toLocaleString()}</span>,
              }))}
            />
          ) : <Empty description="No changes recorded" />
        ) : null}
        {history && <Text type="secondary">Kept for {history.retentionDays} days. State changes only; no page or app details are stored.</Text>}
      </Drawer>
    </div>
  );
}
