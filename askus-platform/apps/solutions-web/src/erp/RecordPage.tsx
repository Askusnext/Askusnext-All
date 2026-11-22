import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { downloadCsv, fmtDate, inr, useCollection, type Row } from './store';
import { PageHeader, StatGrid, type Stat } from './ui';
import { isAdminRole } from '../access';
import { useAppSelector } from '../store';

export type FieldType = 'text' | 'number' | 'money' | 'percent' | 'date' | 'time' | 'select' | 'textarea';
export type OptionSource = string[] | { from: string; field?: string; filter?: (row: Row) => boolean };

export interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: OptionSource;
  hideInTable?: boolean;
  hideInForm?: boolean;
  render?: (value: any, row: Row) => ReactNode;
  default?: unknown | (() => unknown);
  width?: number;
}

export interface ApprovalDef {
  field?: string;
  pending: string;
  approved: string;
  rejected: string;
  /** Override what "Approve" writes, e.g. move to the next approval stage. */
  onApprove?: (row: Row) => Partial<Row>;
  approveLabel?: (row: Row) => string;
  /** Allow non-admin staff to approve (default: only Admin / Super Admin). */
  anyoneCanApprove?: boolean;
  /** Extra side effect after a decision (e.g. post to a ledger). */
  after?: (row: Row, decision: 'approved' | 'rejected') => void;
}

export interface RecordPageConfig {
  collection: string;
  title: string;
  eyebrow?: string;
  crumbs?: string;
  subtitle?: ReactNode;
  fields: FieldDef[];
  statusField?: string;
  statusColors?: Record<string, string>;
  statusTabs?: string[];
  dateField?: string;
  stats?: (rows: Row[]) => Stat[];
  approval?: ApprovalDef;
  rowFilter?: (row: Row, all: Row[]) => boolean;
  addLabel?: string;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  rowActions?: (row: Row, api: ReturnType<typeof useCollection>) => ReactNode;
  headerExtra?: ReactNode;
  sortBy?: string;
  beforeTable?: (rows: Row[]) => ReactNode;
  onSaved?: (row: Row, isNew: boolean) => void;
  validate?: (values: Row, all: Row[], editing: Row | null) => string | null;
  emptyText?: string;
}

const DEFAULT_COLORS: Record<string, string> = {
  Pending: 'gold', Approved: 'green', Rejected: 'red', Open: 'blue', 'In Progress': 'orange', Done: 'green', Completed: 'green',
  New: 'blue', Interested: 'red', Quoted: 'orange', 'On Hold': 'cyan', Won: 'green', Lost: 'default', Active: 'green', Resigned: 'default',
  Draft: 'default', Sent: 'blue', Accepted: 'green', Paid: 'green', Unpaid: 'gold', Overdue: 'red', 'Partially Paid': 'blue',
  Present: 'green', Absent: 'red', 'Half Day': 'orange', 'On Leave': 'blue', Holiday: 'purple', Due: 'gold', Contacted: 'blue',
  'Quote Sent': 'cyan', Renewed: 'green', Scheduled: 'blue', Selected: 'green', Published: 'green', 'Checked In': 'blue', 'Checked Out': 'green',
  Receivable: 'gold', Received: 'green', Issued: 'green', Proposed: 'blue', 'To Do': 'default', Allocated: 'blue', Yes: 'green', No: 'default',
};

export const statusTag = (value: string, colors?: Record<string, string>) =>
  value ? <Tag color={colors?.[value] ?? DEFAULT_COLORS[value] ?? 'default'}>{value}</Tag> : <span className="erp-muted">—</span>;

function OptionSelect({ source, ...rest }: { source: OptionSource; [k: string]: any }) {
  const ref = Array.isArray(source) ? null : source;
  const { rows } = useCollection(ref?.from ?? '__none__');
  const options = Array.isArray(source)
    ? source
    : [...new Set(rows.filter(ref!.filter ?? (() => true)).map((r) => String(r[ref!.field ?? 'name'] ?? '')).filter(Boolean))];
  return <Select showSearch allowClear optionFilterProp="label" options={options.map((o) => ({ value: o, label: o }))} {...rest} />;
}

const defaultOf = (f: FieldDef) => (typeof f.default === 'function' ? (f.default as () => unknown)() : f.default);

export function formatValue(f: FieldDef, value: any) {
  if (f.type === 'money') return inr(value);
  if (f.type === 'percent') return value === '' || value == null ? '—' : `${value}%`;
  if (f.type === 'date') return fmtDate(value);
  if (value === '' || value == null) return <span className="erp-muted">—</span>;
  return String(value);
}

export default function RecordPage(cfg: RecordPageConfig) {
  const api = useCollection(cfg.collection);
  const role = useAppSelector((state) => state.auth.user?.role);
  const canDecide = Boolean(cfg.approval && (cfg.approval.anyoneCanApprove || isAdminRole(role)));
  const { rows } = api;
  const statusField = cfg.statusField ?? (cfg.approval ? cfg.approval.field ?? 'status' : undefined);
  const [params] = useSearchParams();
  const [tab, setTab] = useState<string>(() => params.get('status') || 'All');
  useEffect(() => { setTab(params.get('status') || 'All'); }, [params]);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<Record<string, unknown>>({});
  const [form] = Form.useForm();

  const scoped = useMemo(() => (cfg.rowFilter ? rows.filter((r) => cfg.rowFilter!(r, rows)) : rows), [rows, cfg]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = scoped.filter((r) => {
      if (tab !== 'All' && statusField && r[statusField] !== tab) return false;
      if (q && !cfg.fields.some((f) => String(r[f.name] ?? '').toLowerCase().includes(q))) return false;
      if (cfg.dateField && range?.[0] && range?.[1]) {
        const v = r[cfg.dateField];
        if (!v || v < range[0].format('YYYY-MM-DD') || v > range[1].format('YYYY-MM-DD')) return false;
      }
      return true;
    });
    const sortKey = cfg.sortBy ?? cfg.dateField;
    if (sortKey) list = [...list].sort((a, b) => String(b[sortKey] ?? '').localeCompare(String(a[sortKey] ?? '')));
    return list;
  }, [scoped, tab, search, range, cfg, statusField]);

  const tabs = cfg.statusTabs ?? (cfg.approval ? [cfg.approval.pending, cfg.approval.approved, cfg.approval.rejected] : null);

  const openForm = (row: Row | null) => {
    setEditing(row);
    const init: Record<string, unknown> = {};
    cfg.fields.forEach((f) => {
      const v = row ? row[f.name] : defaultOf(f);
      init[f.name] = f.type === 'date' ? (v ? dayjs(String(v)) : null) : v;
    });
    // The form mounts with the modal (destroyOnClose), so seed it through initialValues.
    setInitial(init);
    setOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const clean: Row = { id: editing?.id ?? '' };
    cfg.fields.forEach((f) => {
      if (f.hideInForm) return;
      const v = values[f.name];
      clean[f.name] = f.type === 'date' ? (v ? (v as Dayjs).format('YYYY-MM-DD') : '') : (v ?? '');
    });
    const problem = cfg.validate?.(clean, rows, editing);
    if (problem) { message.error(problem); return; }
    if (editing) {
      api.update(editing.id, clean);
      cfg.onSaved?.({ ...editing, ...clean }, false);
      message.success('Saved');
    } else {
      const extras: Row = { id: '' };
      cfg.fields.filter((f) => f.hideInForm && f.default !== undefined).forEach((f) => { extras[f.name] = defaultOf(f); });
      const { id: _drop, ...rest } = { ...extras, ...clean };
      const created = api.add(rest);
      cfg.onSaved?.(created, true);
      message.success(`${cfg.addLabel?.replace(/^(Add|New|Create|Send|Apply|Mark)\s+/i, '') ?? 'Record'} created`);
    }
    setOpen(false);
  };

  const decide = (row: Row, decision: 'approved' | 'rejected') => {
    const a = cfg.approval!;
    const field = a.field ?? 'status';
    const patch = decision === 'approved' ? (a.onApprove?.(row) ?? { [field]: a.approved }) : { [field]: a.rejected };
    api.update(row.id, { ...patch, decidedOn: new Date().toISOString() });
    a.after?.({ ...row, ...patch }, decision);
    message.success(decision === 'approved' ? 'Approved' : 'Rejected');
  };

  const columns: ColumnsType<Row> = cfg.fields.filter((f) => !f.hideInTable).map((f) => ({
    key: f.name,
    title: f.label,
    dataIndex: f.name,
    width: f.width,
    sorter: f.type === 'number' || f.type === 'money'
      ? (a: Row, b: Row) => (Number(a[f.name]) || 0) - (Number(b[f.name]) || 0)
      : (a: Row, b: Row) => String(a[f.name] ?? '').localeCompare(String(b[f.name] ?? '')),
    align: f.type === 'money' || f.type === 'number' ? 'right' : undefined,
    render: (v: any, r: Row) => (f.render ? f.render(v, r) : f.name === statusField ? statusTag(v, cfg.statusColors) : formatValue(f, v)),
  }));

  const showActions = cfg.approval || cfg.canEdit !== false || cfg.canDelete !== false || cfg.rowActions;
  if (showActions) {
    columns.push({
      key: '__actions',
      title: 'Actions',
      fixed: 'right',
      render: (_: unknown, r: Row) => (
        <Space size={4} wrap>
          {cfg.rowActions?.(r, api)}
          {canDecide && r[cfg.approval!.field ?? 'status'] === cfg.approval!.pending && (
            <>
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => decide(r, 'approved')}>
                {cfg.approval!.approveLabel?.(r) ?? 'Approve'}
              </Button>
              <Button size="small" danger icon={<CloseOutlined />} onClick={() => decide(r, 'rejected')}>Reject</Button>
            </>
          )}
          {cfg.canEdit !== false && <Button size="small" icon={<EditOutlined />} aria-label={`Edit ${r[cfg.fields[0].name] ?? 'record'}`} onClick={() => openForm(r)} />}
          {cfg.canDelete !== false && (
            <Popconfirm title="Delete this record?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => { api.remove(r.id); message.success('Deleted'); }}>
              <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Delete ${r[cfg.fields[0].name] ?? 'record'}`} />
            </Popconfirm>
          )}
        </Space>
      ),
    });
  }

  const exportCsv = () => {
    const fields = cfg.fields.filter((f) => !f.hideInTable);
    downloadCsv(`${cfg.collection}.csv`, fields.map((f) => f.label), filtered.map((r) => fields.map((f) => (r[f.name] ?? '') as string)));
  };

  const formFields = cfg.fields.filter((f) => !f.hideInForm);

  return (
    <div className="erp-page">
      <PageHeader
        eyebrow={cfg.eyebrow}
        title={cfg.title}
        crumbs={cfg.crumbs}
        subtitle={cfg.subtitle}
        actions={
          <>
            {cfg.headerExtra}
            <Button className="erp-ghost" icon={<DownloadOutlined />} onClick={exportCsv}>Export</Button>
            {cfg.canAdd !== false && <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>{cfg.addLabel ?? 'Add'}</Button>}
          </>
        }
      />

      {cfg.stats && <StatGrid stats={cfg.stats(scoped)} />}
      {cfg.beforeTable?.(scoped)}

      <section className="erp-panel">
        <div className="erp-toolbar">
          {tabs && statusField && (
            <div className="erp-tabs" role="tablist" aria-label="Filter by status">
              {['All', ...tabs].map((t) => {
                const count = t === 'All' ? scoped.length : scoped.filter((r) => r[statusField] === t).length;
                return (
                  <button key={t} role="tab" type="button" aria-selected={tab === t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>
                    {t} <span>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="erp-filters">
            <Input allowClear prefix={<SearchOutlined aria-hidden />} placeholder="Search…" aria-label={`Search ${cfg.title}`} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} />
            {cfg.dateField && <DatePicker.RangePicker value={range as any} onChange={(v) => setRange(v as any)} aria-label="Date range" />}
          </div>
        </div>
        <Table<Row>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={filtered}
          loading={api.loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `${t} record(s)` }}
          locale={{ emptyText: cfg.emptyText ?? 'No records match your filters.' }}
        />
      </section>

      <Modal
        open={open}
        title={editing ? `Edit ${cfg.title.replace(/s$/, '')}` : cfg.addLabel ?? 'Add'}
        okText={editing ? 'Save changes' : 'Create'}
        onOk={save}
        onCancel={() => setOpen(false)}
        width={formFields.length > 6 ? 760 : 520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className={formFields.length > 6 ? 'erp-form-grid' : undefined} preserve={false} initialValues={initial}>
          {formFields.map((f) => (
            <Form.Item
              key={f.name}
              name={f.name}
              label={f.label}
              rules={f.required ? [{ required: true, message: `${f.label} is required` }] : undefined}
              className={f.type === 'textarea' ? 'erp-span-2' : undefined}
            >
              {f.type === 'select' && f.options ? <OptionSelect source={f.options} placeholder={`Select ${f.label.toLowerCase()}`} />
                : f.type === 'date' ? <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                : f.type === 'number' || f.type === 'money' || f.type === 'percent'
                  ? <InputNumber style={{ width: '100%' }} min={0} prefix={f.type === 'money' ? '₹' : undefined} suffix={f.type === 'percent' ? '%' : undefined} />
                : f.type === 'textarea' ? <Input.TextArea rows={3} />
                : f.type === 'time' ? <Input type="time" />
                : <Input />}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
}
