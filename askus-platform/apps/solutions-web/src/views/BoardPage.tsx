import React, { useMemo, useState } from 'react';
import { Button, Select, Spin, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTickets } from '../hooks';
import { api } from '../api/mockApi';
import { PriorityTag } from '../components/shared';
import type { TicketStatus, TicketType } from '../types';

const COLS: { key: TicketStatus; label: string; dot: string }[] = [
  { key: 'Open',             label: 'Open',              dot: '#1677ff' },
  { key: 'InProgress',       label: 'In progress',       dot: '#d46b08' },
  { key: 'AwaitingResponse', label: 'Awaiting response', dot: '#d4b106' },
  { key: 'Resolved',         label: 'Resolved',          dot: '#389e0d' },
  { key: 'Closed',           label: 'Closed',            dot: '#888'    },
  { key: 'Reopened',         label: 'Reopened',          dot: '#cf4a1b' },
];

const CATEGORIES: { value: TicketType; label: string }[] = [
  { value: 'Insurance', label: 'Insurance' }, { value: 'O2Taxi', label: 'O2 Taxi' }, { value: 'General', label: 'General' },
  { value: 'DailyActivity', label: 'Daily activity' }, { value: 'Support', label: 'Support' },
];

export default function BoardPage() {
  const [agentFilter, setAgentFilter] = useState('');
  const [category, setCategory] = useState<TicketType | ''>('');
  const { data, loading, refetch } = useTickets({ pageSize: 100, ...(category ? { ticketType: category } : {}) });
  const navigate = useNavigate();
  // A card dropped on another column shows there straight away; if the server refuses, it snaps back.
  const [moved, setMoved] = useState<Record<string, TicketStatus>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TicketStatus | null>(null);

  const tickets = useMemo(() => (data?.data ?? []).map(t => ({ ...t, status: moved[t.id] ?? t.status })), [data, moved]);
  const agents = useMemo(() => [...new Set((data?.data ?? []).map(t => t.assignedToName).filter((n): n is string => !!n))], [data]);
  const byStatus = (s: TicketStatus) => tickets.filter(t => t.status === s && (!agentFilter || t.assignedToName === agentFilter));
  const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

  const drop = async (status: TicketStatus) => {
    const id = dragging;
    setDragging(null); setOverCol(null);
    const t = tickets.find(x => x.id === id);
    if (!id || !t || t.status === status) return;
    setMoved(m => ({ ...m, [id]: status }));
    try {
      await api.updateTicketStatus(id, status);
      message.success(`${t.ticketNumber} moved to ${COLS.find(c => c.key === status)?.label}`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Could not move the ticket');
    } finally {
      await refetch();
      setMoved(m => { const { [id]: _drop, ...rest } = m; return rest; });
    }
  };

  return (
    <div className="board">
      <div className="board-head">
        <div>
          <span className="erp-eyebrow">Team</span>
          <h1>Ticket board</h1>
          <p>{data?.total ?? 0} tickets · drag a card into another column to change its status</p>
        </div>
        <div className="board-tools">
          <Select placeholder="All categories" allowClear style={{ width:170 }} value={category || undefined}
            onChange={(v) => setCategory(v ?? '')} options={CATEGORIES} aria-label="Filter by category" />
          <Select placeholder="All agents" allowClear style={{ width:170 }} onChange={(v) => setAgentFilter(v ?? '')}
            options={agents.map(a => ({ value:a, label:a }))} aria-label="Filter by agent" />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tickets/new')}>New ticket</Button>
        </div>
      </div>

      {loading && !data ? <Spin size="large" style={{ display:'block', margin:'80px auto' }} /> : (
        <div className="board-scroll">
          <div className="board-cols" style={{ gridTemplateColumns:`repeat(${COLS.length}, minmax(230px, 1fr))`, minWidth: COLS.length * 242 }}>
            {COLS.map(col => {
              const list = byStatus(col.key);
              return (
                <div key={col.key}
                  className={`board-col${overCol === col.key ? ' is-over' : ''}`}
                  style={{ ['--col' as string]: col.dot }}
                  onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
                  onDragLeave={() => setOverCol(c => (c === col.key ? null : c))}
                  onDrop={(e) => { e.preventDefault(); void drop(col.key); }}>
                  <div className="board-col-head">
                    <span><i aria-hidden />{col.label}</span>
                    <b>{list.length}</b>
                  </div>
                  <div className="board-col-body">
                    {list.length === 0 && <div className="board-empty">Drop a ticket here</div>}
                    {list.map(t => {
                      const days = t.policy?.expiryDate ? daysLeft(t.policy.expiryDate) : Infinity;
                      return (
                        <div key={t.id} role="button" tabIndex={0} draggable
                          className={`board-card prio-${String(t.priority).toLowerCase()}${dragging === t.id ? ' is-dragging' : ''}`}
                          onDragStart={(e) => { setDragging(t.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); }}
                          onDragEnd={() => { setDragging(null); setOverCol(null); }}
                          onClick={() => navigate(`/tickets/${t.id}`)}
                          onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/tickets/${t.id}`); }}>
                          <div className="board-card-meta"><span>{t.ticketNumber}</span><span>{t.ticketType}</span></div>
                          <div className="board-card-title">{t.title}</div>
                          <div className="board-card-sub">{[t.vehicleRegNo, t.customerName].filter(Boolean).join(' · ')}</div>
                          {days <= 30 && (
                            <div className={`board-card-expiry${days < 0 ? ' is-bad' : ''}`}>
                              {days < 0 ? `Expired ${Math.abs(days)}d ago` : `Expires in ${days}d`}
                            </div>
                          )}
                          <div className="board-card-foot">
                            <PriorityTag priority={t.priority} />
                            {t.assignedToName && <span className="board-avatar" title={t.assignedToName}>{t.assignedToName.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()}</span>}
                          </div>
                        </div>
                      );
                    })}
                    <button type="button" className="board-add" onClick={() => navigate('/tickets/new')}><PlusOutlined aria-hidden /> Add ticket</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
