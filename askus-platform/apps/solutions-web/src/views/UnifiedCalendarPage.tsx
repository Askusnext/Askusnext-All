import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, Empty, Input, Modal, Popconfirm, Segmented, Select, Space, Spin, Table, Tabs, Tag, Tooltip, Typography, message } from 'antd';
import { ApiOutlined, LeftOutlined, PlusOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { useAppSelector } from '../store';
import { hasPermission, isAdminRole } from '../access';
import {
  calendarApi, TEAM_NAMES, teamLabel,
  type CalendarProvider, type DayCell, type Grid, type GridRow, type MeetingItem, type MyEvents, type NowState, type TeamsView,
} from '../api/calendar';
import CalendarPage from './CalendarPage';

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const IST = 'Asia/Kolkata';

// ── date helpers: every date here is an India (IST) calendar day, written YYYY-MM-DD ──
const todayIst = () => new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date());
const toUtc = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => fmt(new Date(toUtc(d).getTime() + n * 86_400_000));
const mondayOf = (d: string) => addDays(d, -((toUtc(d).getUTCDay() + 6) % 7));
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const monthEnd = (d: string) => fmt(new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)));
const timeOf = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const dayLabel = (d: string, long = false) => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: long ? 'long' : 'short', day: 'numeric', month: long ? 'long' : 'short' }).format(toUtc(d));
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const NOW_TAG: Record<NowState, { label: string; color: string }> = {
  in_meeting: { label: 'In a meeting', color: 'geekblue' },
  on_leave: { label: 'On leave', color: 'blue' },
  working: { label: 'Working', color: 'green' },
  idle: { label: 'Idle', color: 'orange' },
  offline: { label: 'Offline', color: 'default' },
};
const STATUS_CODE: Record<string, { code: string; color: string }> = {
  Present: { code: 'P', color: 'green' }, Absent: { code: 'A', color: 'red' }, HalfDay: { code: 'HD', color: 'orange' },
  OnLeave: { code: 'L', color: 'blue' }, Holiday: { code: 'H', color: 'purple' }, WeekOff: { code: 'WO', color: 'default' },
};

type Detail = { person: string; ownerId: string; date: string; cell: DayCell | undefined };

/** What one day holds, as small blocks. Approved leave is solid, pending leave is a lighter dashed block. */
function CellBlocks({ cell, compact }: { cell: DayCell | undefined; compact?: boolean }) {
  if (!cell) return null;
  const meetings = cell.meetings;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {cell.leave && (
        <div style={{
          fontSize: 11, padding: '1px 6px', borderRadius: 4,
          background: cell.leave.state === 'approved' ? '#1677ff' : '#e6f4ff', color: cell.leave.state === 'approved' ? '#fff' : '#1e40af',
          border: cell.leave.state === 'approved' ? '1px solid #1677ff' : '1px dashed #1677ff',
        }}>
          {compact ? 'Leave' : `${cell.leave.leaveType} leave${cell.leave.state === 'pending' ? ' (pending)' : ''}`}
        </div>
      )}
      {cell.status && !cell.leave && STATUS_CODE[cell.status.status] && (
        <Tag color={STATUS_CODE[cell.status.status].color} style={{ margin: 0, width: 'fit-content', fontSize: 11 }}>
          {STATUS_CODE[cell.status.status].code}
        </Tag>
      )}
      {meetings.slice(0, compact ? 1 : 3).map((m) => (
        <div key={m.id} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: m.private ? '#f0f0f0' : '#f0f5ff', borderLeft: `3px solid ${m.source === 'synced' ? '#2f54eb' : '#13c2c2'}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {compact ? `${meetings.length} mtg` : `${timeOf(m.start)} ${m.title}`}
        </div>
      ))}
      {!compact && meetings.length > 3 && <Typography.Text type="secondary" style={{ fontSize: 11 }}>+{meetings.length - 3} more</Typography.Text>}
    </div>
  );
}

// ───────────────────────────── connect calendar ─────────────────────────────

function ConnectCard({ data, reload }: { data: MyEvents; reload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const providers: { key: CalendarProvider; label: string }[] = [{ key: 'google', label: 'Google' }, { key: 'microsoft', label: 'Microsoft' }];

  const connect = async (p: CalendarProvider) => {
    setBusy(p);
    try { window.location.href = (await calendarApi.connect(p)).authUrl; } catch (e) { message.error(errText(e)); setBusy(null); }
  };
  const sync = async () => {
    setBusy('sync');
    try {
      const r = await calendarApi.sync();
      const failed = r.results.filter((x) => x.error);
      if (failed.length) message.warning(failed.map((f) => `${f.provider}: ${f.error}`).join(' · '));
      else message.success(`Synced ${r.results.reduce((n, x) => n + (x.imported ?? 0), 0)} meetings`);
      reload();
    } catch (e) { message.error(errText(e)); } finally { setBusy(null); }
  };
  const disconnect = async (id: string) => {
    try { await calendarApi.disconnect(id); message.success('Calendar disconnected and its synced meetings removed'); reload(); } catch (e) { message.error(errText(e)); }
  };

  return (
    <Card size="small" title="Connected calendars" extra={data.connections.length > 0 && <Button size="small" icon={<ReloadOutlined />} loading={busy === 'sync'} onClick={sync}>Sync now</Button>}>
      {data.connections.length === 0 && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Connect your work calendar once and your meetings show up here automatically (refreshed every 20 minutes). Only the meeting title, time and attendees are read — never your email or inbox. You can still add meetings by hand without connecting.
        </Typography.Paragraph>
      )}
      <Space direction="vertical" style={{ width: '100%' }}>
        {data.connections.map((c) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>
              <Tag color={c.status === 'active' ? 'green' : c.status === 'revoked' ? 'red' : 'orange'}>{c.status}</Tag>
              <strong style={{ textTransform: 'capitalize' }}>{c.provider}</strong> {c.accountEmail && <Typography.Text type="secondary">· {c.accountEmail}</Typography.Text>}
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{c.status === 'active' ? (c.lastSyncAt ? `Last synced ${new Date(c.lastSyncAt).toLocaleString('en-IN', { timeZone: IST })}` : 'Waiting for the first sync') : c.lastError}</Typography.Text>
            </span>
            <Space>
              {c.status !== 'active' && <Button size="small" type="primary" onClick={() => connect(c.provider)}>Reconnect</Button>}
              <Popconfirm title="Disconnect this calendar?" description="Meetings synced from it will be removed here (not from your calendar)." onConfirm={() => disconnect(c.id)}>
                <Button size="small" danger>Disconnect</Button>
              </Popconfirm>
            </Space>
          </div>
        ))}
        <Space wrap>
          {providers.filter((p) => !data.connections.some((c) => c.provider === p.key)).map((p) => (
            <Tooltip key={p.key} title={data.providers[p.key].configured ? '' : `${p.label} calendar is not set up on this server yet. Ask an admin to add the ${p.key.toUpperCase()}_CLIENT_ID and _CLIENT_SECRET settings.`}>
              <Button icon={<ApiOutlined />} loading={busy === p.key} disabled={!data.providers[p.key].configured} onClick={() => connect(p.key)}>
                Connect {p.label} calendar
              </Button>
            </Tooltip>
          ))}
        </Space>
      </Space>
    </Card>
  );
}

// ───────────────────────────── add meeting ─────────────────────────────

const ist = (local: string) => `${local}:00+05:30`; // <input type="datetime-local"> is read as India time

function AddMeetingModal({ open, date, staff, ownerId, onClose, onSaved }: {
  open: boolean; date: string; staff: { userId: string; name: string }[] | null; ownerId?: string; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(`${date}T10:00`);
  const [end, setEnd] = useState(`${date}T11:00`);
  const [priv, setPriv] = useState(false);
  const [who, setWho] = useState<string | undefined>(ownerId);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setStart(`${date}T10:00`); setEnd(`${date}T11:00`); setTitle(''); setPriv(false); setWho(ownerId); } }, [open, date, ownerId]);

  const save = async () => {
    if (!title.trim()) return message.warning('Give the meeting a title');
    if (end <= start) return message.warning('The end must be after the start');
    setSaving(true);
    try {
      await calendarApi.addMeeting({ title: title.trim(), startTime: ist(start), endTime: ist(end), employeeId: who, visibilityScope: priv ? 'private' : 'team' });
      message.success('Meeting added');
      onSaved();
      onClose();
    } catch (e) { message.error(errText(e)); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} title="Add a meeting" onCancel={onClose} onOk={save} okText="Add meeting" confirmLoading={saving} destroyOnClose>
      <Space direction="vertical" style={{ width: '100%' }}>
        {staff && (
          <Select style={{ width: '100%' }} value={who} onChange={setWho} placeholder="For" allowClear showSearch optionFilterProp="label"
            options={staff.map((s) => ({ value: s.userId, label: s.name }))} />
        )}
        <Input placeholder="Title" value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />
        <Space wrap>
          <span>Start <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: 210 }} /></span>
          <span>End <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} style={{ width: 210 }} /></span>
        </Space>
        <Checkbox checked={priv} onChange={(e) => setPriv(e.target.checked)}>Private — others see only "Busy"</Checkbox>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Times are India time (IST).</Typography.Text>
      </Space>
    </Modal>
  );
}

// ───────────────────────────── day detail ─────────────────────────────

function DayModal({ detail, onClose, onChanged, onAdd }: { detail: Detail | null; onClose: () => void; onChanged: () => void; onAdd: () => void }) {
  if (!detail) return null;
  const { cell } = detail;
  const remove = async (m: MeetingItem) => {
    try { await calendarApi.deleteMeeting(m.id); message.success('Meeting deleted'); onChanged(); onClose(); } catch (e) { message.error(errText(e)); }
  };
  return (
    <Modal open title={`${detail.person} · ${dayLabel(detail.date, true)}`} onCancel={onClose} footer={<Button icon={<PlusOutlined />} onClick={onAdd}>Add a meeting</Button>}>
      {!cell || (!cell.leave && !cell.status && cell.meetings.length === 0) ? <Empty description="Nothing on this day" /> : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {cell.leave && <Alert type={cell.leave.state === 'approved' ? 'info' : 'warning'} showIcon message={`${cell.leave.leaveType} leave — ${cell.leave.state}`} description={`${cell.leave.from} to ${cell.leave.to}`} />}
          {cell.status && <div>Attendance: <Tag color={STATUS_CODE[cell.status.status]?.color}>{cell.status.status}</Tag>{cell.status.late > 0 && <Tag color="orange">{cell.status.late} min late</Tag>}</div>}
          {cell.meetings.map((m) => (
            <Card key={m.id} size="small" title={<>{m.title} {m.private && <Tag>private</Tag>}</>} extra={<Tag color={m.source === 'synced' ? 'geekblue' : 'cyan'}>{m.source}</Tag>}>
              <div>{timeOf(m.start)} – {timeOf(m.end)} IST</div>
              {m.attendees.length > 0 && <div style={{ marginTop: 4 }}><Typography.Text type="secondary">With: </Typography.Text>{m.attendees.map((a) => a.name || a.email).join(', ')}</div>}
              {m.editable && <Popconfirm title="Delete this meeting?" onConfirm={() => remove(m)}><Button size="small" danger style={{ marginTop: 8 }}>Delete</Button></Popconfirm>}
            </Card>
          ))}
        </Space>
      )}
    </Modal>
  );
}

// ───────────────────────────── my calendar ─────────────────────────────

function MyCalendar({ staff, isAdmin }: { staff: { userId: string; name: string }[] | null; isAdmin: boolean }) {
  const me = useAppSelector((s) => s.auth.user);
  const [mode, setMode] = useState<'Week' | 'Month'>('Week');
  const [anchor, setAnchor] = useState(todayIst());
  const [data, setData] = useState<MyEvents | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const { from, to } = useMemo(() => {
    if (mode === 'Week') { const m = mondayOf(anchor); return { from: m, to: addDays(m, 6) }; }
    return { from: mondayOf(monthStart(anchor)), to: addDays(mondayOf(monthEnd(anchor)), 6) };
  }, [mode, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await calendarApi.myEvents(from, to)); } catch (e) { message.error(errText(e)); } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);

  // The provider sends the person back here with ?connected=google or ?calendar_error=…
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('connected')) message.success(`${q.get('connected')} calendar connected — your meetings are syncing`);
    if (q.get('calendar_error')) message.error(q.get('calendar_error') as string);
    if (q.get('connected') || q.get('calendar_error')) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const step = (n: number) => setAnchor(mode === 'Week' ? addDays(anchor, 7 * n) : addDays(monthStart(anchor), n > 0 ? 32 : -1));
  const today = todayIst();
  const label = mode === 'Week' ? `${dayLabel(from)} – ${dayLabel(to)}` : new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(toUtc(monthStart(anchor)));
  const weeks = data ? Array.from({ length: data.days.length / 7 }, (_, i) => data.days.slice(i * 7, i * 7 + 7)) : [];
  const myName = me?.name || 'Me';

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {data && <ConnectCard data={data} reload={load} />}
      <Card size="small">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <Space>
            <Button icon={<LeftOutlined />} onClick={() => step(-1)} />
            <Button onClick={() => setAnchor(today)}>Today</Button>
            <Button icon={<RightOutlined />} onClick={() => step(1)} />
            <Typography.Text strong>{label}</Typography.Text>
          </Space>
          <Space>
            <Segmented options={['Week', 'Month']} value={mode} onChange={(v) => setMode(v as 'Week' | 'Month')} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(today)}>Add meeting</Button>
          </Space>
        </div>
        <Spin spinning={loading}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 700 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                {WEEKDAYS.map((w) => <Typography.Text key={w} type="secondary" style={{ textAlign: 'center', fontSize: 12 }}>{w}</Typography.Text>)}
              </div>
              {weeks.map((wk) => (
                <div key={wk[0]} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                  {wk.map((d) => {
                    const faded = mode === 'Month' && d.slice(0, 7) !== anchor.slice(0, 7);
                    return (
                      <div key={d} onClick={() => setDetail({ person: myName, ownerId: me?.id ?? '', date: d, cell: data?.cells[d] })}
                        style={{ minHeight: mode === 'Week' ? 150 : 92, padding: 6, border: d === today ? '2px solid #1677ff' : '1px solid #f0f0f0', borderRadius: 6, cursor: 'pointer', opacity: faded ? 0.45 : 1 }}>
                        <Typography.Text strong={d === today} style={{ fontSize: 12 }}>{+d.slice(8)}</Typography.Text>
                        <CellBlocks cell={data?.cells[d]} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Spin>
        <Space size="large" style={{ marginTop: 8, fontSize: 12 }} wrap>
          <span><Badge color="#2f54eb" /> synced meeting</span>
          <span><Badge color="#13c2c2" /> manual meeting</span>
          <span><Badge color="#1677ff" /> approved leave</span>
          <span style={{ border: '1px dashed #1677ff', padding: '0 4px', borderRadius: 4, color: '#1e40af' }}>pending leave</span>
          <span>P present · A absent · HD half-day · L on leave · H holiday · WO week-off</span>
        </Space>
      </Card>
      <DayModal detail={detail} onClose={() => setDetail(null)} onChanged={load} onAdd={() => { if (detail) setAdding(detail.date); setDetail(null); }} />
      <AddMeetingModal open={adding !== null} date={adding ?? today} staff={isAdmin ? staff : null} ownerId={undefined} onClose={() => setAdding(null)} onSaved={load} />
    </Space>
  );
}

// ───────────────────────────── team / org grid ─────────────────────────────

function GridView({ kind, staff }: { kind: 'team' | 'org'; staff: { userId: string; name: string }[] | null }) {
  const [team, setTeam] = useState<string | undefined>();
  const [anchor, setAnchor] = useState(mondayOf(todayIst()));
  const [grid, setGrid] = useState<Grid | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [adding, setAdding] = useState<{ date: string; ownerId: string } | null>(null);
  const [teamOptions, setTeamOptions] = useState<string[]>([]);

  const from = anchor;
  const to = addDays(anchor, 6);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const g = kind === 'org' ? await calendarApi.orgView(from, to, team) : await calendarApi.teamView(from, to, team);
      setGrid(g);
    } catch (e) { message.error(errText(e)); } finally { setLoading(false); }
  }, [kind, from, to, team]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (kind === 'org') setTeamOptions([...TEAM_NAMES]);
    else void calendarApi.teams().then((t) => setTeamOptions(t.teams.map((x) => x.team))).catch(() => undefined);
  }, [kind]);

  const today = todayIst();
  const columns = [
    {
      title: kind === 'org' ? 'Person' : 'Team member', dataIndex: 'employeeName', fixed: 'left' as const, width: 190,
      render: (_: unknown, r: GridRow) => (
        <div>
          <strong>{r.employeeName}</strong>
          <div style={{ fontSize: 11 }}><Typography.Text type="secondary">{r.role}{r.teams.length ? ` · ${r.teams.map(teamLabel).join(', ')}` : ''}</Typography.Text></div>
        </div>
      ),
    },
    { title: 'Right now', width: 120, render: (_: unknown, r: GridRow) => <Tag color={NOW_TAG[r.now].color}>{NOW_TAG[r.now].label}</Tag> },
    ...(grid?.days ?? []).map((d) => ({
      title: <span style={{ color: d === today ? '#1e40af' : undefined }}>{dayLabel(d)}</span>, key: d, width: 120,
      onCell: (r: GridRow) => ({ onClick: () => setDetail({ person: r.employeeName, ownerId: r.userId, date: d, cell: r.cells[d] }), style: { cursor: 'pointer', verticalAlign: 'top' as const } }),
      render: (_: unknown, r: GridRow) => <CellBlocks cell={r.cells[d]} compact />,
    })),
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card size="small">
        <Space wrap>
          <Button icon={<LeftOutlined />} onClick={() => setAnchor(addDays(anchor, -7))} />
          <Button onClick={() => setAnchor(mondayOf(today))}>This week</Button>
          <Button icon={<RightOutlined />} onClick={() => setAnchor(addDays(anchor, 7))} />
          <Typography.Text strong>{dayLabel(from)} – {dayLabel(to)}</Typography.Text>
          <Select allowClear placeholder={kind === 'org' ? 'All teams / ventures' : 'All my teams'} style={{ minWidth: 200 }} value={team} onChange={setTeam}
            options={teamOptions.map((t) => ({ value: t, label: teamLabel(t) }))} />
          <Button icon={<ReloadOutlined />} onClick={load} />
        </Space>
        {kind === 'team' && grid && grid.rows.length <= 1 && (
          <Alert style={{ marginTop: 12 }} type="info" showIcon message="You are not in a team with other people yet." description="A Super Admin assigns people to teams under the Teams tab." />
        )}
      </Card>
      <Card size="small" bodyStyle={{ padding: 0 }}>
        <Table<GridRow> rowKey="userId" loading={loading} size="small" pagination={false} columns={columns} dataSource={grid?.rows ?? []} scroll={{ x: 'max-content' }} />
      </Card>
      <DayModal detail={detail} onClose={() => setDetail(null)} onChanged={load} onAdd={() => { if (detail) setAdding({ date: detail.date, ownerId: detail.ownerId }); setDetail(null); }} />
      <AddMeetingModal open={adding !== null} date={adding?.date ?? today} ownerId={adding?.ownerId} staff={staff} onClose={() => setAdding(null)} onSaved={load} />
    </Space>
  );
}

// ───────────────────────────── teams ─────────────────────────────

function TeamsTab({ isSuper }: { isSuper: boolean }) {
  const [data, setData] = useState<TeamsView | null>(null);
  const [adding, setAdding] = useState<Record<string, string | undefined>>({});
  const load = useCallback(async () => { try { setData(await calendarApi.teams()); } catch (e) { message.error(errText(e)); } }, []);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (team: string, userId: string, member: boolean) => {
    try { setData(await calendarApi.setMember(team, userId, member)); } catch (e) { message.error(errText(e)); }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Alert type="info" showIcon message={isSuper ? 'Choose who belongs to each venture/team. Admins see the calendars of the teams they belong to.' : 'You can manage the teams you belong to. A Super Admin adds you to a team first.'} />
      {(data?.teams ?? []).map((t) => (
        <Card key={t.team} size="small" title={teamLabel(t.team)}>
          <Space wrap style={{ marginBottom: 8 }}>
            {t.members.length === 0 && <Typography.Text type="secondary">No members yet</Typography.Text>}
            {t.members.map((m) => (
              <Tag key={m.userId} closable onClose={(e) => { e.preventDefault(); void toggle(t.team, m.userId, false); }}>{m.name} · {m.role}</Tag>
            ))}
          </Space>
          <Space>
            <Select showSearch optionFilterProp="label" style={{ minWidth: 240 }} placeholder="Add a person" value={adding[t.team]} onChange={(v) => setAdding({ ...adding, [t.team]: v })}
              options={(data?.staff ?? []).filter((s) => !t.members.some((m) => m.userId === s.userId)).map((s) => ({ value: s.userId, label: `${s.name} (${s.role})` }))} />
            <Button disabled={!adding[t.team]} onClick={() => { void toggle(t.team, adding[t.team] as string, true); setAdding({ ...adding, [t.team]: undefined }); }}>Add</Button>
          </Space>
        </Card>
      ))}
      {data && data.teams.length === 0 && <Empty description="You are not in any team yet" />}
    </Space>
  );
}

// ───────────────────────────── page ─────────────────────────────

export default function UnifiedCalendarPage() {
  const me = useAppSelector((s) => s.auth.user);
  const isAdmin = isAdminRole(me?.role);
  const isSuper = me?.role === 'SuperAdmin';
  const [staff, setStaff] = useState<{ userId: string; name: string }[] | null>(null);
  useEffect(() => { if (isAdmin) void calendarApi.teams().then((t) => setStaff(t.staff)).catch(() => undefined); }, [isAdmin]);

  const items = [
    { key: 'mine', label: 'My calendar', children: <MyCalendar staff={staff} isAdmin={isAdmin} /> },
    ...(isAdmin ? [{ key: 'team', label: 'Team view', children: <GridView kind="team" staff={staff} /> }] : []),
    ...(isSuper ? [{ key: 'org', label: 'Organisation view', children: <GridView kind="org" staff={staff} /> }] : []),
    ...(isAdmin ? [{ key: 'teams', label: 'Teams', children: <TeamsTab isSuper={isSuper} /> }] : []),
    ...(hasPermission(me, 'tickets') ? [{ key: 'expiry', label: 'Insurance expiry', children: <CalendarPage /> }] : []),
  ];

  return (
    <div style={{ padding: 16 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>Calendar</Typography.Title>
      <Tabs items={items} destroyInactiveTabPane />
    </div>
  );
}
