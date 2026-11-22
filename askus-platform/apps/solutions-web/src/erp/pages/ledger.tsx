import { useMemo, useState } from 'react';
import { Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Table, message } from 'antd';
import { DeleteOutlined, DownloadOutlined, PlusOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { downloadCsv, fmtDate, inr, useCollection, type Row } from '../store';
import { PageHeader, StatGrid } from '../ui';

export interface LedgerEntry { id: string; date: string; category: string; voucher: string; party: string; narration: string; debit: number; credit: number; ledger: string; editable?: boolean }

/**
 * Running-balance ledger (DR = money out, CR = money in), filtered by date range and ledger.
 * `entries` may combine several collections; only rows from `collection` can be added or deleted here.
 */
export function LedgerView({ title, eyebrow, subtitle, entries, ledgers, collection, categories, defaultRange = 'month' }: {
  title: string; eyebrow: string; subtitle: string; entries: LedgerEntry[]; ledgers: string[]; collection?: string; categories?: string[]; defaultRange?: 'month' | 'all';
}) {
  const api = useCollection(collection ?? '__none__');
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => defaultRange === 'all' ? [dayjs().subtract(1, 'year'), dayjs()] : [dayjs().startOf('month'), dayjs()]);
  const [ledger, setLedger] = useState('All');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const { opening, lines, debit, credit } = useMemo(() => {
    const from = range[0].format('YYYY-MM-DD');
    const to = range[1].format('YYYY-MM-DD');
    const scoped = entries.filter((e) => ledger === 'All' || e.ledger === ledger).sort((a, b) => a.date.localeCompare(b.date));
    const before = scoped.filter((e) => e.date < from);
    const opening = before.reduce((s, e) => s + Number(e.credit || 0) - Number(e.debit || 0), 0);
    let bal = opening;
    const lines = scoped.filter((e) => e.date >= from && e.date <= to).map((e) => {
      bal += Number(e.credit || 0) - Number(e.debit || 0);
      return { ...e, balance: bal };
    });
    return { opening, lines, debit: lines.reduce((s, e) => s + Number(e.debit || 0), 0), credit: lines.reduce((s, e) => s + Number(e.credit || 0), 0) };
  }, [entries, range, ledger]);

  const closing = opening + credit - debit;

  const save = async () => {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    const amount = Number(v.amount) || 0;
    api.add({
      date: (v.date as Dayjs).format('YYYY-MM-DD'), category: v.category, voucher: v.voucher ?? '', party: v.party ?? '', narration: v.narration ?? '',
      debit: v.kind === 'DR' ? amount : 0, credit: v.kind === 'CR' ? amount : 0, ledger: v.ledger,
    });
    message.success('Transaction added');
    setOpen(false);
  };

  const exportCsv = () => downloadCsv(
    `${title.toLowerCase().replace(/\W+/g, '-')}.csv`,
    ['Date', 'Ledger', 'Category', 'Voucher', 'Party', 'Narration', 'Debit', 'Credit', 'Balance'],
    [['', '', '', '', '', 'Opening balance B/F', '', '', opening], ...lines.map((l) => [l.date, l.ledger, l.category, l.voucher, l.party, l.narration, l.debit, l.credit, l.balance])],
  );

  return (
    <div className="erp-page">
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} actions={<>
        {collection && <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Add Transaction</Button>}
        <Button className="erp-ghost" icon={<DownloadOutlined />} onClick={exportCsv}>Excel (CSV) Export</Button>
        <Button className="erp-ghost" icon={<PrinterOutlined />} onClick={() => window.print()}>Print / PDF</Button>
      </>} />
      <section className="erp-panel">
        <div className="erp-toolbar">
          <div className="erp-filters">
            <DatePicker.RangePicker allowClear={false} value={range as any} onChange={(v: any) => v?.[0] && v?.[1] && setRange([v[0], v[1]])} format="DD/MM/YYYY" aria-label="Ledger period" />
            <Select value={ledger} onChange={setLedger} style={{ width: 220 }} aria-label="Ledger category" options={[{ value: 'All', label: 'All Ledgers (Combined)' }, ...ledgers.map((l) => ({ value: l, label: l }))]} />
          </div>
        </div>
        <div className="erp-panel-body">
          <StatGrid stats={[
            { label: 'Opening balance', value: inr(opening), hint: 'Balance prior to start date', tone: 'blue' },
            { label: 'Total debit (DR)', value: inr(debit), hint: 'Expenses / cash out', tone: 'red' },
            { label: 'Total credit (CR)', value: inr(credit), hint: 'Cash in hand & deposits', tone: 'green' },
            { label: 'Closing balance', value: inr(closing), hint: 'OB + CR − DR', tone: 'amber' },
          ]} />
        </div>
        <Table<Row>
          rowKey="id" size="middle" pagination={false} scroll={{ x: 'max-content' }}
          dataSource={[{ id: '__ob', date: range[0].format('YYYY-MM-DD'), narration: 'OPENING BALANCE B/F', balance: opening, isOpening: true } as Row, ...lines]}
          columns={[
            { title: 'Date', dataIndex: 'date', render: fmtDate },
            { title: 'Ledger', dataIndex: 'ledger', render: (v) => v ?? '—' },
            { title: 'Category', dataIndex: 'category', render: (v) => v ?? '—' },
            { title: 'Voucher / Ref', dataIndex: 'voucher', render: (v) => v || '—' },
            { title: 'Name (person / vendor)', dataIndex: 'party', render: (v) => v || '—' },
            { title: 'Particulars / narration', dataIndex: 'narration', render: (v, r) => (r.isOpening ? <strong style={{ color: '#0b4fd6' }}>{v}</strong> : v) },
            { title: 'Debit (DR)', dataIndex: 'debit', align: 'right', render: (v, r) => (r.isOpening || !Number(v) ? '—' : <span style={{ color: '#dc2626' }}>{inr(v)}</span>) },
            { title: 'Credit (CR)', dataIndex: 'credit', align: 'right', render: (v, r) => (r.isOpening || !Number(v) ? '—' : <span style={{ color: '#16a34a' }}>{inr(v)}</span>) },
            { title: 'Balance', dataIndex: 'balance', align: 'right', render: (v) => <strong>{inr(v)}</strong> },
            ...(collection ? [{
              title: 'Actions', key: 'a', render: (_: unknown, r: Row) => (r.isOpening || r.editable === false ? '—' : (
                <Popconfirm title="Delete this transaction?" okButtonProps={{ danger: true }} onConfirm={() => api.remove(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} aria-label="Delete transaction" />
                </Popconfirm>
              )),
            }] : []),
          ]}
          summary={() => (
            <Table.Summary.Row className="erp-ledger-total">
              <Table.Summary.Cell index={0} colSpan={6}>Totals for period</Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right">{inr(debit)}</Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="right">{inr(credit)}</Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="right">{inr(closing)}</Table.Summary.Cell>
              {collection && <Table.Summary.Cell index={9} />}
            </Table.Summary.Row>
          )}
        />
      </section>

      <Modal open={open} title="Add transaction" okText="Add" onOk={save} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" preserve={false} initialValues={{ date: dayjs(), kind: 'DR', ledger: ledgers[0] }}>
          <div className="erp-form-grid">
            <Form.Item name="date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD MMM YYYY" /></Form.Item>
            <Form.Item name="ledger" label="Ledger" rules={[{ required: true }]}><Select options={ledgers.map((l) => ({ value: l, label: l }))} /></Form.Item>
            <Form.Item name="kind" label="Type" rules={[{ required: true }]}><Select options={[{ value: 'DR', label: 'Debit – cash out / expense' }, { value: 'CR', label: 'Credit – cash in / top-up' }]} /></Form.Item>
            <Form.Item name="amount" label="Amount" rules={[{ required: true }]}><InputNumber min={1} prefix="₹" style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="category" label="Category" rules={[{ required: true }]}><Select showSearch options={(categories ?? []).map((c) => ({ value: c, label: c }))} /></Form.Item>
            <Form.Item name="voucher" label="Voucher / ref"><Input /></Form.Item>
            <Form.Item name="party" label="Name (person / vendor)" className="erp-span-2"><Input /></Form.Item>
            <Form.Item name="narration" label="Particulars / narration" className="erp-span-2"><Input.TextArea rows={2} /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
