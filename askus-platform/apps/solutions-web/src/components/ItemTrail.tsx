import { useEffect, useState } from 'react';
import { Timeline, Typography } from 'antd';
import { AREA_LABEL, activityApi, whenFull, type ActivityItem } from '../api/activity';

const { Title, Text } = Typography;

/** Everything the team did on one item, newest first. `refreshKey` reloads it after a change. */
export default function ItemTrail({ entityId, refreshKey }: { entityId: string; refreshKey?: string | number }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    let live = true;
    activityApi.list({ entityId, limit: 40 }).then((r) => live && setItems(r.items)).catch(() => live && setItems([]));
    return () => { live = false; };
  }, [entityId, refreshKey]);

  return (
    <>
      <Title level={5} style={{ marginTop: 16 }}>Who did what on this item</Title>
      {items === null ? <Text type="secondary">Loading…</Text>
        : items.length === 0 ? <Text type="secondary">No activity recorded yet.</Text> : (
          <Timeline
            items={items.map((i) => ({
              color: i.actorRole === 'Customer' ? 'green' : 'blue',
              children: (
                <div style={{ fontSize: 13 }}>
                  <b>{i.actorName}</b> <Text type="secondary" style={{ fontSize: 11 }}>({i.actorRole} · {AREA_LABEL[i.module]?.label ?? i.module})</Text>
                  <div>{i.summary}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{whenFull(i.at)}</Text>
                </div>
              ),
            }))}
          />
        )}
    </>
  );
}
