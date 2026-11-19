import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Descriptions, Drawer, Empty, Space, Table, Tag, Timeline, Typography } from 'antd';
import { ReloadOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { attendanceApi, mapLink, minutesLabel, type LiveRow, type LiveStatus, type Trail } from '../api/attendance';

const { Text, Title } = Typography;

const STATUS: Record<LiveStatus, { label: string; color: string }> = {
  working: { label: 'Working', color: 'green' },
  idle: { label: 'Idle', color: 'orange' },
  signal_lost: { label: 'Signal lost', color: 'red' },
  ended: { label: 'Finished', color: 'blue' },
  not_started: { label: 'Not started', color: 'default' },
};

/** Today's date in India time (the server groups sessions by India date). */
const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const clock = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '—');
const ago = (iso?: string | null) => {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

function MapFrame({ lat, lng }: { lat: number; lng: number }) {
  const d = 0.006;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div>
      <iframe title="Last known location" src={src} style={{ width: '100%', height: 260, border: '1px solid #e8e8e8', borderRadius: 8 }} loading="lazy" />
      <a href={mapLink(lat, lng)} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Open larger map</a>
    </div>
  );
}

export default function LiveTrackingPanel() {
  const [day, setDay] = useState<Dayjs>(dayjs(istToday()));
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<LiveRow | null>(null);
  const [trail, setTrail] = useState<Trail | null>(null);

  const date = day.format('YYYY-MM-DD');
  const isToday = date === istToday();

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await attendanceApi.live(date)); setError(''); } catch (e) { setError(errText(e)); } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { void load(); }, [load]);
  // keep today's view fresh
  useEffect(() => {
    if (!isToday) return;
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, [isToday, load]);

  // the detail drawer follows the same refresh
  useEffect(() => {
    if (!open) { setTrail(null); return; }
    let active = true;
    attendanceApi.trail(open.userId, date).then((t) => active && setTrail(t)).catch(() => active && setTrail(null));
    return () => { active = false; };
  }, [open?.userId, date, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = (s: LiveStatus) => rows.filter((r) => r.status === s).length;
  const stats = useMemo(() => [
    { label: 'Working', value: count('working'), color: '#166534' },
    { label: 'Idle', value: count('idle'), color: '#9a3412' },
    { label: 'Signal lost', value: count('signal_lost'), color: '#b91c1c' },
    { label: 'Finished', value: count('ended'), color: '#1e40af' },
    { label: 'Not started', value: count('not_started'), color: '#475569' },
  ], [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: ColumnsType<LiveRow> = [
    {
      title: 'Staff',
      render: (_, r) => (<div><div style={{ fontWeight: 600 }}>{r.employeeName}</div><Text type="secondary" style={{ fontSize: 12 }}>{r.employeeId} · {r.role}</Text></div>),
    },
    {
      title: 'Status',
      render: (_, r) => (<Space direction="vertical" size={0}><Tag color={STATUS[r.status].color} style={{ marginRight: 0 }}>{STATUS[r.status].label}</Tag>{!r.consented && <Text type="secondary" style={{ fontSize: 11 }}>Notice not accepted</Text>}</Space>),
    },
    { title: 'First start', dataIndex: 'firstStartedAt', render: clock },
    { title: 'Hours', dataIndex: 'minutes', render: (m: number) => (m ? minutesLabel(m) : '—') },
    { title: 'Last seen', dataIndex: 'lastSeen', render: ago },
    {
      title: 'Location',
      render: (_, r) => r.lastLocation
        ? <a href={mapLink(r.lastLocation.lat, r.lastLocation.lng)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><EnvironmentOutlined /> {r.lastLocation.lat.toFixed(4)}, {r.lastLocation.lng.toFixed(4)}</a>
        : <Text type="secondary">—</Text>,
    },
  ];

  const trailWithGps = trail?.pings.filter((p) => p.lat != null && p.lng != null) ?? [];

  return (
    <div style={{ padding: '4px 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <DatePicker value={day} onChange={(d) => d && setDay(d)} allowClear={false} disabledDate={(d) => d.isAfter(dayjs(istToday()), 'day')} />
        {!isToday && <Button size="small" onClick={() => setDay(dayjs(istToday()))}>Today</Button>}
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Refresh</Button>
        <Text type="secondary" style={{ fontSize: 12 }}>{isToday ? 'Updates every 30 seconds. ' : ''}Location is shown only while someone has a work session running.</Text>
      </div>
      {error && <Alert type="error" showIcon style={{ marginBottom: 12 }} message="Could not load tracking" description={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
        {stats.map((s) => (
          <Card key={s.label} size="small" styles={{ body: { padding: '8px 12px' } }}>
            <Text type="secondary" style={{ fontSize: 11 }}>{s.label}</Text>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Table<LiveRow>
        rowKey="userId" size="small" loading={loading && rows.length === 0} columns={columns} dataSource={rows} pagination={false}
        onRow={(r) => ({ onClick: () => setOpen(r), style: { cursor: 'pointer' } })}
        locale={{ emptyText: <Empty description="No staff yet. Add staff in User Management." /> }}
        scroll={{ x: 760 }}
      />

      <Drawer open={Boolean(open)} width={600} onClose={() => setOpen(null)} title={open ? `${open.employeeName} · ${dayjs(date).format('DD MMM YYYY')}` : ''}>
        {open && (
          <>
            <Descriptions size="small" column={2} bordered style={{ marginBottom: 14 }}>
              <Descriptions.Item label="Status"><Tag color={STATUS[open.status].color}>{STATUS[open.status].label}</Tag></Descriptions.Item>
              <Descriptions.Item label="Hours today">{trail ? minutesLabel(trail.totalMinutes) : '…'}</Descriptions.Item>
              <Descriptions.Item label="Last seen">{ago(open.lastSeen)}</Descriptions.Item>
              <Descriptions.Item label="Sessions">{trail?.sessions.length ?? open.sessions}</Descriptions.Item>
            </Descriptions>

            {open.lastLocation
              ? (<><Title level={5}>Last known location</Title><MapFrame lat={open.lastLocation.lat} lng={open.lastLocation.lng} /></>)
              : <Alert type="info" showIcon message="No location yet for this day" description="Location appears once the person starts a work session." />}

            <Title level={5} style={{ marginTop: 16 }}>Sessions</Title>
            {!trail || trail.sessions.length === 0 ? <Text type="secondary">No sessions.</Text> : (
              <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                {trail.sessions.map((s) => (
                  <Card key={s.id} size="small">
                    <Space wrap>
                      <b>{clock(s.startedAt)} → {s.endedAt ? clock(s.endedAt) : s.live ? 'now' : '…'}</b>
                      <Tag>{minutesLabel(s.minutes)}</Tag>
                      {s.live && <Tag color="green">Running</Tag>}
                      {s.endReason === 'auto' && <Tag color="orange">Closed: signal lost</Tag>}
                    </Space>
                  </Card>
                ))}
              </div>
            )}

            <Title level={5}>Location trail <Text type="secondary" style={{ fontSize: 12 }}>({trailWithGps.length} samples)</Text></Title>
            {trailWithGps.length === 0 ? <Text type="secondary">No location samples.</Text> : (
              <Timeline
                items={trailWithGps.slice(-60).map((p) => ({
                  color: p.state === 'idle' ? 'orange' : 'green',
                  children: (
                    <span style={{ fontSize: 12 }}>
                      <b>{clock(p.at)}</b> · {p.state === 'idle' ? 'idle' : 'active'} ·{' '}
                      <a href={mapLink(p.lat as number, p.lng as number)} target="_blank" rel="noreferrer">{(p.lat as number).toFixed(5)}, {(p.lng as number).toFixed(5)}</a>
                      {p.accuracy != null && <Text type="secondary"> (±{Math.round(p.accuracy)} m)</Text>}
                    </span>
                  ),
                }))}
              />
            )}
            {trailWithGps.length > 60 && <Text type="secondary" style={{ fontSize: 12 }}>Showing the latest 60 of {trailWithGps.length} samples.</Text>}
          </>
        )}
      </Drawer>
    </div>
  );
}
