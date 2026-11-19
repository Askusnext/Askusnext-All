import React, { useMemo, useState } from 'react';
import { Card, Tag, Button, Select, Spin, message } from 'antd';
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
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <div>
          <h2 style={{ margin:0 }}>Ticket board</h2>
          <p style={{ margin:0, color:'#475569', fontSize:13 }}>{data?.total ?? 0} tickets · drag a card to another column to change its status</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <Select placeholder="All categories" allowClear style={{ width:160 }} value={category || undefined}
            onChange={(v) => setCategory(v ?? '')} options={CATEGORIES} />
          <Select placeholder="All agents" allowClear style={{ width:160 }} onChange={(v) => setAgentFilter(v ?? '')}
            options={agents.map(a => ({ value:a, label:a }))} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tickets/new')}
            style={{ background:'#e8efff', borderColor:'#1e40af' }}>New ticket</Button>
        </div>
      </div>

      {loading && !data ? <Spin size="large" style={{ display:'block', margin:'80px auto' }} /> : (
        <div style={{ overflowX:'auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${COLS.length}, minmax(210px, 1fr))`, gap:12, minWidth: COLS.length * 222 }}>
            {COLS.map(col => (
              <div key={col.key}
                onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
                onDragLeave={() => setOverCol(c => (c === col.key ? null : c))}
                onDrop={(e) => { e.preventDefault(); void drop(col.key); }}
                style={{ background: overCol === col.key ? '#e6f4ff' : '#f5f5f5', borderRadius:10, padding:10, minHeight:420, outline: overCol === col.key ? '2px dashed #1677ff' : 'none' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <span style={{ fontWeight:600, fontSize:12, display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:col.dot, display:'inline-block' }} />
                    {col.label}
                  </span>
                  <Tag style={{ fontSize:10, margin:0 }}>{byStatus(col.key).length}</Tag>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {byStatus(col.key).map(t => {
                    const days = t.policy?.expiryDate ? daysLeft(t.policy.expiryDate) : Infinity;
                    return (
                      <Card key={t.id} size="small" draggable
                        onDragStart={(e) => { setDragging(t.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); }}
                        onDragEnd={() => { setDragging(null); setOverCol(null); }}
                        style={{ borderRadius:8, cursor:'grab', border:'1px solid #f0f0f0', opacity: dragging === t.id ? 0.4 : 1 }}
                        styles={{ body:{ padding:'10px 12px' } }} onClick={() => navigate(`/tickets/${t.id}`)}>
                        <div style={{ fontSize:10, color:'#475569', marginBottom:2 }}>{t.ticketNumber} · {t.ticketType}</div>
                        <div style={{ fontWeight:500, fontSize:12, marginBottom:4, lineHeight:1.4 }}>{t.title}</div>
                        <div style={{ fontSize:11, color:'#475569', marginBottom:5 }}>{t.vehicleRegNo} · {t.customerName}</div>
                        {days <= 30 && (
                          <div style={{ fontSize:10, color: days < 0 ? '#cf1322' : '#d46b08', marginBottom:5 }}>
                            {days < 0 ? `Expired ${Math.abs(days)}d ago` : `Expiry in ${days}d`}
                          </div>
                        )}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <PriorityTag priority={t.priority} />
                          <span style={{ fontSize:10, color:'#475569' }}>{t.assignedToName}</span>
                        </div>
                      </Card>
                    );
                  })}
                  <Button type="dashed" size="small" block icon={<PlusOutlined />}
                    onClick={() => navigate('/tickets/new')} style={{ fontSize:11, color:'#475569' }}>
                    Add ticket
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
