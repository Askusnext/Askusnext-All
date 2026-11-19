import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Descriptions, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Select, Space, Steps, Table, Tabs, Tag, Timeline, Tooltip, Typography, Upload, message,
} from 'antd';
import { CheckCircleOutlined, DownloadOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAppSelector } from '../store';
import { isAdminRole } from '../access';
import {
  DOC_LABEL, INSURERS, LENDERS, LOAN_TYPES, STAGES, STAGE_LABEL, leadsApi,
  type DocKind, type Lead, type LeadDetail, type LeadStatus, type LeadVertical, type NewLead, type Rule,
} from '../api/leads';

const asNum = (v: string | number | null) => (v === null || v === '' ? null : Number(v));
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const inr = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `₹${n.toLocaleString('en-IN')}`);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
const STATUS_COLOR: Record<LeadStatus, string> = { New: 'blue', Assigned: 'geekblue', QuoteShared: 'cyan', PaymentPending: 'orange', PaymentUploaded: 'gold', Issued: 'green', Closed: 'default', Rejected: 'red' };
const VERTICAL_TAG = (v: LeadVertical) => <Tag color={v === 'insurance' ? 'purple' : 'volcano'}>{v === 'insurance' ? 'Insurance' : 'Loan'}</Tag>;

function SlaTag({ l }: { l: Lead }) {
  const done = ['Issued', 'Closed', 'Rejected'].includes(l.status);
  if (l.slaBreachedAt) return <Tag color="red">SLA breached{l.urgent ? ' · urgent' : ''}</Tag>;
  if (done) return <Tag color="green">within SLA</Tag>;
  return <Tooltip title={`Due ${when(l.slaDueAt)}`}><Tag color={l.slaOverdue ? 'red' : l.urgent ? 'volcano' : 'default'}>{l.urgent ? 'Urgent · ' : ''}due {when(l.slaDueAt)}</Tag></Tooltip>;
}

// ───────────────────────────── new lead ─────────────────────────────

function NewLeadModal({ open, verticals, onClose, onCreated }: { open: boolean; verticals: LeadVertical[]; onClose: () => void; onCreated: (l: Lead) => void }) {
  const [form] = Form.useForm<NewLead>();
  const [vertical, setVertical] = useState<LeadVertical>(verticals[0] ?? 'insurance');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Lead | null>(null);
  const [uploaded, setUploaded] = useState<string[]>([]);

  useEffect(() => { if (open) { setCreated(null); setUploaded([]); form.resetFields(); setVertical(verticals[0] ?? 'insurance'); } }, [open, form, verticals]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try { setCreated(await leadsApi.create({ ...v, vertical })); message.success('Lead submitted'); } catch (e) { message.error(errText(e)); } finally { setSaving(false); }
  };
  const docKinds: DocKind[] = vertical === 'insurance' ? ['previous_policy', 'other'] : ['kyc', 'income_proof', 'other'];

  return (
    <Modal open={open} title={created ? `Lead ${created.ticketNumber} created` : 'New lead'} onCancel={() => { if (created) onCreated(created); onClose(); }} destroyOnClose
      footer={created ? <Button type="primary" onClick={() => { onCreated(created); onClose(); }}>Done</Button> : <Button type="primary" loading={saving} onClick={submit}>Submit</Button>}>
      {created ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert type="success" showIcon message={`Ticket ${created.ticketNumber} is in the ${created.vertical === 'insurance' ? 'Insurance' : 'Loan'} pool`} description="An admin will claim it. You'll be notified at every stage, so there's no need to chase." />
          <Typography.Text strong>Attach documents (PDF, JPG or PNG, up to 10 MB)</Typography.Text>
          {docKinds.map((k) => (
            <Upload key={k} showUploadList={false} accept=".pdf,.jpg,.jpeg,.png" customRequest={async ({ file, onSuccess, onError }) => {
              try { await leadsApi.upload(created.id, k, file as File); setUploaded((u) => [...u, DOC_LABEL[k]]); onSuccess?.('ok'); message.success(`${DOC_LABEL[k]} uploaded`); } catch (e) { onError?.(e as Error); message.error(errText(e)); }
            }}>
              <Button icon={<UploadOutlined />}>{DOC_LABEL[k]}</Button>
            </Upload>
          ))}
          {uploaded.length > 0 && <Typography.Text type="secondary">Uploaded: {uploaded.join(', ')}</Typography.Text>}
        </Space>
      ) : (
        <Form form={form} layout="vertical" requiredMark={false}>
          {verticals.length > 1 && <Segmented block style={{ marginBottom: 16 }} value={vertical} onChange={(v) => setVertical(v as LeadVertical)} options={[{ value: 'insurance', label: 'Insurance' }, { value: 'loan', label: 'Loan' }]} />}
          <Form.Item name="customerName" label="Customer name" rules={[{ required: true, min: 2 }]}><Input maxLength={120} /></Form.Item>
          <Space style={{ width: '100%' }} size="middle" align="start">
            <Form.Item name="customerPhone" label="Phone number" rules={[{ required: true, pattern: /^[+\d][\d\s-]{8,14}$/, message: 'Enter a valid phone number' }]}><Input maxLength={16} /></Form.Item>
            <Form.Item name="customerEmail" label="Email (optional)" rules={[{ type: 'email' }]}><Input /></Form.Item>
          </Space>
          {vertical === 'insurance' ? (
            <>
              <Space style={{ width: '100%' }} size="middle" align="start">
                <Form.Item name="vehicleRegNo" label="Vehicle reg. no." rules={[{ required: true }]}><Input placeholder="MH12AB1234" maxLength={20} /></Form.Item>
                <Form.Item name="vehicleType" label="Vehicle type" rules={[{ required: true }]}><Select style={{ width: 150 }} options={['Car', 'Bike', 'Commercial', 'Taxi', 'Other'].map((v) => ({ value: v, label: v }))} /></Form.Item>
              </Space>
              <Space style={{ width: '100%' }} size="middle" align="start">
                <Form.Item name="insurer" label="Insurer" rules={[{ required: true }]}><Select style={{ width: 200 }} options={INSURERS.map((v) => ({ value: v, label: v }))} /></Form.Item>
                <Form.Item name="policyType" label="Policy type" rules={[{ required: true }]}><Select style={{ width: 170 }} options={['Comprehensive', 'Third-party', 'Renewal'].map((v) => ({ value: v, label: v }))} /></Form.Item>
              </Space>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>A "Renewal" lead is treated as urgent and gets a much shorter deadline.</Typography.Text>
            </>
          ) : (
            <>
              <Space style={{ width: '100%' }} size="middle" align="start">
                <Form.Item name="loanType" label="Loan type" rules={[{ required: true }]}><Select style={{ width: 170 }} options={LOAN_TYPES.map((v) => ({ value: v, label: v }))} /></Form.Item>
                <Form.Item name="loanAmount" label="Required amount (₹)" rules={[{ required: true, type: 'number', min: 1 }]}><InputNumber style={{ width: 180 }} min={1} step={10000} /></Form.Item>
              </Space>
              <Form.Item name="lender" label="Preferred lender / bank" rules={[{ required: true }]}><Select style={{ width: 220 }} options={LENDERS.map((v) => ({ value: v, label: v }))} /></Form.Item>
            </>
          )}
        </Form>
      )}
    </Modal>
  );
}

// ───────────────────────────── lead drawer ─────────────────────────────

function LeadDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<number | null>(null);
  const [link, setLink] = useState('');
  const [paid, setPaid] = useState<number | null>(null);
  const [issued, setIssued] = useState<number | null>(null);
  const [policyNo, setPolicyNo] = useState('');
  const [expiry, setExpiry] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => { if (id) { try { setLead(await leadsApi.get(id)); } catch (e) { message.error(errText(e)); } } }, [id]);
  useEffect(() => { setLead(null); void load(); }, [load]);

  const run = async (fn: () => Promise<LeadDetail>, ok?: string) => {
    setBusy(true);
    try { setLead(await fn()); if (ok) message.success(ok); onChanged(); } catch (e) { message.error(errText(e)); } finally { setBusy(false); }
  };
  const open = async (docId: string) => {
    try { const url = await leadsApi.openDocument(id as string, docId); window.open(url, '_blank', 'noopener'); } catch (e) { message.error(errText(e)); }
  };
  const uploadBtn = (kind: DocKind, label: string, amount?: number | null) => (
    <Upload showUploadList={false} accept=".pdf,.jpg,.jpeg,.png" disabled={busy} customRequest={async ({ file, onSuccess }) => { await run(() => leadsApi.upload(id as string, kind, file as File, amount ?? undefined), `${label} uploaded`); onSuccess?.('ok'); }}>
      <Button icon={<UploadOutlined />} loading={busy}>{label}</Button>
    </Upload>
  );

  const stageIndex = lead ? Math.max(0, STAGES.findIndex((s) => s.key === lead.status)) : 0;
  const has = (k: DocKind) => !!lead?.documents.some((d) => d.kind === k);

  const actions = () => {
    if (!lead) return null;
    const move = (to: LeadStatus, extra: Partial<{ quoteAmount: number; issuedAmount: number; policyNumber: string; policyExpiryDate: string }> = {}) => run(() => leadsApi.setStatus(lead.id, { status: to, ...extra }), `Moved to ${STAGE_LABEL[to]}`);
    if (lead.status === 'New') return <Alert type="info" showIcon message="This lead is in the pool. Claim it from the Pool tab to start working on it." />;
    if (!lead.canWork) return <Alert type="warning" showIcon message={lead.claimedByName ? `Being worked by ${lead.claimedByName}` : 'Read-only'} description="Only the person who claimed a lead can update it." />;
    const reject = (
      <Popconfirm title="Reject this lead?" description={<Input.TextArea rows={2} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />}
        onConfirm={() => run(() => leadsApi.setStatus(lead.id, { status: 'Rejected', rejectedReason: reason }), 'Lead rejected')} okText="Reject" okButtonProps={{ danger: true }}>
        <Button danger disabled={busy}>Reject</Button>
      </Popconfirm>
    );
    switch (lead.status) {
      case 'Assigned':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            {lead.lockExpiresAt && <Alert type="warning" showIcon message={`You hold this lead. It returns to the pool at ${when(lead.lockExpiresAt)} unless you update it.`} />}
            <Space wrap><InputNumber addonBefore="Quote ₹" min={1} value={quote} onChange={(v) => setQuote(asNum(v))} /><Button type="primary" loading={busy} onClick={() => move('QuoteShared', { quoteAmount: quote ?? undefined })}>Quote shared</Button>
              <Button onClick={() => run(() => leadsApi.release(lead.id), 'Returned to the pool')}>Release to pool</Button>{reject}</Space>
          </Space>
        );
      case 'QuoteShared':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space wrap><Button loading={busy} onClick={() => run(() => leadsApi.generateLink(lead.id), 'Payment link created and sent to the customer')}>Generate payment link</Button>
              <Input style={{ width: 280 }} placeholder="…or paste a https:// payment link" value={link} onChange={(e) => setLink(e.target.value)} />
              <Button disabled={!link} onClick={() => run(() => leadsApi.setLink(lead.id, link), 'Link sent to the customer')}>Use link</Button></Space>
            <Space wrap><Button type="primary" loading={busy} onClick={() => move('PaymentPending')}>Payment pending</Button>{reject}</Space>
          </Space>
        );
      case 'PaymentPending':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space wrap><InputNumber addonBefore="Paid ₹" min={1} value={paid} placeholder={String(lead.quoteAmount ?? '')} onChange={(v) => setPaid(asNum(v))} />{uploadBtn('payment_copy', 'Upload payment copy', paid)}</Space>
            <Space wrap><Button type="primary" loading={busy} disabled={!lead.paymentLinkUrl && !has('payment_copy')} onClick={() => move('PaymentUploaded')}>Link/copy uploaded</Button>{reject}</Space>
          </Space>
        );
      case 'PaymentUploaded':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            {!has('payment_copy') && lead.paymentStatus !== 'collected' && <Space wrap><InputNumber addonBefore="Paid ₹" min={1} value={paid} onChange={(v) => setPaid(asNum(v))} />{uploadBtn('payment_copy', 'Upload payment copy', paid)}</Space>}
            <Space wrap>{uploadBtn('issued_copy', lead.vertical === 'insurance' ? 'Upload policy copy' : 'Upload loan copy')}<Typography.Text type="secondary">{has('issued_copy') ? 'Uploaded and sent to the customer' : 'Sent to the customer automatically'}</Typography.Text></Space>
            <Space wrap>
              <InputNumber addonBefore={lead.vertical === 'insurance' ? 'Premium ₹' : 'Sanctioned ₹'} min={1} value={issued} placeholder={String(lead.quoteAmount ?? lead.loanAmount ?? '')} onChange={(v) => setIssued(asNum(v))} />
              <Input style={{ width: 170 }} placeholder="Policy / loan no." value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} />
              {lead.vertical === 'insurance' && <Input style={{ width: 190 }} type="date" addonBefore="Expires" value={expiry} onChange={(e) => setExpiry(e.target.value)} />}
            </Space>
            <Space wrap><Button type="primary" icon={<CheckCircleOutlined />} loading={busy} disabled={!has('issued_copy')} onClick={() => move('Issued', { issuedAmount: issued ?? undefined, policyNumber: policyNo || undefined, policyExpiryDate: expiry || undefined })}>Mark {lead.vertical === 'insurance' ? 'policy' : 'loan'} issued</Button>{reject}</Space>
          </Space>
        );
      case 'Issued':
        return <Button type="primary" loading={busy} onClick={() => move('Closed')}>Close ticket</Button>;
      default:
        return null;
    }
  };

  return (
    <Drawer open={id !== null} onClose={onClose} width={760} destroyOnClose title={lead ? <Space>{lead.ticketNumber}{VERTICAL_TAG(lead.vertical)}<Tag color={STATUS_COLOR[lead.status]}>{STAGE_LABEL[lead.status]}</Tag><SlaTag l={lead} /></Space> : 'Lead'} loading={!lead}>
      {lead && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {lead.status !== 'Rejected' && <Steps size="small" current={stageIndex} items={STAGES.map((s) => ({ title: s.label }))} responsive />}
          {lead.status === 'Rejected' && <Alert type="error" showIcon message="Rejected" description={lead.rejectedReason} />}
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Customer">{lead.customerName}</Descriptions.Item>
            <Descriptions.Item label="Phone">{lead.customerPhone}</Descriptions.Item>
            {lead.vertical === 'insurance' ? (
              <>
                <Descriptions.Item label="Vehicle">{lead.vehicleRegNo} · {lead.vehicleType}</Descriptions.Item>
                <Descriptions.Item label="Insurer / policy">{lead.insurer} · {lead.policyType}</Descriptions.Item>
              </>
            ) : (
              <>
                <Descriptions.Item label="Loan">{lead.loanType} · {inr(lead.loanAmount)}</Descriptions.Item>
                <Descriptions.Item label="Lender">{lead.lender}</Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="Raised by">{lead.createdByName}</Descriptions.Item>
            <Descriptions.Item label="Worked by">{lead.claimedByName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Quote">{inr(lead.quoteAmount)}</Descriptions.Item>
            <Descriptions.Item label="Payment"><Tag color={lead.paymentStatus === 'collected' ? 'green' : 'orange'}>{lead.paymentStatus === 'collected' ? `collected ${inr(lead.paidAmount)}` : 'pending'}</Tag></Descriptions.Item>
            {lead.paymentLinkUrl && <Descriptions.Item label="Payment link" span={2}><a href={lead.paymentLinkUrl} target="_blank" rel="noreferrer">{lead.paymentLinkUrl}</a></Descriptions.Item>}
            {lead.policyExpiryDate && <Descriptions.Item label="Policy expires">{lead.policyExpiryDate}</Descriptions.Item>}
            {lead.commissionAmount !== null && <Descriptions.Item label="Commission" span={2}>{inr(lead.commissionAmount)} <Typography.Text type="secondary">({lead.commissionBasis})</Typography.Text></Descriptions.Item>}
          </Descriptions>
          <Card size="small" title="Next step">{actions()}</Card>
          <Card size="small" title="Documents" extra={['New', 'Assigned', 'QuoteShared', 'PaymentPending'].includes(lead.status) && !lead.canWork ? uploadBtn('other', 'Add a document') : null}>
            {lead.documents.length === 0 ? <Typography.Text type="secondary">No documents yet</Typography.Text> : (
              <Table size="small" pagination={false} rowKey="id" dataSource={lead.documents} columns={[
                { title: 'Type', dataIndex: 'kind', render: (k: DocKind) => <Tag>{DOC_LABEL[k]}</Tag> },
                { title: 'File', dataIndex: 'fileName' },
                { title: 'By', dataIndex: 'uploadedByName' },
                { title: 'When', dataIndex: 'createdAt', render: when },
                { title: '', render: (_, d) => <Button size="small" icon={<DownloadOutlined />} onClick={() => open(d.id)}>Open</Button> },
              ]} />
            )}
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>Stored encrypted. Every time someone opens a document it is recorded.</Typography.Text>
          </Card>
          <Tabs size="small" items={[
            { key: 'trail', label: 'Audit trail', children: (
              <Timeline items={lead.events.map((e) => ({ children: <><strong>{e.userName}</strong> {e.action.replace(/_/g, ' ')}{e.toStatus ? ` → ${STAGE_LABEL[e.toStatus as LeadStatus] ?? e.toStatus}` : ''}{e.note ? ` — ${e.note}` : ''}<div style={{ fontSize: 11, color: '#475569' }}>{when(e.createdAt)}</div></> }))} />
            ) },
            { key: 'notif', label: `Notifications (${lead.notifications.length})`, children: (
              <Table size="small" pagination={{ pageSize: 8, hideOnSinglePage: true }} rowKey="id" dataSource={lead.notifications} columns={[
                { title: 'What', dataIndex: 'kind' }, { title: 'To', dataIndex: 'audience' }, { title: 'Channel', dataIndex: 'channel' },
                { title: 'Result', dataIndex: 'status', render: (s: string, r) => <Tooltip title={r.detail}><Tag color={s === 'sent' ? 'green' : s === 'failed' ? 'red' : 'default'}>{s}</Tag></Tooltip> },
                { title: 'When', dataIndex: 'createdAt', render: when },
              ]} />
            ) },
          ]} />
        </Space>
      )}
    </Drawer>
  );
}

// ───────────────────────────── list ─────────────────────────────

function LeadList({ scope, pollMs, canClaim, onOpen, refreshKey, onChanged }: { scope: string; pollMs?: number; canClaim?: boolean; onOpen: (id: string) => void; refreshKey: number; onChanged: () => void }) {
  const [rows, setRows] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [vertical, setVertical] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const r = await leadsApi.list({ scope, vertical, search: search || undefined, page }); setRows(r.data); setTotal(r.total); } catch (e) { message.error(errText(e)); } finally { setLoading(false); }
  }, [scope, vertical, search, page]);
  useEffect(() => { setLoading(true); void load(); }, [load, refreshKey]);
  useEffect(() => { if (!pollMs) return; const t = setInterval(() => void load(), pollMs); return () => clearInterval(t); }, [load, pollMs]);

  const claim = async (l: Lead) => {
    try { await leadsApi.claim(l.id); message.success(`You claimed ${l.ticketNumber}`); onChanged(); onOpen(l.id); } catch (e) { message.error(errText(e)); onChanged(); }
  };
  const columns: ColumnsType<Lead> = [
    { title: 'Ticket', dataIndex: 'ticketNumber', render: (n: string, l) => <a onClick={() => onOpen(l.id)}>{n}</a> },
    { title: 'Type', dataIndex: 'vertical', render: VERTICAL_TAG },
    { title: 'Customer', render: (_, l) => <div>{l.customerName}<div style={{ fontSize: 11, color: '#475569' }}>{l.customerPhone}</div></div> },
    { title: 'Details', render: (_, l) => (l.vertical === 'insurance' ? `${l.vehicleRegNo} · ${l.insurer} · ${l.policyType}` : `${l.loanType} · ${inr(l.loanAmount)} · ${l.lender}`) },
    { title: 'Status', dataIndex: 'status', render: (s: LeadStatus) => <Tag color={STATUS_COLOR[s]}>{STAGE_LABEL[s]}</Tag> },
    { title: 'Deadline', render: (_, l) => <SlaTag l={l} /> },
    { title: scope === 'mine' ? 'Worked by' : 'Raised by', render: (_, l) => (scope === 'mine' ? l.claimedByName ?? '—' : l.createdByName) },
    { title: '', align: 'right', render: (_, l) => (canClaim && l.status === 'New' ? <Button type="primary" size="small" onClick={() => claim(l)}>Claim</Button> : <Button size="small" onClick={() => onOpen(l.id)}>View</Button>) },
  ];
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space wrap>
        <Input.Search allowClear placeholder="Search name, phone, ticket, reg. no." style={{ width: 280 }} onSearch={(v) => { setSearch(v); setPage(1); }} />
        <Select allowClear placeholder="All types" style={{ width: 140 }} value={vertical} onChange={(v) => { setVertical(v); setPage(1); }} options={[{ value: 'insurance', label: 'Insurance' }, { value: 'loan', label: 'Loan' }]} />
        <Button icon={<ReloadOutlined />} onClick={() => void load()} />
        {pollMs ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>updates automatically</Typography.Text> : null}
      </Space>
      <Table<Lead> rowKey="id" size="small" loading={loading} columns={columns} dataSource={rows} scroll={{ x: 'max-content' }} pagination={{ current: page, pageSize: 20, total, onChange: setPage, hideOnSinglePage: true }} />
    </Space>
  );
}

// ───────────────────────────── reports ─────────────────────────────

function Reports({ isSuper }: { isSuper: boolean }) {
  const [from, setFrom] = useState(`${new Date().toISOString().slice(0, 7)}-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [vertical, setVertical] = useState<string | undefined>();
  const [data, setData] = useState<{ conv: Awaited<ReturnType<typeof leadsApi.conversion>>; split: Awaited<ReturnType<typeof leadsApi.split>>; rev: Awaited<ReturnType<typeof leadsApi.revenue>>; sla: Awaited<ReturnType<typeof leadsApi.sla>>; com: Awaited<ReturnType<typeof leadsApi.commissions>> } | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [rule, setRule] = useState<{ vertical: LeadVertical; partner: string; kind: 'percent' | 'flat'; value: number }>({ vertical: 'insurance', partner: '*', kind: 'percent', value: 10 });

  const load = useCallback(async () => {
    const q = { from, to, vertical };
    try {
      const [conv, split, rev, sla, com, r] = await Promise.all([leadsApi.conversion(q), leadsApi.split(q), leadsApi.revenue(q), leadsApi.sla(q), leadsApi.commissions(q), leadsApi.rules()]);
      setData({ conv, split, rev, sla, com }); setRules(r);
    } catch (e) { message.error(errText(e)); }
  }, [from, to, vertical]);
  useEffect(() => { void load(); }, [load]);

  const money = (n: number) => inr(n);
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap>
        <Input type="date" addonBefore="From" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 200 }} />
        <Input type="date" addonBefore="To" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 200 }} />
        <Select allowClear placeholder="Both types" style={{ width: 140 }} value={vertical} onChange={setVertical} options={[{ value: 'insurance', label: 'Insurance' }, { value: 'loan', label: 'Loan' }]} />
        <Button icon={<ReloadOutlined />} onClick={() => void load()} />
      </Space>
      {data && (
        <>
          <Space wrap size="middle">
            <Card size="small"><Typography.Text type="secondary">Collected</Typography.Text><div style={{ fontSize: 22, fontWeight: 600, color: '#389e0d' }}>{money(data.rev.totals.collected)}</div></Card>
            <Card size="small"><Typography.Text type="secondary">Pending collection</Typography.Text><div style={{ fontSize: 22, fontWeight: 600, color: '#d46b08' }}>{money(data.rev.totals.pending)}</div></Card>
            <Card size="small"><Typography.Text type="secondary">Avg. time to resolve</Typography.Text><div style={{ fontSize: 22, fontWeight: 600 }}>{data.sla.avgHoursToResolve} h</div></Card>
            <Card size="small"><Typography.Text type="secondary">SLA breaches</Typography.Text><div style={{ fontSize: 22, fontWeight: 600, color: data.sla.breached ? '#cf1322' : undefined }}>{data.sla.breached}<span style={{ fontSize: 12, color: '#475569' }}> of {data.sla.total} · {data.sla.overdueNow} overdue now · {data.sla.urgentBreached} urgent</span></div></Card>
          </Space>
          <Card size="small" title="Conversion by marketing person">
            <Table size="small" pagination={false} rowKey="userId" dataSource={data.conv} columns={[
              { title: 'Person', dataIndex: 'name' }, { title: 'Leads', dataIndex: 'created', align: 'right' }, { title: 'Issued', dataIndex: 'issued', align: 'right' },
              { title: 'Rejected', dataIndex: 'rejected', align: 'right' }, { title: 'Open', dataIndex: 'open', align: 'right' }, { title: 'Conversion', dataIndex: 'conversionPct', align: 'right', render: (v: number) => `${v}%` }]} />
          </Card>
          <Card size="small" title="Business by insurer / lender">
            <Table size="small" pagination={false} rowKey={(r) => `${r.vertical}-${r.partner}`} dataSource={data.split} columns={[
              { title: 'Type', dataIndex: 'vertical', render: (v: LeadVertical) => VERTICAL_TAG(v) }, { title: 'Insurer / lender', dataIndex: 'partner' },
              { title: 'Leads', dataIndex: 'leads', align: 'right' }, { title: 'Issued', dataIndex: 'issued', align: 'right' }, { title: 'Business', dataIndex: 'amount', align: 'right', render: money }]} />
          </Card>
          <Card size="small" title="Revenue vs pending collection">
            <Table size="small" pagination={false} rowKey="month" dataSource={data.rev.byMonth} columns={[{ title: 'Month', dataIndex: 'month' }, { title: 'Collected', dataIndex: 'collected', align: 'right', render: money }, { title: 'Pending', dataIndex: 'pending', align: 'right', render: money }]} />
            <Table style={{ marginTop: 12 }} size="small" pagination={false} rowKey="userId" dataSource={data.rev.byAgent} columns={[{ title: 'Per marketing person', dataIndex: 'name' }, { title: 'Collected', dataIndex: 'collected', align: 'right', render: money }, { title: 'Pending', dataIndex: 'pending', align: 'right', render: money }]} />
          </Card>
          <Card size="small" title="Commission earned">
            <Table size="small" pagination={false} rowKey={(r) => `${r.userId}-${r.vertical}`} dataSource={data.com} columns={[
              { title: 'Person', dataIndex: 'name' }, { title: 'Type', dataIndex: 'vertical', render: (v: LeadVertical) => VERTICAL_TAG(v) }, { title: 'Leads closed', dataIndex: 'leadsClosed', align: 'right' },
              { title: 'Business', dataIndex: 'business', align: 'right', render: money }, { title: 'Commission', dataIndex: 'commission', align: 'right', render: money }]} />
          </Card>
          <Card size="small" title="Commission rules" extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>"*" is the default for a type. {isSuper ? '' : 'Only the Super Admin can change these.'}</Typography.Text>}>
            <Table size="small" pagination={false} rowKey="id" dataSource={rules} columns={[
              { title: 'Type', dataIndex: 'vertical', render: (v: LeadVertical) => VERTICAL_TAG(v) }, { title: 'Insurer / lender', dataIndex: 'partner' },
              { title: 'Rate', render: (_, r) => (r.kind === 'percent' ? `${r.value}%` : `${inr(r.value)} flat`) },
              { title: '', render: (_, r) => isSuper && <Popconfirm title="Delete this rule?" onConfirm={async () => { try { setRules(await leadsApi.deleteRule(r.id)); } catch (e) { message.error(errText(e)); } }}><Button size="small" danger>Delete</Button></Popconfirm> }]} />
            {isSuper && (
              <Space wrap style={{ marginTop: 12 }}>
                <Select value={rule.vertical} style={{ width: 120 }} onChange={(v) => setRule({ ...rule, vertical: v })} options={[{ value: 'insurance', label: 'Insurance' }, { value: 'loan', label: 'Loan' }]} />
                <Input style={{ width: 170 }} placeholder="Insurer/lender or *" value={rule.partner} onChange={(e) => setRule({ ...rule, partner: e.target.value })} />
                <Select value={rule.kind} style={{ width: 110 }} onChange={(v) => setRule({ ...rule, kind: v })} options={[{ value: 'percent', label: '% of amount' }, { value: 'flat', label: 'Flat ₹' }]} />
                <InputNumber min={0} value={rule.value} onChange={(v) => setRule({ ...rule, value: v ?? 0 })} />
                <Button type="primary" onClick={async () => { try { setRules(await leadsApi.saveRule(rule)); message.success('Rule saved'); } catch (e) { message.error(errText(e)); } }}>Save rule</Button>
              </Space>
            )}
          </Card>
        </>
      )}
    </Space>
  );
}

// ───────────────────────────── page ─────────────────────────────

export default function LeadsPage() {
  const me = useAppSelector((s) => s.auth.user);
  const isAdmin = isAdminRole(me?.role);
  const isSuper = me?.role === 'SuperAdmin';
  const perms = me?.permissions ?? [];
  const verticals: LeadVertical[] = [...(isSuper || perms.includes('insurance') ? (['insurance'] as const) : []), ...(isSuper || perms.includes('loans') ? (['loan'] as const) : [])];
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const common = { onOpen: setOpenId, refreshKey: tick, onChanged: bump };

  const items = [
    { key: 'mine', label: 'My leads', children: <LeadList scope="mine" pollMs={30_000} {...common} /> },
    ...(isAdmin ? [
      { key: 'pool', label: 'Pool', children: <LeadList scope="pool" pollMs={10_000} canClaim {...common} /> },
      { key: 'working', label: 'Working on', children: <LeadList scope="working" {...common} /> },
      { key: 'claimed', label: 'Claimed by others', children: <LeadList scope="claimed" pollMs={20_000} {...common} /> },
      { key: 'all', label: 'All leads', children: <LeadList scope="all" {...common} /> },
      { key: 'reports', label: 'Reports & commission', children: <Reports isSuper={isSuper} /> },
    ] : []),
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Insurance &amp; loan leads</Typography.Title>
          <Typography.Text type="secondary">Submitting a lead creates its ticket. Admin/Ops claim it from the pool and you are told at every stage.</Typography.Text>
        </div>
        {verticals.length > 0 && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>New lead</Button>}
      </div>
      <Tabs items={items} destroyInactiveTabPane />
      <NewLeadModal open={creating} verticals={verticals} onClose={() => setCreating(false)} onCreated={() => bump()} />
      <LeadDrawer id={openId} onClose={() => setOpenId(null)} onChanged={bump} />
    </div>
  );
}
