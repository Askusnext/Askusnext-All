import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal, Popover, Space, Tag, Typography } from 'antd';
import { presenceApi, type MyPresence } from '../api/presence';
import { STATE_COLOR, STATE_LABEL } from '../presence/logic';
import { registerPresenceStopper, takesPartInPresence } from '../presence/session';
import { PresenceLink } from '../presence/link';
import { PresenceTracker } from '../presence/tracker';

const { Text, Paragraph } = Typography;

/** The full notice: what is collected, who sees it, the limits, what Active means, and how to stop. */
export function NoticeBody({ notice }: { notice: MyPresence['notice'] }) {
  const row = (label: string, text: string) => (
    <Paragraph style={{ marginBottom: 8 }}>
      <Text strong>{label}: </Text>
      {text}
    </Paragraph>
  );
  return (
    <div>
      <Paragraph>{notice.summary}</Paragraph>
      {row('What is collected', notice.collected)}
      {row('Who can see it', notice.audience)}
      {row('What is never collected', notice.notCollected)}
      {row('What Active means', notice.meaning)}
      {row('How to stop', notice.stop)}
    </div>
  );
}

/**
 * Consent prompt + persistent personal indicator for Admin, Employee and Agent. Renders nothing for
 * Super Admin and Customers. Presence starts only after the server confirms consent, never before.
 */
export default function PresenceGate({ role, dark = true }: { role?: string; dark?: boolean }) {
  const eligible = takesPartInPresence(role);
  const [me, setMe] = useState<MyPresence | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const trackerRef = useRef<PresenceTracker | null>(null);
  const prompted = useRef(false); // one automatic prompt per sign-in, whatever the route does
  const alive = useRef(true);

  const stopTracker = useCallback((endRemote: boolean) => {
    trackerRef.current?.stop(endRemote);
    trackerRef.current = null;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const m = await presenceApi.me();
      if (!alive.current) return null;
      setMe(m);
      return m;
    } catch {
      return null;
    }
  }, []);

  const startTracker = useCallback((m: MyPresence) => {
    if (trackerRef.current) return;
    const t = new PresenceTracker(m.config.heartbeatSeconds, undefined, undefined, (s) => {
      if (s === 'revoked' && alive.current) void refresh();
    }, new PresenceLink());
    trackerRef.current = t;
    void t.start();
  }, [refresh]);

  // Load once per sign-in. If consent is already in force for the current notice, resume automatically.
  useEffect(() => {
    alive.current = true;
    if (!eligible) return;
    registerPresenceStopper(() => stopTracker(true));
    void (async () => {
      const m = await refresh();
      if (!m || !m.trackable) return;
      if (m.consent?.decision === 'accepted' && m.consent.current) startTracker(m);
      else if (m.needsDecision && !prompted.current) {
        prompted.current = true;
        setPromptOpen(true);
      }
    })();
    return () => {
      alive.current = false;
      registerPresenceStopper(null);
      stopTracker(true); // unmount (logout, role change): heartbeats stop and the socket-free session ends
    };
  }, [eligible, refresh, startTracker, stopTracker]);

  if (!eligible || !me || !me.trackable) return null;

  const decide = async (kind: 'accept' | 'defer' | 'withdraw') => {
    setBusy(true);
    setError(null);
    try {
      const next = kind === 'accept' ? await presenceApi.accept(me.notice.version) : kind === 'defer' ? await presenceApi.defer(me.notice.version) : await presenceApi.withdraw();
      setMe(next);
      if (kind === 'accept') startTracker(next); // only after the server said yes
      if (kind === 'withdraw') stopTracker(false); // the server already ended every session
      setPromptOpen(false);
      setReviewOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Nothing was changed.'); // never pretend it saved
    } finally {
      setBusy(false);
    }
  };

  const enabled = me.consent?.decision === 'accepted' && me.consent.current;
  const shownState = enabled ? me.state : 'not_enabled';
  const label = enabled ? (me.state === 'offline' ? 'Starting…' : STATE_LABEL[me.state]) : STATE_LABEL.not_enabled;

  const review = (
    <div style={{ width: 340 }}>
      <NoticeBody notice={me.notice} />
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 8 }} />}
      <Space>
        {enabled ? (
          <Button danger loading={busy} onClick={() => decide('withdraw')}>Withdraw permission</Button>
        ) : (
          <Button type="primary" loading={busy} onClick={() => decide('accept')}>Allow</Button>
        )}
        <Button onClick={() => setReviewOpen(false)}>Close</Button>
      </Space>
    </div>
  );

  return (
    <>
      <Popover trigger="click" open={reviewOpen} onOpenChange={setReviewOpen} content={review} title="Browser presence" placement="topLeft">
        <button
          className="action-button"
          type="button"
          data-testid="presence-indicator"
          aria-label={`Browser presence: ${label}`}
          style={{ cursor: 'pointer', display: 'flex', flexWrap: 'wrap', alignItems: 'center', padding: '6px 8px', gap: 8, fontSize: 12, color: dark ? '#fff' : undefined, marginBottom: 10 }}
        >
          <Tag color={STATE_COLOR[shownState]} style={{ margin: 0 }}>{label}</Tag>
          <span style={{ textDecoration: 'underline' }}>Presence</span>
        </button>
      </Popover>

      <Modal
        open={promptOpen}
        title={me.notice.title}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={[
          <Button key="later" loading={busy} onClick={() => decide('defer')}>Not now</Button>,
          <Button key="allow" type="primary" loading={busy} onClick={() => decide('accept')}>Allow</Button>,
        ]}
      >
        <NoticeBody notice={me.notice} />
        {error && <Alert type="error" showIcon message={error} />}
        <Text type="secondary">You can change this any time from the Presence control in the sidebar.</Text>
      </Modal>
    </>
  );
}
