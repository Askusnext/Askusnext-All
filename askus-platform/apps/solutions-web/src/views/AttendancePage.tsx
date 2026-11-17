import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Select, Space, Statistic, Table, Tabs, Tag, TimePicker, Tooltip, Typography, message,
} from 'antd';
import { DownloadOutlined, LoginOutlined, LogoutOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useAppSelector } from '../store';
import { isAdminRole } from '../access';
import {
  STATUS_LABEL, WEEKDAYS, downloadRegister, duration, hm, leaveApi,
  type AttendanceConfig, type AttendanceRecord, type AttendanceStatus, type BalanceSummary, type Holiday, type LateReport, type LeaveBalance, type LeaveRequest,
  type LeaveStatus, type LeaveType, type MissedCheckout, type Register, type RegisterRow, type Summary, type TodayStatus,
} from '../api/leave';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const monthKey = (d: Dayjs) => d.format('YYYY-MM');
const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function StatusTag({ status }: { status: AttendanceStatus | null }) {
  if (!status) return <Tag>Not marked</Tag>;
  const s = STATUS_LABEL[status];
  return <Tag color={s.color} style={{ marginRight: 0 }}>{s.label}</Tag>;
}

const LEAVE_COLOR: Record<LeaveStatus, string> = { pending: 'gold', approved: 'green', rejected: 'red', cancelled: 'default' };

// ───────────────────────── My day ─────────────────────────

function MyDay() {
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const from = month.startOf('month').format('YYYY-MM-DD');
      const to = month.endOf('month').format('YYYY-MM-DD');
      const [t, r] = await Promise.all([leaveApi.today(), leaveApi.myRecord(from, to)]);
      setToday(t);
      setRecords(r.records);
      setSummary(r.summary);
    } catch (e) {
      message.error(errText(e));
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);
  // The status stays live: refreshed every 30 seconds while the page is open.
  useEffect(() => {
    const id = setInterval(() => { leaveApi.today().then(setToday).catch(() => undefined); }, 30_000);
    return () => clearInterval(id);
  }, []);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await fn(); message.success(done); await load(); } catch (e) { message.error(errText(e)); } finally { setBusy(false); }
  };

  const columns: ColumnsType<AttendanceRecord> = [
    { title: 'Date', dataIndex: 'date', render: (d: string) => dayjs(d).format('ddd, DD MMM') },
    { title: 'Status', dataIndex: 'status', render: (s: AttendanceStatus) => <StatusTag status={s} /> },
    { title: 'Check-in', dataIndex: 'checkInTime', render: hm },
    { title: 'Check-out', dataIndex: 'checkOutTime', render: hm },
    {
      title: 'Flags',
      render: (_: unknown, r) => (
        <Space size={4}>
          {r.lateByMinutes > 0 && <Tag color="volcano">Late {r.lateByMinutes}m</Tag>}
          {r.missedCheckout && <Tag color="magenta">Missed check-out</Tag>}
          {r.source === 'admin' && <Tooltip title={r.note ?? 'Corrected by an admin'}><Tag>Corrected</Tag></Tooltip>}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space size={32} wrap align="center">
          <div>
            <Text type="secondary">Today · {today ? dayjs(today.date).format('dddd, DD MMM YYYY') : ''}</Text>
            <div style={{ marginTop: 4 }}><StatusTag status={today?.status ?? null} /></div>
          </div>
          <Statistic title="Checked in" value={hm(today?.checkInTime ?? null)} valueStyle={{ fontSize: 20 }} />
          <Statistic title="Checked out" value={hm(today?.checkOutTime ?? null)} valueStyle={{ fontSize: 20 }} />
          <Statistic title="Time at work" value={today ? duration(today.workedMinutes) : '-'} valueStyle={{ fontSize: 20 }} />
          {today && today.lateByMinutes > 0 && <Tag color="volcano">Late by {today.lateByMinutes} min</Tag>}
          <Space>
            <Button type="primary" icon={<LoginOutlined />} disabled={!today?.canCheckIn} loading={busy} onClick={() => act(leaveApi.checkIn, 'Checked in')}>Check in</Button>
            <Button icon={<LogoutOutlined />} disabled={!today?.canCheckOut} loading={busy} onClick={() => act(leaveApi.checkOut, 'Checked out')}>Check out</Button>
          </Space>
        </Space>
        {today && <div style={{ marginTop: 8 }}><Text type="secondary">Shift starts {today.shiftStart}; you are marked late after {today.graceMinutes} minutes.</Text></div>}
      </Card>

      <Card
        title="My record"
        extra={<Space><DatePicker picker="month" allowClear={false} value={month} onChange={(d) => d && setMonth(d)} /><Button icon={<ReloadOutlined />} onClick={load} /></Space>}
      >
        {summary && (
          <Space size={24} wrap style={{ marginBottom: 12 }}>
            <Statistic title="Present" value={summary.present} />
            <Statistic title="Half-day" value={summary.halfDay} />
            <Statistic title="Absent" value={summary.absent} />
            <Statistic title="On leave" value={summary.onLeave} />
            <Statistic title="Late arrivals" value={summary.lateCount} />
          </Space>
        )}
        <Table rowKey="id" size="small" columns={columns} dataSource={records} pagination={{ pageSize: 31, hideOnSinglePage: true }} />
      </Card>
    </Space>
  );
}

// ───────────────────────── Leave ─────────────────────────

function LeavePanel() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [mine, setMine] = useState<LeaveRequest[]>([]);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ leaveTypeId: string; range: [Dayjs, Dayjs]; reason: string }>();

  const load = useCallback(async () => {
    try {
      const [t, b, m] = await Promise.all([leaveApi.types(), leaveApi.balance(), leaveApi.my()]);
      setTypes(t); setBalances(b); setMine(m);
    } catch (e) { message.error(errText(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const submit = async (v: { leaveTypeId: string; range: [Dayjs, Dayjs]; reason: string }) => {
    setSaving(true);
    try {
      await leaveApi.request({ leaveTypeId: v.leaveTypeId, fromDate: v.range[0].format('YYYY-MM-DD'), toDate: v.range[1].format('YYYY-MM-DD'), reason: v.reason });
      message.success('Leave request sent for approval');
      form.resetFields();
      await load();
    } catch (e) { message.error(errText(e)); } finally { setSaving(false); }
  };

  const cancel = async (id: string) => {
    try { await leaveApi.cancel(id); message.success('Request cancelled'); await load(); } catch (e) { message.error(errText(e)); }
  };

  const columns: ColumnsType<LeaveRequest> = [
    { title: 'Type', dataIndex: 'leaveType' },
    { title: 'From', dataIndex: 'fromDate', render: (d: string) => dayjs(d).format('DD MMM YYYY') },
    { title: 'To', dataIndex: 'toDate', render: (d: string) => dayjs(d).format('DD MMM YYYY') },
    { title: 'Working days', dataIndex: 'days', align: 'right' },
    { title: 'Reason', dataIndex: 'reason', ellipsis: true },
    { title: 'Status', dataIndex: 'status', render: (s: LeaveStatus) => <Tag color={LEAVE_COLOR[s]}>{s}</Tag> },
    {
      title: 'Decision',
      render: (_: unknown, r) => (r.approvedBy ? <span>{r.approvedBy}{r.decisionNote ? ` — ${r.decisionNote}` : ''}</span> : '-'),
    },
    { title: '', render: (_: unknown, r) => (r.status === 'pending' ? <Popconfirm title="Cancel this request?" onConfirm={() => cancel(r.id)}><Button size="small">Cancel</Button></Popconfirm> : null) },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space size={16} wrap>
        {balances.map((b) => (
          <Card key={b.leaveTypeId} size="small" style={{ minWidth: 170 }}>
            <Statistic
              title={`${b.leaveType} leave`}
              value={b.isPaid ? b.remaining ?? 0 : b.used}
              suffix={b.isPaid ? `/ ${b.totalAllotted}` : 'taken'}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {b.isPaid ? `${b.used} used${b.pending ? `, ${b.pending} awaiting approval` : ''}` : 'No yearly limit'}
            </Text>
          </Card>
        ))}
      </Space>

      <Card title="Apply for leave">
        <Form form={form} layout="vertical" onFinish={submit} style={{ maxWidth: 560 }}>
          <Form.Item name="leaveTypeId" label="Leave type" rules={[{ required: true, message: 'Choose a leave type' }]}>
            <Select options={types.map((t) => ({ value: t.id, label: t.name }))} placeholder="Casual, Sick, Earned…" />
          </Form.Item>
          <Form.Item name="range" label="Dates" rules={[{ required: true, message: 'Choose the dates' }]} extra="Holidays and week-offs inside the range are not counted.">
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, min: 3, message: 'Please give a reason' }]}>
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>Send for approval</Button>
        </Form>
      </Card>

      <Card title="My requests">
        <Table rowKey="id" size="small" columns={columns} dataSource={mine} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 800 }} />
      </Card>
    </Space>
  );
}

// ───────────────────────── Approvals (admin) ─────────────────────────

function Approvals() {
  const [status, setStatus] = useState<LeaveStatus | 'all'>('pending');
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [deciding, setDeciding] = useState<{ req: LeaveRequest; decision: 'approved' | 'rejected' } | null>(null);
  const [note, setNote] = useState('');
  const [summary, setSummary] = useState<BalanceSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([leaveApi.requests(status === 'all' ? undefined : status), leaveApi.balanceSummary()]);
      setRows(list); setSummary(sum);
    } catch (e) { message.error(errText(e)); } finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  const confirm = async () => {
    if (!deciding) return;
    try {
      await leaveApi.decide({ id: deciding.req.id, decision: deciding.decision, note: note.trim() || undefined });
      message.success(`Request ${deciding.decision}`);
      setDeciding(null); setNote('');
      await load();
    } catch (e) { message.error(errText(e)); }
  };

  const columns: ColumnsType<LeaveRequest> = [
    { title: 'Employee', dataIndex: 'employeeName' },
    { title: 'Type', dataIndex: 'leaveType' },
    { title: 'Dates', render: (_: unknown, r) => `${dayjs(r.fromDate).format('DD MMM')} – ${dayjs(r.toDate).format('DD MMM YYYY')}` },
    { title: 'Days', dataIndex: 'days', align: 'right' },
    { title: 'Reason', dataIndex: 'reason', ellipsis: true },
    { title: 'Status', dataIndex: 'status', render: (s: LeaveStatus) => <Tag color={LEAVE_COLOR[s]}>{s}</Tag> },
    {
      title: '',
      render: (_: unknown, r) => r.status === 'pending' && (
        <Space>
          <Button size="small" type="primary" onClick={() => setDeciding({ req: r, decision: 'approved' })}>Approve</Button>
          <Button size="small" danger onClick={() => setDeciding({ req: r, decision: 'rejected' })}>Reject</Button>
        </Space>
      ),
    },
  ];

  const balanceColumns: ColumnsType<BalanceSummary['rows'][number]> = summary
    ? [
        { title: 'Employee', dataIndex: 'employeeName' },
        ...summary.types.map((t) => ({
          title: t,
          render: (_: unknown, r: BalanceSummary['rows'][number]) => {
            const b = r.balances.find((x) => x.leaveType === t);
            if (!b) return '-';
            return b.isPaid ? `${b.used} used · ${b.remaining} left` : `${b.used} taken`;
          },
        })),
      ]
    : [];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title="Leave requests"
        extra={<Segmented value={status} onChange={(v) => setStatus(v as LeaveStatus | 'all')} options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: 'all', label: 'All' }]} />}
      >
        <Table rowKey="id" size="small" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 800 }} />
      </Card>
      <Card title={`Leave balance summary ${summary?.year ?? ''}`}>
        <Table rowKey="userId" size="small" columns={balanceColumns} dataSource={summary?.rows ?? []} pagination={{ pageSize: 15, hideOnSinglePage: true }} scroll={{ x: 700 }} />
      </Card>
      <Modal
        open={!!deciding}
        title={deciding ? `${deciding.decision === 'approved' ? 'Approve' : 'Reject'} ${deciding.req.employeeName}'s leave?` : ''}
        okText={deciding?.decision === 'approved' ? 'Approve' : 'Reject'}
        okButtonProps={{ danger: deciding?.decision === 'rejected' }}
        onOk={confirm}
        onCancel={() => { setDeciding(null); setNote(''); }}
      >
        {deciding && <p>{deciding.req.leaveType} · {deciding.req.days} working day(s) · {dayjs(deciding.req.fromDate).format('DD MMM')} to {dayjs(deciding.req.toDate).format('DD MMM YYYY')}</p>}
        <Input.TextArea rows={3} placeholder="Note for the employee (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Modal>
    </Space>
  );
}

// ───────────────────────── Register (admin) ─────────────────────────

interface ManualTarget { userId: string; name: string; date: string; status?: AttendanceStatus; checkIn?: string | null; checkOut?: string | null }

function ManualModal({ target, onClose, onSaved }: { target: ManualTarget | null; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm<{ status: AttendanceStatus; checkIn?: Dayjs; checkOut?: Dayjs; note?: string }>();
  const [saving, setSaving] = useState(false);
  const status = Form.useWatch('status', form);

  useEffect(() => {
    if (!target) return;
    const time = (iso?: string | null) => (iso ? dayjs(iso) : undefined);
    form.setFieldsValue({ status: target.status ?? 'Present', checkIn: time(target.checkIn), checkOut: time(target.checkOut), note: undefined });
  }, [target, form]);

  const save = async (v: { status: AttendanceStatus; checkIn?: Dayjs; checkOut?: Dayjs; note?: string }) => {
    if (!target) return;
    setSaving(true);
    try {
      await leaveApi.manual({ userId: target.userId, date: target.date, status: v.status, checkIn: v.checkIn?.format('HH:mm'), checkOut: v.checkOut?.format('HH:mm'), note: v.note?.trim() || undefined });
      message.success('Attendance updated and logged');
      onSaved();
    } catch (e) { message.error(errText(e)); } finally { setSaving(false); }
  };

  const working = status === 'Present' || status === 'HalfDay';
  return (
    <Modal open={!!target} title={target ? `${target.name} · ${dayjs(target.date).format('ddd, DD MMM YYYY')}` : ''} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} okText="Save correction" destroyOnClose>
      <Form form={form} layout="vertical" onFinish={save}>
        <Form.Item name="status" label="Status" rules={[{ required: true }]}>
          <Select options={(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s].label }))} />
        </Form.Item>
        {working && (
          <Space>
            <Form.Item name="checkIn" label="Check-in (IST)"><TimePicker format="HH:mm" minuteStep={5} /></Form.Item>
            <Form.Item name="checkOut" label="Check-out (IST)"><TimePicker format="HH:mm" minuteStep={5} /></Form.Item>
          </Space>
        )}
        <Form.Item name="note" label="Reason for the correction"><Input.TextArea rows={2} maxLength={500} /></Form.Item>
        <Text type="secondary">Every correction is recorded in the activity log with your name and the previous value.</Text>
      </Form>
    </Modal>
  );
}

const CELL_STYLE: Record<AttendanceStatus, { bg: string; fg: string }> = {
  Present: { bg: '#e6f7e6', fg: '#237804' },
  HalfDay: { bg: '#fff1d6', fg: '#ad6800' },
  Absent: { bg: '#ffe1e1', fg: '#a8071a' },
  OnLeave: { bg: '#e0efff', fg: '#0958d9' },
  Holiday: { bg: '#f1e6ff', fg: '#531dab' },
  WeekOff: { bg: '#f0f0f0', fg: '#8c8c8c' },
};

function RegisterPanel() {
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [reg, setReg] = useState<Register | null>(null);
  const [late, setLate] = useState<LateReport | null>(null);
  const [missed, setMissed] = useState<MissedCheckout[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [target, setTarget] = useState<ManualTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = monthKey(month);
      const [r, l, x] = await Promise.all([leaveApi.register(m), leaveApi.lateReport(m), leaveApi.missedCheckouts()]);
      setReg(r); setLate(l); setMissed(x);
    } catch (e) { message.error(errText(e)); } finally { setLoading(false); }
  }, [month]);
  useEffect(() => { void load(); }, [load]);

  const doExport = async (format: 'xlsx' | 'pdf') => {
    setExporting(format);
    try { await downloadRegister(monthKey(month), format); } catch (e) { message.error(errText(e)); } finally { setExporting(null); }
  };

  const today = todayIst();
  const columns: ColumnsType<RegisterRow> = useMemo(() => {
    if (!reg) return [];
    return [
      { title: 'Employee', dataIndex: 'employeeName', fixed: 'left', width: 170, render: (n: string, r) => <div><div>{n}</div><Text type="secondary" style={{ fontSize: 11 }}>{r.role}</Text></div> },
      ...reg.days.map((d, i) => ({
        title: <div style={{ textAlign: 'center', lineHeight: 1.1 }}><div>{Number(d.slice(8))}</div><div style={{ fontSize: 10, color: '#999' }}>{WEEKDAYS[dayjs(d).day()][0]}</div></div>,
        key: d, width: 38, align: 'center' as const,
        render: (_: unknown, row: RegisterRow) => {
          const c = row.cells[i];
          const style = c.s ? CELL_STYLE[c.s] : { bg: 'transparent', fg: '#bbb' };
          const editable = d <= today;
          const tip = [c.s ? STATUS_LABEL[c.s].label : 'Not marked', c.late > 0 ? `late ${c.late} min` : '', c.miss ? 'missed check-out' : '', reg.holidays[d] ?? '', editable ? 'click to correct' : ''].filter(Boolean).join(' · ');
          return (
            <Tooltip title={tip}>
              <span
                onClick={() => editable && setTarget({ userId: row.userId, name: row.employeeName, date: d, status: c.s ?? undefined })}
                style={{ display: 'inline-block', minWidth: 28, padding: '1px 0', borderRadius: 4, fontSize: 11, fontWeight: 600, background: style.bg, color: style.fg, cursor: editable ? 'pointer' : 'default' }}
              >
                {c.s ? STATUS_LABEL[c.s].code : '·'}{c.late > 0 ? '*' : ''}{c.miss ? '!' : ''}
              </span>
            </Tooltip>
          );
        },
      })),
      { title: 'P', width: 40, align: 'center', render: (_: unknown, r) => r.summary.present },
      { title: 'HD', width: 40, align: 'center', render: (_: unknown, r) => r.summary.halfDay },
      { title: 'A', width: 40, align: 'center', render: (_: unknown, r) => r.summary.absent },
      { title: 'L', width: 40, align: 'center', render: (_: unknown, r) => r.summary.onLeave },
      { title: 'Late', width: 48, align: 'center', render: (_: unknown, r) => r.summary.lateCount },
    ];
  }, [reg, today]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title="Monthly attendance register"
        extra={
          <Space wrap>
            <DatePicker picker="month" allowClear={false} value={month} onChange={(d) => d && setMonth(d)} />
            <Button icon={<DownloadOutlined />} loading={exporting === 'xlsx'} onClick={() => doExport('xlsx')}>Excel</Button>
            <Button icon={<DownloadOutlined />} loading={exporting === 'pdf'} onClick={() => doExport('pdf')}>PDF</Button>
            <Button icon={<ReloadOutlined />} onClick={load} />
          </Space>
        }
      >
        <Space size={[12, 4]} wrap style={{ marginBottom: 12 }}>
          {(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((s) => (
            <span key={s} style={{ fontSize: 12 }}><span style={{ display: 'inline-block', padding: '0 6px', borderRadius: 4, fontWeight: 600, background: CELL_STYLE[s].bg, color: CELL_STYLE[s].fg }}>{STATUS_LABEL[s].code}</span> {STATUS_LABEL[s].label}</span>
          ))}
          <span style={{ fontSize: 12 }}>* late · ! missed check-out · click a day to correct it</span>
        </Space>
        <Table rowKey="userId" size="small" loading={loading} columns={columns} dataSource={reg?.rows ?? []} pagination={false} scroll={{ x: 170 + (reg?.days.length ?? 30) * 38 + 220 }} bordered />
      </Card>

      {missed.length > 0 && (
        <Card title={`Missed check-outs to review (${missed.length})`}>
          <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="These people checked in but never checked out. Set the real check-out time to clear the flag." />
          <Table
            rowKey="id" size="small" pagination={{ pageSize: 8, hideOnSinglePage: true }} dataSource={missed}
            columns={[
              { title: 'Employee', dataIndex: 'employeeName' },
              { title: 'Date', dataIndex: 'date', render: (d: string) => dayjs(d).format('ddd, DD MMM') },
              { title: 'Check-in', dataIndex: 'checkInTime', render: hm },
              { title: '', render: (_: unknown, r: MissedCheckout) => <Button size="small" onClick={() => setTarget({ userId: r.userId, name: r.employeeName, date: r.date, status: r.status, checkIn: r.checkInTime })}>Fix</Button> },
            ]}
          />
        </Card>
      )}

      <Card title={`Late arrivals — ${month.format('MMMM YYYY')}`} extra={late && <Text type="secondary">After the {late.graceMinutes}-minute grace period</Text>}>
        <Table
          rowKey="userId" size="small" pagination={{ pageSize: 8, hideOnSinglePage: true }} dataSource={late?.people ?? []} locale={{ emptyText: 'Nobody was late this month' }}
          columns={[
            { title: 'Employee', dataIndex: 'employeeName' },
            { title: 'Times late', dataIndex: 'count', align: 'right', sorter: (a, b) => a.count - b.count, defaultSortOrder: 'descend' },
            { title: 'Total minutes', dataIndex: 'totalMinutes', align: 'right' },
            { title: 'Days', render: (_: unknown, r: LateReport['people'][number]) => r.days.map((d) => `${dayjs(d.date).format('DD')} (${d.minutes}m)`).join(', ') },
          ]}
        />
      </Card>

      <ManualModal target={target} onClose={() => setTarget(null)} onSaved={() => { setTarget(null); void load(); }} />
    </Space>
  );
}

// ───────────────────────── Holidays and rules (admin) ─────────────────────────

function SettingsPanel() {
  const [year, setYear] = useState(dayjs().year());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [config, setConfig] = useState<AttendanceConfig | null>(null);
  const [hForm] = Form.useForm<{ date: Dayjs; name: string }>();
  const [cForm] = Form.useForm<{ shiftStart: Dayjs; graceMinutes: number; halfDayMinutes: number; weekOffDays: number[] }>();
  const [roleRule, setRoleRule] = useState<{ role: string; days: number[] }>({ role: 'Employee', days: [0] });

  const load = useCallback(async () => {
    try {
      const [h, c] = await Promise.all([leaveApi.holidays(year), leaveApi.config()]);
      setHolidays(h); setConfig(c);
      cForm.setFieldsValue({ shiftStart: dayjs(c.shiftStart, 'HH:mm'), graceMinutes: c.graceMinutes, halfDayMinutes: c.halfDayMinutes, weekOffDays: c.weekOffDays });
    } catch (e) { message.error(errText(e)); }
  }, [year, cForm]);
  useEffect(() => { void load(); }, [load]);

  const addHoliday = async (v: { date: Dayjs; name: string }) => {
    try { await leaveApi.addHoliday({ date: v.date.format('YYYY-MM-DD'), name: v.name }); hForm.resetFields(); message.success('Holiday added'); await load(); } catch (e) { message.error(errText(e)); }
  };
  const removeHoliday = async (id: string) => {
    try { await leaveApi.removeHoliday(id); await load(); } catch (e) { message.error(errText(e)); }
  };
  const saveConfig = async (v: { shiftStart: Dayjs; graceMinutes: number; halfDayMinutes: number; weekOffDays: number[] }) => {
    try {
      await leaveApi.saveConfig({ shiftStart: v.shiftStart.format('HH:mm'), graceMinutes: v.graceMinutes, halfDayMinutes: v.halfDayMinutes, weekOffDays: v.weekOffDays });
      message.success('Attendance rules saved'); await load();
    } catch (e) { message.error(errText(e)); }
  };
  const saveRule = async () => {
    try { setConfig(await leaveApi.setWeekOff({ scope: 'role', target: roleRule.role, days: roleRule.days })); message.success('Week-off for the role saved'); } catch (e) { message.error(errText(e)); }
  };
  const removeRule = async (id: string) => {
    try { setConfig(await leaveApi.removeWeekOff(id)); } catch (e) { message.error(errText(e)); }
  };

  const dayOptions = WEEKDAYS.map((w, i) => ({ value: i, label: w }));

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title="Holiday calendar" extra={<Select value={year} onChange={setYear} options={[year - 1, year, year + 1].map((y) => ({ value: y, label: y }))} style={{ width: 100 }} />}>
        <Form form={hForm} layout="inline" onFinish={addHoliday} style={{ marginBottom: 16 }}>
          <Form.Item name="date" rules={[{ required: true, message: 'Pick a date' }]}><DatePicker /></Form.Item>
          <Form.Item name="name" rules={[{ required: true, message: 'Name the holiday' }]}><Input placeholder="Diwali" maxLength={120} /></Form.Item>
          <Button type="primary" htmlType="submit">Add holiday</Button>
        </Form>
        <Table
          rowKey="id" size="small" dataSource={holidays} pagination={{ pageSize: 12, hideOnSinglePage: true }}
          columns={[
            { title: 'Date', dataIndex: 'date', render: (d: string) => dayjs(d).format('ddd, DD MMM YYYY') },
            { title: 'Holiday', dataIndex: 'name' },
            { title: '', render: (_: unknown, h: Holiday) => <Popconfirm title="Remove this holiday?" onConfirm={() => removeHoliday(h.id)}><Button size="small" danger>Remove</Button></Popconfirm> },
          ]}
        />
      </Card>

      <Card title="Attendance rules">
        <Form form={cForm} layout="vertical" onFinish={saveConfig} style={{ maxWidth: 420 }}>
          <Form.Item name="shiftStart" label="Office start time (IST)" rules={[{ required: true }]}><TimePicker format="HH:mm" minuteStep={5} allowClear={false} /></Form.Item>
          <Form.Item name="graceMinutes" label="Grace period (minutes) before a check-in counts as late" rules={[{ required: true }]}><InputNumber min={0} max={240} /></Form.Item>
          <Form.Item name="halfDayMinutes" label="Counted as half-day if checked in for less than (minutes)" rules={[{ required: true }]}><InputNumber min={30} max={720} /></Form.Item>
          <Form.Item name="weekOffDays" label="Week-off days for everyone"><Checkbox.Group options={dayOptions} /></Form.Item>
          <Button type="primary" htmlType="submit">Save rules</Button>
        </Form>
      </Card>

      <Card title="Week-off by role" extra={<Text type="secondary">Overrides the default for that role</Text>}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Select value={roleRule.role} onChange={(role) => setRoleRule((r) => ({ ...r, role }))} style={{ width: 140 }} options={['Admin', 'Employee', 'Agent'].map((r) => ({ value: r, label: r }))} />
          <Checkbox.Group options={dayOptions} value={roleRule.days} onChange={(days) => setRoleRule((r) => ({ ...r, days: days as number[] }))} />
          <Button onClick={saveRule}>Save for role</Button>
        </Space>
        <Table
          rowKey="id" size="small" pagination={false} dataSource={config?.rules ?? []} locale={{ emptyText: 'No role overrides' }}
          columns={[
            { title: 'Applies to', render: (_: unknown, r: AttendanceConfig['rules'][number]) => `${r.scope === 'role' ? 'Role' : 'Person'}: ${r.target}` },
            { title: 'Week-off', render: (_: unknown, r: AttendanceConfig['rules'][number]) => (r.days.length ? r.days.map((d) => WEEKDAYS[d]).join(', ') : 'None') },
            { title: '', render: (_: unknown, r: AttendanceConfig['rules'][number]) => <Button size="small" onClick={() => removeRule(r.id)}>Remove</Button> },
          ]}
        />
      </Card>
    </Space>
  );
}

// ───────────────────────── Page ─────────────────────────

export default function AttendancePage() {
  const me = useAppSelector((s) => s.auth.user);
  const isAdmin = isAdminRole(me?.role);

  const items = [
    { key: 'day', label: 'My attendance', children: <MyDay /> },
    { key: 'leave', label: 'Leave', children: <LeavePanel /> },
    ...(isAdmin
      ? [
          { key: 'approvals', label: 'Approvals', children: <Approvals /> },
          { key: 'register', label: 'Register', children: <RegisterPanel /> },
          { key: 'settings', label: 'Holidays & rules', children: <SettingsPanel /> },
        ]
      : []),
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginTop: 0 }}>Attendance</Title>
      <Tabs items={items} destroyInactiveTabPane />
    </div>
  );
}
