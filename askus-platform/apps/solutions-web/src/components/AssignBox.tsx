import { useEffect, useState } from 'react';
import { Button, Select, Space, Tag, Typography, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useAppSelector } from '../store';
import { activityApi, type StaffMember } from '../api/activity';

const { Text } = Typography;

/**
 * Who is working on an item. Anyone on the team can take an item or release one they hold;
 * an admin can give it to anybody.
 */
export default function AssignBox({
  assignedToId, assignedToName, onAssign,
}: {
  assignedToId?: string | null;
  assignedToName?: string | null;
  /** Resolves when saved. Pass null to release. */
  onAssign: (assigneeId: string | null) => Promise<void>;
}) {
  const me = useAppSelector((s) => s.auth.user);
  const isAdmin = me?.role === 'Admin';
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdmin) activityApi.staff().then(setStaff).catch(() => undefined);
  }, [isAdmin]);

  const run = async (id: string | null) => {
    setBusy(true);
    try { await onAssign(id); message.success(id ? 'Assigned' : 'Released'); } catch (e) { message.error(e instanceof Error ? e.message : 'Could not change the assignment'); } finally { setBusy(false); }
  };

  const mine = Boolean(me?.id) && assignedToId === me?.id;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 14 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>WORKING ON IT</Text>
      {assignedToName
        ? <Tag icon={<UserOutlined />} color={mine ? 'blue' : 'default'} style={{ marginRight: 0 }}>{assignedToName}{mine ? ' (you)' : ''}</Tag>
        : <Tag color="warning" style={{ marginRight: 0 }}>Nobody yet</Tag>}
      <Space size={8} wrap>
        {!mine && <Button size="small" type="primary" loading={busy} onClick={() => me?.id && void run(me.id)}>Take it</Button>}
        {assignedToId && (isAdmin || mine) && <Button size="small" loading={busy} onClick={() => void run(null)}>Release</Button>}
        {isAdmin && (
          <Select size="small" showSearch optionFilterProp="label" placeholder="Assign to…" style={{ width: 200 }} value={undefined} disabled={busy}
            options={staff.filter((s) => s.id !== assignedToId).map((s) => ({ value: s.id, label: `${s.name} (${s.role})` }))}
            onChange={(id: string) => void run(id)} />
        )}
      </Space>
    </div>
  );
}
