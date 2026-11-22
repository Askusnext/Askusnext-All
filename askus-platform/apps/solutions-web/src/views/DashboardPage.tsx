import React, { useState } from 'react';
import { Card, Row, Col, Table, Button, Alert, Skeleton, Tag, Tooltip } from 'antd';
import {
  ArrowUpOutlined,
  WarningOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  PhoneOutlined,
  CarOutlined,
  CalendarOutlined,
  UserOutlined,
  SafetyOutlined,
  CustomerServiceOutlined,
  InboxOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useKPIs, useExpiryAlerts, useMonthlyData } from '../hooks';
import { ExpiryTag, StatusBadge, PriorityTag, AvatarInitials } from '../components/shared';
import CountersPanel from '../components/CountersPanel';
import type { Ticket } from '../types';

const INK = '#1f1f1d';
const FAINT = '#8a8984';
const CARD = { borderRadius: 12 };
const BAR_COLORS = ['linear-gradient(180deg, #fb923c, #f97316)', 'linear-gradient(180deg, #818cf8, #6366f1)', 'linear-gradient(180deg, #34d399, #059669)', 'linear-gradient(180deg, #f472b6, #db2777)', 'linear-gradient(180deg, #fbbf24, #d97706)'];

function KpiCard({ label, value, tone, icon, delta, up, loading, to }: {
  label: string; value?: number; tone: string; icon: React.ReactNode; delta: string; up?: boolean; loading?: boolean; to?: string;
}) {
  const navigate = useNavigate();
  const open = () => { if (to) navigate(to); };
  return (
    <div
      className={`dash-kpi dash-kpi--${tone}${to ? ' is-link' : ''}`}
      role={to ? 'link' : undefined}
      tabIndex={to ? 0 : undefined}
      aria-label={to ? `${label}: ${value ?? 0}. Open` : undefined}
      onClick={open}
      onKeyDown={(e) => { if (to && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } }}
    >
      <span className="dash-kpi-icon" aria-hidden>{icon}</span>
      {loading ? <Skeleton active paragraph={false} title={{ width: '60%' }} /> : (
        <>
          <div className="dash-kpi-value">{value ?? 0}</div>
          <div className="dash-kpi-label">{label}</div>
          <div className="dash-kpi-sub">{up && <ArrowUpOutlined style={{ marginRight: 3 }} />}{delta}</div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: kpis, loading: kloading } = useKPIs();
  const { data: alerts } = useExpiryAlerts(60);
  const { data: monthly } = useMonthlyData();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  const maxTickets = Math.max(...(monthly?.map(m => m.tickets) ?? [1]));

  // ── List view columns ──
  const expiryColumns = [
    {
      title: 'Reg. No.',
      dataIndex: 'vehicleRegNo',
      render: (v: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CarOutlined style={{ color: '#1e40af', fontSize: 13 }} />
          <strong style={{ fontSize: 12 }}>{v}</strong>
        </div>
      ),
    },
    {
      title: 'Vehicle',
      dataIndex: 'vehicleName',
      render: (v: string, r: Ticket) => (
        <div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#475569' }}>{(r as any).vehicleType ?? '—'}</div>
        </div>
      ),
    },
    {
      title: 'Owner',
      dataIndex: 'customerName',
      render: (v: string, r: Ticket) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <UserOutlined style={{ fontSize: 11, color: '#475569' }} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <PhoneOutlined style={{ fontSize: 11, color: '#475569' }} />
            <span style={{ fontSize: 11, color: '#666' }}>{(r as any).customerPhone ?? '—'}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Insurer',
      dataIndex: ['policy', 'insurer'],
      render: (v: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <SafetyOutlined style={{ fontSize: 11, color: '#1e40af' }} />
          <span style={{ fontSize: 12 }}>{v}</span>
        </div>
      ),
    },
    {
      title: 'Expiry',
      dataIndex: ['policy', 'expiryDate'],
      render: (d: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <CalendarOutlined style={{ fontSize: 11, color: '#d46b08' }} />
          <ExpiryTag date={d} />
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v: string) => <StatusBadge status={v as import('../types').TicketStatus} />,
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, r: Ticket) => (
        <Button size="small" type="primary"
          style={{ fontSize: 11 }}
          onClick={() => navigate(`/tickets/${r.id}`)}>
          View
        </Button>
      ),
    },
  ];

  // ── Card view ──
  const CardView = ({ tickets }: { tickets: Ticket[] }) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 14,
      padding: '4px 0',
    }}>
      {(tickets ?? []).map((r: any) => (
        <div
          key={r.id}
          onClick={() => navigate(`/tickets/${r.id}`)}
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #ecebe6',
            padding: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#fafaf8')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: '#f3f2ee', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CarOutlined style={{ color: '#1e40af', fontSize: 16 }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{r.vehicleRegNo}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>{r.vehicleType ?? 'Vehicle'}</div>
              </div>
            </div>
            <StatusBadge status={r.status} />
          </div>

          {/* Vehicle name */}
          <div style={{ fontSize: 13, fontWeight: 600, color: '#222', marginBottom: 10 }}>
            {r.vehicleName}
          </div>

          {/* Details grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserOutlined style={{ fontSize: 12, color: '#475569', width: 14 }} />
              <span style={{ fontSize: 12, color: '#444' }}>{r.customerName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <PhoneOutlined style={{ fontSize: 12, color: '#475569', width: 14 }} />
              <span style={{ fontSize: 12, color: '#444' }}>{r.customerPhone ?? '—'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SafetyOutlined style={{ fontSize: 12, color: '#1e40af', width: 14 }} />
              <span style={{ fontSize: 12, color: '#444' }}>{r.policy?.insurer ?? '—'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarOutlined style={{ fontSize: 12, color: '#d46b08', width: 14 }} />
              <ExpiryTag date={r.policy?.expiryDate} />
            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: '1px solid #ecebe6',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <PriorityTag priority={r.priority} />
            <Button size="small" type="primary"
              style={{ fontSize: 11 }}
              onClick={e => { e.stopPropagation(); navigate(`/tickets/${r.id}`); }}>
              View →
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="dash">
      {/* Header */}
      <CountersPanel />
      {/* KPI cards */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        {[
          { label: 'Insurance tickets', value: kpis?.insuranceTickets, tone: 'blue', icon: <SafetyOutlined />, delta: 'Insurance queue', to: '/tickets?type=Insurance' },
          { label: 'O2 taxi tickets', value: kpis?.o2TaxiTickets, tone: 'green', icon: <CarOutlined />, delta: 'Taxi query queue', to: '/tickets?type=O2Taxi' },
          { label: 'General tickets', value: kpis?.generalTickets, tone: 'orange', icon: <AppstoreOutlined />, delta: 'General operations', to: '/tickets?type=General' },
          { label: 'Daily activity tickets', value: kpis?.dailyActivityTickets, tone: 'purple', icon: <CalendarOutlined />, delta: 'Team tracking', to: '/tickets?type=DailyActivity' },
        ].map(k => (
          <Col xs={12} lg={6} key={k.label}>
            <KpiCard {...k} loading={kloading} />
          </Col>
        ))}
      </Row>
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={12} lg={6}>
          <KpiCard label="Support tickets" value={kpis?.supportTickets} tone="indigo" icon={<CustomerServiceOutlined />} delta="Support and issue tracking" loading={kloading} to="/tickets?type=Support" />
        </Col>
      </Row>
      <Row gutter={[14, 14]} style={{ marginBottom: 22 }}>
        {[
          { label: 'Total tickets', value: kpis?.totalTickets, tone: 'teal', icon: <UnorderedListOutlined />, delta: '↑ 12 this week', up: true, to: '/tickets' },
          { label: 'Open', value: kpis?.openTickets, tone: 'sky', icon: <InboxOutlined />, delta: 'Awaiting action', to: '/tickets?status=Open' },
          { label: 'Expiring ≤ 30 days', value: kpis?.expiringIn30Days, tone: 'amber', icon: <ClockCircleOutlined />, delta: '⚠ Renewal needed', to: '/renewals' },
          { label: 'Expired policies', value: kpis?.expiredPolicies, tone: 'rose', icon: <WarningOutlined />, delta: 'Immediate action', to: '/renewals' },
        ].map(k => (
          <Col xs={12} lg={6} key={k.label}>
            <KpiCard {...k} loading={kloading} />
          </Col>
        ))}
      </Row>

      <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
        {/* Monthly chart */}
        <Col xs={24} lg={10}>
          <Card title="Monthly ticket volume" style={CARD} styles={{ body: { padding: '12px 16px' } }}>
            {monthly ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 110, paddingTop: 8 }}>
                {monthly.map((m, i) => (
                  <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 11, color: FAINT, fontWeight: 500 }}>{m.tickets}</div>
                    <div style={{
                      width: '100%', borderRadius: '4px 4px 0 0',
                      background: i === monthly.length - 1 ? 'linear-gradient(180deg, #60a5fa, #2563eb)' : BAR_COLORS[i % BAR_COLORS.length],
                      height: `${Math.round((m.tickets / maxTickets) * 80)}px`,
                      minHeight: 8, transition: 'height .4s',
                    }} />
                    <div style={{ fontSize: 11, color: i === monthly.length - 1 ? INK : FAINT, fontWeight: i === monthly.length - 1 ? 600 : 400 }}>
                      {m.month}
                    </div>
                  </div>
                ))}
              </div>
            ) : <Skeleton active />}
          </Card>
        </Col>

        {/* Payment overview */}
        <Col xs={24} lg={14}>
          <Card title="Payment overview" style={CARD} styles={{ body: { padding: '12px 16px' } }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12}>
                <div className="dash-tile dash-tile--green is-link" role="link" tabIndex={0} aria-label="Collected this month. Open receipts" onClick={() => navigate('/accounts/receipts')} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/accounts/receipts'); }}>
                  <div className="dash-tile-label">Collected this month</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#059669' }}>
                    ₹{((kpis?.premiumCollected ?? 0) / 100000).toFixed(1)}L
                  </div>
                  <div style={{ background: '#d1fae5', borderRadius: 4, height: 6, marginTop: 10, overflow: 'hidden' }}>
                    <div style={{ width: '78%', height: '100%', background: 'linear-gradient(90deg, #34d399, #059669)', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#059669', marginTop: 5 }}>78% collection rate</div>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div className="dash-tile dash-tile--red is-link" role="link" tabIndex={0} aria-label="Pending collection. Open renewals" onClick={() => navigate('/renewals')} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/renewals'); }}>
                  <div className="dash-tile-label">Pending collection</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#e11d48' }}>
                    ₹{((kpis?.pendingPayments ?? 0) / 100000).toFixed(1)}L
                  </div>
                  <Button size="small" style={{ marginTop: 12, fontSize: 11 }} onClick={(e) => { e.stopPropagation(); navigate('/renewals'); }}>
                    View pending →
                  </Button>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Tickets section with view toggle */}
      <Card
        title="Upcoming insurance expiries"
        style={CARD}
        extra={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* View toggle buttons */}
            <div style={{
              display: 'flex', border: '1px solid #ecebe6',
              borderRadius: 6, overflow: 'hidden',
            }}>
              <Tooltip title="List view">
                <button
                  className="action-button"
                  aria-pressed={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '4px 10px', border: 'none', cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <UnorderedListOutlined style={{ fontSize: 14 }} />
                </button>
              </Tooltip>
              <Tooltip title="Card view">
                <button
                  className="action-button"
                  aria-pressed={viewMode === 'card'}
                  onClick={() => setViewMode('card')}
                  style={{
                    padding: '4px 10px', border: 'none', cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <AppstoreOutlined style={{ fontSize: 14 }} />
                </button>
              </Tooltip>
            </div>
            <Button type="link" onClick={() => navigate('/renewals')}>
              View all →
            </Button>
          </div>
        }
      >
        {viewMode === 'list' ? (
          <Table
            columns={expiryColumns}
            dataSource={alerts ?? []}
            rowKey="id"
            pagination={false}
            size="small"
            onRow={r => ({ onClick: () => navigate(`/tickets/${r.id}`), style: { cursor: 'pointer' } })}
          />
        ) : (
          <CardView tickets={alerts ?? []} />
        )}
      </Card>
    </div>
  );
}