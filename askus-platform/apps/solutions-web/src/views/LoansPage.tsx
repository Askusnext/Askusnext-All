import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Descriptions, Drawer, Empty, Input, Modal, Select, Space, Table, Tabs, Tag, Timeline, Typography, message,
} from 'antd';
import { ReloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { useAppSelector } from '../store';
import AssignBox from '../components/AssignBox';
import ItemTrail from '../components/ItemTrail';
import { activityApi } from '../api/activity';
import type { ColumnsType } from 'antd/es/table';
import {
  FORM_STATUSES, JOURNEY_ACTIONS, JOURNEY_STATUS, LOANS_LIVE, loansAdminApi,
  type JourneyAction, type JourneyHistory, type JourneyNote, type JourneyStatus, type LoanDocument, type LoanForm, type LoanJourney,
} from '../api/loansAdmin';

const { Title, Text, Paragraph } = Typography;

const inr = (n?: number) => (typeof n === 'number' ? `₹${n.toLocaleString('en-IN')}` : '—');
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const pretty = (s?: string) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

function StatusTag({ status }: { status: string }) {
  const info = JOURNEY_STATUS[status as JourneyStatus];
  return <Tag color={info?.color ?? 'default'}>{info?.label ?? pretty(status)}</Tag>;
}

async function viewFile(storageKey?: string) {
  if (!storageKey) return;
  try { await loansAdminApi.openFile(storageKey); } catch (e) { message.error(errText(e)); }
}

export default function LoansPage() {
  const [journeys, setJourneys] = useState<LoanJourney[]>([]);
  const [forms, setForms] = useState<LoanForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assignFilter, setAssignFilter] = useState<'all' | 'mine' | 'none'>('all');
  const meId = useAppSelector((s) => s.auth.user)?.id;
  const assignOk = (id?: string) => assignFilter === 'all' || (assignFilter === 'mine' ? id === meId : !id);
  const [openJourney, setOpenJourney] = useState<LoanJourney | null>(null);
  const [openForm, setOpenForm] = useState<LoanForm | null>(null);

  const load = useCallback(async () => {
    if (!LOANS_LIVE) return;
    setLoading(true);
    setError('');
    try {
      const [j, f] = await Promise.all([loansAdminApi.journeys(), loansAdminApi.forms()]);
      setJourneys(j);
      setForms(f);
      // keep an open drawer in step with the fresh data
      setOpenJourney((cur) => (cur ? j.find((x) => x.uid === cur.uid && x.id === cur.id) ?? cur : cur));
      setOpenForm((cur) => (cur ? f.find((x) => x.id === cur.id) ?? cur : cur));
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const q = search.trim().toLowerCase();
  const shownJourneys = useMemo(() => journeys.filter((j) =>
    (statusFilter === 'all' || j.status === statusFilter) && assignOk(j.assignedToId) &&
    (!q || [j.customerName, j.customerMobile, j.referenceNumber, j.lenderId, j.loanType].some((v) => (v ?? '').toLowerCase().includes(q))),
  ), [journeys, q, statusFilter]);
  const shownForms = useMemo(() => forms.filter((f) =>
    (statusFilter === 'all' || f.status === statusFilter) && assignOk(f.assignedToId) &&
    (!q || [f.userName, f.userMobile, f.referenceNumber, f.lenderName, f.serviceName].some((v) => (v ?? '').toLowerCase().includes(q))),
  ), [forms, q, statusFilter]);

  const count = (s: JourneyStatus) => journeys.filter((j) => j.status === s).length;
  const stats = [
    { label: 'Loan journeys', value: journeys.length },
    { label: 'Awaiting review', value: count('submitted') },
    { label: 'Under review', value: count('under_review') },
    { label: 'Waiting on customer', value: count('documents_required') },
    { label: 'Approved', value: count('approved') + count('disbursed') },
    { label: 'Application forms', value: forms.length },
  ];

  const assignedCol = {
    title: 'Working on it',
    render: (_: unknown, r: { assignedToName?: string; assignedToId?: string }) =>
      r.assignedToName ? <Tag color={r.assignedToId === meId ? 'blue' : 'default'}>{r.assignedToName}</Tag> : <Text type="secondary">Nobody</Text>,
  };

  const journeyColumns: ColumnsType<LoanJourney> = [
    { title: 'Reference', dataIndex: 'referenceNumber', render: (v?: string) => v ?? <Text type="secondary">Draft</Text> },
    {
      title: 'Customer',
      render: (_, j) => (<div><div style={{ fontWeight: 600 }}>{j.customerName || '—'}</div><Text type="secondary">{j.customerMobile}</Text></div>),
    },
    { title: 'Loan', render: (_, j) => `${pretty(j.loanType)} · ${j.lenderId.toUpperCase()}` },
    { title: 'Amount', dataIndex: 'amount', render: inr, align: 'right' },
    { title: 'Tenure', dataIndex: 'tenureMonths', render: (v: number) => `${v} mo` },
    assignedCol,
    { title: 'Status', dataIndex: 'status', render: (s: string) => <StatusTag status={s} /> },
    { title: 'Updated', dataIndex: 'updatedAt', render: when },
  ];

  const formColumns: ColumnsType<LoanForm> = [
    { title: 'Reference', dataIndex: 'referenceNumber' },
    {
      title: 'Applicant',
      render: (_, f) => (<div><div style={{ fontWeight: 600 }}>{f.userName || f.fullName || '—'}</div><Text type="secondary">{f.userMobile}</Text></div>),
    },
    { title: 'Product', render: (_, f) => `${f.serviceName ?? '—'} · ${f.lenderName ?? '—'}` },
    { title: 'Amount', dataIndex: 'loanAmount', render: inr, align: 'right' },
    assignedCol,
    { title: 'Status', dataIndex: 'status', render: (s: string) => <StatusTag status={s} /> },
    { title: 'Submitted', dataIndex: 'createdAt', render: when },
  ];

  if (!LOANS_LIVE) {
    return (
      <div style={{ padding: 28 }}>
        <Title level={3}>Askus Loans</Title>
        <Alert
          type="info"
          showIcon
          message="Connect to the backend to see loan applications"
          description="This console reads real data from the AskUs API. Create apps/solutions-web/.env.local with NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api, restart the dev server and sign in again."
        />
      </div>
    );
  }

  const statusOptions = [{ value: 'all', label: 'All statuses' }, ...FORM_STATUSES.map((s) => ({ value: s, label: JOURNEY_STATUS[s as JourneyStatus]?.label ?? pretty(s) }))];

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Askus Loans</Title>
          <Text type="secondary">Everything customers submit on the loans site, live from the database.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Refresh</Button>
      </div>

      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Could not load loan data" description={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        {stats.map((s) => (
          <Card key={s.label} size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>{s.label}</Text>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search placeholder="Search name, mobile, reference, lender" allowClear style={{ width: 320 }} onChange={(e) => setSearch(e.target.value)} />
        <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} style={{ width: 200 }} />
        <Select value={assignFilter} onChange={setAssignFilter} style={{ width: 170 }}
          options={[{ value: 'all', label: 'Everyone\'s items' }, { value: 'mine', label: 'Assigned to me' }, { value: 'none', label: 'Unassigned' }]} />
      </Space>

      <Tabs
        items={[
          {
            key: 'journeys',
            label: `Loan journeys (${shownJourneys.length})`,
            children: (
              <Table<LoanJourney>
                rowKey={(j) => `${j.uid}/${j.id}`}
                loading={loading}
                columns={journeyColumns}
                dataSource={shownJourneys}
                onRow={(j) => ({ onClick: () => setOpenJourney(j), style: { cursor: 'pointer' } })}
                locale={{ emptyText: <Empty description="No loan journeys yet" /> }}
                scroll={{ x: 900 }}
              />
            ),
          },
          {
            key: 'forms',
            label: `Application forms (${shownForms.length})`,
            children: (
              <Table<LoanForm>
                rowKey="id"
                loading={loading}
                columns={formColumns}
                dataSource={shownForms}
                onRow={(f) => ({ onClick: () => setOpenForm(f), style: { cursor: 'pointer' } })}
                locale={{ emptyText: <Empty description="No application forms yet" /> }}
                scroll={{ x: 900 }}
              />
            ),
          },
        ]}
      />

      <JourneyDrawer journey={openJourney} onClose={() => setOpenJourney(null)} onChanged={load} />
      <FormDrawer form={openForm} onClose={() => setOpenForm(null)} onChanged={load} />
    </div>
  );
}

// ───────────────────────── loan journey detail ─────────────────────────

function JourneyDrawer({ journey, onClose, onChanged }: { journey: LoanJourney | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const [docs, setDocs] = useState<LoanDocument[]>([]);
  const [history, setHistory] = useState<JourneyHistory[]>([]);
  const [notes, setNotes] = useState<JourneyNote[]>([]);
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<JourneyAction | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [reject, setReject] = useState<LoanDocument | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const key = journey ? `${journey.uid}/${journey.id}/${journey.updatedAt}` : '';
  const reload = useCallback(async () => {
    if (!journey) return;
    try {
      const [d, h, n, s] = await Promise.all([
        loansAdminApi.journeyDocs(journey), loansAdminApi.journeyHistory(journey),
        loansAdminApi.journeyNotes(journey), loansAdminApi.journeySnapshot(journey),
      ]);
      setDocs(d); setHistory(h); setNotes(n); setSnapshot(s);
    } catch (e) { message.error(errText(e)); }
  }, [journey]);

  useEffect(() => { setDocs([]); setHistory([]); setNotes([]); setSnapshot(null); void reload(); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  // record that this customer's file was opened
  useEffect(() => {
    if (journey) void activityApi.view({ module: 'loans', entityType: 'loan_journey', entityId: `${journey.uid}/${journey.id}`, entityLabel: journey.referenceNumber ?? journey.id });
  }, [journey?.uid, journey?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!journey) return null;
  const actions = JOURNEY_ACTIONS[journey.status] ?? [];

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try { await fn(); message.success(done); await onChanged(); await reload(); } catch (e) { message.error(errText(e)); } finally { setBusy(false); }
  };

  const confirmAction = async () => {
    if (!action) return;
    if (action.messageRequired && !actionMsg.trim()) return message.warning('Write a message for the customer.');
    await run(() => loansAdminApi.setJourneyStatus(journey, action.to, actionMsg.trim(), actionNote.trim() || undefined), `Moved to ${JOURNEY_STATUS[action.to].label}`);
    setAction(null);
  };

  const snap = (k: string) => (snapshot?.[k] != null && snapshot[k] !== '' ? String(snapshot[k]) : '—');

  return (
    <Drawer open width={720} onClose={onClose} title={<Space>{journey.referenceNumber ?? 'Draft application'}<StatusTag status={journey.status} /></Space>}>
      <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Customer">{journey.customerName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Mobile">{journey.customerMobile || '—'}</Descriptions.Item>
        <Descriptions.Item label="Loan">{pretty(journey.loanType)}</Descriptions.Item>
        <Descriptions.Item label="Lender">{journey.lenderId.toUpperCase()}</Descriptions.Item>
        <Descriptions.Item label="Amount">{inr(journey.amount)}</Descriptions.Item>
        <Descriptions.Item label="Tenure / rate">{journey.tenureMonths} months · {journey.roi}%</Descriptions.Item>
        <Descriptions.Item label="Purpose" span={2}>{journey.purpose || '—'}</Descriptions.Item>
        <Descriptions.Item label="Submitted">{when(journey.submittedAt)}</Descriptions.Item>
        <Descriptions.Item label="Resubmissions">{journey.resubmissions ?? 0}</Descriptions.Item>
      </Descriptions>

      <AssignBox assignedToId={journey.assignedToId} assignedToName={journey.assignedToName}
        onAssign={async (id) => { await loansAdminApi.assignJourney(journey, id); await onChanged(); }} />

      {actions.length > 0 && (
        <Space style={{ marginBottom: 16 }} wrap>
          {actions.map((a) => (
            <Button key={a.to} type={a.primary ? 'primary' : 'default'} danger={a.danger} disabled={busy}
              onClick={() => { setAction(a); setActionMsg(a.defaultMessage); setActionNote(''); }}>
              {a.label}
            </Button>
          ))}
        </Space>
      )}
      {journey.status === 'in_progress' && <Alert type="info" showIcon style={{ marginBottom: 16 }} message="The customer has not submitted this application yet." />}

      <Title level={5}>Applicant details (at submission)</Title>
      {snapshot ? (
        <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Name">{snap('fullName')}</Descriptions.Item>
          <Descriptions.Item label="PAN">{snap('panNumber')}</Descriptions.Item>
          <Descriptions.Item label="Date of birth">{snap('dateOfBirth')}</Descriptions.Item>
          <Descriptions.Item label="Email">{snap('email')}</Descriptions.Item>
          <Descriptions.Item label="Employment">{pretty(snap('employmentType'))}</Descriptions.Item>
          <Descriptions.Item label="Employer">{snap('employerName')}</Descriptions.Item>
          <Descriptions.Item label="Monthly income">{snapshot.monthlyIncome ? inr(Number(snapshot.monthlyIncome)) : '—'}</Descriptions.Item>
          <Descriptions.Item label="Salary bank">{snap('salaryBank')}</Descriptions.Item>
          <Descriptions.Item label="Address" span={2}>{[snap('address'), snap('addressLine2'), snap('city'), snap('state'), snap('pinCode')].filter((v) => v !== '—').join(', ') || '—'}</Descriptions.Item>
        </Descriptions>
      ) : <Text type="secondary">Not captured yet (taken when the customer submits).</Text>}

      <Title level={5} style={{ marginTop: 16 }}>Documents</Title>
      <Table<LoanDocument>
        size="small" pagination={false} rowKey="slot" dataSource={docs}
        locale={{ emptyText: 'No documents uploaded' }}
        columns={[
          { title: 'Document', render: (_, d) => (<div><div>{d.label}</div><Text type="secondary" style={{ fontSize: 12 }}>{d.fileName}</Text></div>) },
          {
            title: 'Review',
            render: (_, d) => d.reviewStatus === 'verified' ? <Tag color="green">Verified</Tag>
              : d.reviewStatus === 'rejected' ? <Tag color="red" title={d.reviewNote}>Needs changes</Tag> : <Tag>Not reviewed</Tag>,
          },
          {
            title: '', align: 'right',
            render: (_, d) => (
              <Space size="small">
                <Button size="small" icon={<FileTextOutlined />} onClick={() => void viewFile(d.storageKey)}>View</Button>
                <Button size="small" disabled={busy || journey.status === 'in_progress'} onClick={() => void run(() => loansAdminApi.reviewJourneyDoc(journey, d.slot, 'verified'), 'Document verified')}>Verify</Button>
                <Button size="small" danger disabled={busy || journey.status === 'in_progress'} onClick={() => { setReject(d); setRejectReason(''); }}>Flag</Button>
              </Space>
            ),
          },
        ]}
      />

      <Title level={5} style={{ marginTop: 16 }}>Timeline</Title>
      {history.length === 0 ? <Text type="secondary">No activity yet.</Text> : (
        <Timeline
          items={history.map((h) => ({
            color: h.actor === 'admin' ? 'blue' : 'green',
            children: (<div><b>{pretty(h.event)}</b> · {JOURNEY_STATUS[h.to as JourneyStatus]?.label ?? pretty(h.to)} <Text type="secondary">({h.actor}, {when(h.at)})</Text>{h.message && <Paragraph style={{ margin: 0 }}>{h.message}</Paragraph>}</div>),
          }))}
        />
      )}

      <Title level={5} style={{ marginTop: 16 }}>Internal notes <Text type="secondary" style={{ fontSize: 12 }}>(customer never sees these)</Text></Title>
      {notes.map((n) => (<Paragraph key={n.id} style={{ marginBottom: 6 }}>{n.text} <Text type="secondary" style={{ fontSize: 12 }}>— {n.byEmail || 'staff'}, {when(n.at)}</Text></Paragraph>))}
      <Space.Compact style={{ width: '100%' }}>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the team" onPressEnter={() => note.trim() && void run(async () => { await loansAdminApi.addJourneyNote(journey, note.trim()); setNote(''); }, 'Note added')} />
        <Button disabled={!note.trim() || busy} onClick={() => void run(async () => { await loansAdminApi.addJourneyNote(journey, note.trim()); setNote(''); }, 'Note added')}>Add</Button>
      </Space.Compact>

      <ItemTrail entityId={`${journey.uid}/${journey.id}`} refreshKey={`${journey.updatedAt}${journey.assignedToId ?? ''}${history.length}${notes.length}`} />

      <Modal open={Boolean(action)} title={action?.label} okText="Confirm" confirmLoading={busy} onOk={() => void confirmAction()} onCancel={() => setAction(null)}>
        <Text>Message to the customer{action?.messageRequired ? ' (required)' : ''}</Text>
        <Input.TextArea rows={3} value={actionMsg} maxLength={500} onChange={(e) => setActionMsg(e.target.value)} style={{ margin: '6px 0 12px' }} />
        <Text>Internal note (optional)</Text>
        <Input.TextArea rows={2} value={actionNote} maxLength={1000} onChange={(e) => setActionNote(e.target.value)} style={{ marginTop: 6 }} />
      </Modal>

      <Modal open={Boolean(reject)} title={`Flag ${reject?.label ?? 'document'}`} okText="Flag document" okButtonProps={{ danger: true }} confirmLoading={busy}
        onCancel={() => setReject(null)}
        onOk={() => {
          if (!rejectReason.trim()) return message.warning('Say what is wrong with this document.');
          const d = reject!;
          void run(() => loansAdminApi.reviewJourneyDoc(journey, d.slot, 'rejected', rejectReason.trim()), 'Document flagged').then(() => setReject(null));
        }}>
        <Text>What does the customer need to fix?</Text>
        <Input.TextArea rows={3} maxLength={300} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} style={{ marginTop: 6 }} />
      </Modal>
    </Drawer>
  );
}

// ───────────────────────── full application form detail ─────────────────────────

function FormDrawer({ form, onClose, onChanged }: { form: LoanForm | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { setStatus(form?.status ?? ''); setNote(''); }, [form?.id, form?.status]);
  useEffect(() => {
    if (form) void activityApi.view({ module: 'loans', entityType: 'loan_form', entityId: form.id, entityLabel: form.referenceNumber });
  }, [form?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!form) return null;

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try { await fn(); message.success(done); await onChanged(); } catch (e) { message.error(errText(e)); } finally { setBusy(false); }
  };

  return (
    <Drawer open width={720} onClose={onClose} title={<Space>{form.referenceNumber}<StatusTag status={form.status} /></Space>}>
      <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Applicant">{form.userName || form.fullName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Mobile">{form.userMobile || '—'}</Descriptions.Item>
        <Descriptions.Item label="Product">{form.serviceName ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Lender">{form.lenderName ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Amount">{inr(form.loanAmount)}</Descriptions.Item>
        <Descriptions.Item label="Tenure / rate / EMI">{form.tenureMonths ?? '—'} mo · {form.interestRate ?? '—'}% · {inr(form.calculatedEmi)}</Descriptions.Item>
        <Descriptions.Item label="Purpose" span={2}>{form.purpose || '—'}</Descriptions.Item>
        <Descriptions.Item label="PAN">{form.panNumber || '—'}</Descriptions.Item>
        <Descriptions.Item label="Date of birth">{form.dob || '—'}</Descriptions.Item>
        <Descriptions.Item label="Employment">{pretty(form.employmentType)}</Descriptions.Item>
        <Descriptions.Item label="Employer">{form.employerName || '—'}{form.designation ? ` · ${form.designation}` : ''}</Descriptions.Item>
        <Descriptions.Item label="Monthly income">{inr(form.monthlyIncome)}</Descriptions.Item>
        <Descriptions.Item label="Submitted">{when(form.createdAt)}</Descriptions.Item>
        <Descriptions.Item label="Address" span={2}>{[form.currentAddress, form.city, form.state, form.pincode].filter(Boolean).join(', ') || '—'}</Descriptions.Item>
      </Descriptions>

      <AssignBox assignedToId={form.assignedToId} assignedToName={form.assignedToName}
        onAssign={async (id) => { await loansAdminApi.assignForm(form.id, id); await onChanged(); }} />

      <Title level={5}>Update status</Title>
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Select value={status} onChange={setStatus} style={{ width: 220 }} options={FORM_STATUSES.map((s) => ({ value: s, label: JOURNEY_STATUS[s as JourneyStatus]?.label ?? pretty(s) }))} />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={500} />
        <Button type="primary" disabled={busy || status === form.status} onClick={() => void run(() => loansAdminApi.setFormStatus(form.id, status, note.trim() || undefined), 'Status updated')}>Save</Button>
      </Space.Compact>

      <Title level={5}>Documents</Title>
      <Table<LoanForm['documents'][number]>
        size="small" pagination={false} rowKey="id" dataSource={form.documents}
        columns={[
          { title: 'Document', render: (_, d) => (<div><div>{d.title}{d.required && <Tag style={{ marginLeft: 6 }}>Required</Tag>}</div><Text type="secondary" style={{ fontSize: 12 }}>{d.fileName ?? 'Not uploaded'}</Text></div>) },
          { title: 'Status', render: (_, d) => <Tag color={d.status === 'verified' ? 'green' : d.status === 'pending' ? 'default' : 'red'}>{pretty(d.status)}</Tag> },
          {
            title: '', align: 'right',
            render: (_, d) => (
              <Space size="small">
                <Button size="small" icon={<FileTextOutlined />} disabled={!d.storageKey} onClick={() => void viewFile(d.storageKey)}>View</Button>
                <Button size="small" disabled={busy || !d.storageKey} onClick={() => void run(() => loansAdminApi.reviewFormDoc(form.id, d.id, 'verified'), 'Document verified')}>Verify</Button>
                <Button size="small" danger disabled={busy || !d.storageKey}
                  onClick={() => {
                    let reason = '';
                    Modal.confirm({
                      title: `Ask for a new ${d.title}`,
                      content: <Input.TextArea rows={3} maxLength={300} placeholder="What needs to change?" onChange={(e) => { reason = e.target.value; }} />,
                      okText: 'Request re-upload',
                      onOk: () => (reason.trim() ? run(() => loansAdminApi.reviewFormDoc(form.id, d.id, 'reupload_required', reason.trim()), 'Re-upload requested') : (message.warning('Write a reason first.'), Promise.reject())),
                    });
                  }}>
                  Re-upload
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <ItemTrail entityId={form.id} refreshKey={`${form.updatedAt}${form.assignedToId ?? ''}${form.statusHistory.length}`} />

      <Title level={5} style={{ marginTop: 16 }}>History</Title>
      <Timeline items={form.statusHistory.map((h) => ({ children: (<div><b>{JOURNEY_STATUS[h.status as JourneyStatus]?.label ?? pretty(h.status)}</b> <Text type="secondary">{when(h.timestamp)}</Text>{h.note && <Paragraph style={{ margin: 0 }}>{h.note}</Paragraph>}</div>) }))} />
    </Drawer>
  );
}
