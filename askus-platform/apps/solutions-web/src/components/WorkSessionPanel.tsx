import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Empty, Space, Tag, Typography, message } from 'antd';
import { EnvironmentOutlined, PlayCircleOutlined, PauseCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { attendanceApi, mapLink, minutesLabel, type Fix, type MyAttendance } from '../api/attendance';

const { Title, Text, Paragraph } = Typography;

/** How often a location sample is sent while work is running. */
const PING_EVERY_MS = 2 * 60 * 1000;
/** No keyboard / mouse / touch for this long = "idle". */
const IDLE_AFTER_MS = 5 * 60 * 1000;

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const clock = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '—');

function getFix(timeoutMs = 15000): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This browser cannot share location.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (err) => reject(new Error(
        err.code === err.PERMISSION_DENIED
          ? 'Location is blocked. Allow location for this site in your browser settings (the padlock next to the address), then try again.'
          : err.code === err.TIMEOUT
            ? 'Could not get your location in time. Check that location is turned on and try again.'
            : 'Your location is not available right now.',
      )),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}

export default function WorkSessionPanel() {
  const [me, setMe] = useState<MyAttendance | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);
  const [geoWarning, setGeoWarning] = useState('');
  const [now, setNow] = useState(Date.now());
  const lastActivity = useRef(Date.now());

  const load = useCallback(async () => {
    try { setMe(await attendanceApi.me()); setError(''); } catch (e) { setError(errText(e)); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // tick for the running clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // activity detection (only the fact that something happened is used; nothing about what was typed or clicked)
  useEffect(() => {
    const mark = () => { lastActivity.current = Date.now(); };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, mark));
  }, []);

  const active = me?.active && me.active.live ? me.active : null;

  const sendPing = useCallback(async () => {
    let fix: Fix = {};
    try {
      fix = await getFix(10000);
      setGeoWarning('');
    } catch (e) {
      setGeoWarning(errText(e));
    }
    const state = Date.now() - lastActivity.current > IDLE_AFTER_MS ? 'idle' : 'active';
    try {
      await attendanceApi.ping(fix, state);
      await load();
    } catch (e) {
      // 409: the session was closed elsewhere; refresh to show the truth
      await load();
      setError(errText(e));
    }
  }, [load]);

  // While a session runs: sample now and then, and straight away when the tab comes back to the front.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void sendPing(), PING_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void sendPing(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [active?.id, sendPing]); // eslint-disable-line react-hooks/exhaustive-deps

  const accept = async () => {
    if (!me) return;
    setBusy(true);
    try { await attendanceApi.consent(me.consentVersion); await load(); } catch (e) { message.error(errText(e)); } finally { setBusy(false); }
  };

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const fix = await getFix();
      await attendanceApi.start(fix);
      lastActivity.current = Date.now();
      setGeoWarning('');
      message.success('Work started. Location is shared while this session runs.');
      await load();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    setError('');
    let fix: Fix = {};
    try { fix = await getFix(8000); } catch { /* stopping must always work, even without a location */ }
    try {
      setMe(await attendanceApi.stop(fix));
      message.success('Work stopped. Your hours were added to the timesheet.');
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!me) {
    return <div style={{ padding: 24 }}>{error ? <Alert type="error" showIcon message="Could not load" description={error} /> : <Text type="secondary">Loading…</Text>}</div>;
  }

  // ── notice first ──
  if (!me.consented) {
    return (
      <div style={{ padding: 20, maxWidth: 760 }}>
        <Space align="start" size={12} style={{ marginBottom: 12 }}>
          <SafetyCertificateOutlined style={{ fontSize: 28, color: '#1e40af', marginTop: 4 }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Before you start: how work tracking works</Title>
            <Text type="secondary">Please read this. Nothing is recorded until you accept.</Text>
          </div>
        </Space>
        <Card size="small" style={{ marginBottom: 12 }}>
          <Paragraph style={{ marginBottom: 8 }}><b>What is recorded</b></Paragraph>
          <ul style={{ marginTop: 0 }}>
            <li>Your location when you press <b>Start work</b>, about every 2 minutes while the session runs, and when you press <b>Stop work</b>.</li>
            <li>Whether you were <b>active or idle</b> (any mouse, keyboard or touch use in the last 5 minutes). Never what you typed, clicked or viewed.</li>
            <li>When you started and stopped, and the total hours.</li>
          </ul>
          <Paragraph style={{ marginBottom: 8 }}><b>When</b></Paragraph>
          <ul style={{ marginTop: 0 }}>
            <li>Only while a work session is running and this page is open. <b>Nothing is recorded when you press Stop work</b> or close the page.</li>
            <li>While it runs, this page shows a clear <b>“Location is being shared”</b> banner and a Stop button.</li>
          </ul>
          <Paragraph style={{ marginBottom: 8 }}><b>Who sees it, and why</b></Paragraph>
          <ul style={{ marginTop: 0 }}>
            <li>Admins and employees with team access can see your status, hours and location during your sessions.</li>
            <li>It is used to record attendance and working hours. Your tracked hours are added to your weekly timesheet.</li>
          </ul>
          <Paragraph style={{ marginBottom: 0 }}>Your browser will also ask for permission to use your location. You can refuse it, but then work sessions cannot be started.</Paragraph>
        </Card>
        <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)}>I have read this and agree to my location and activity status being recorded during my work sessions.</Checkbox>
        <div style={{ marginTop: 12 }}>
          <Button type="primary" disabled={!agree} loading={busy} onClick={() => void accept()}>Accept and continue</Button>
        </div>
      </div>
    );
  }

  const runningMinutes = active ? Math.max(0, Math.round((now - new Date(active.startedAt).getTime()) / 60000)) : 0;
  const lost = me.active && !me.active.live;

  return (
    <div style={{ padding: 20 }}>
      {active && (
        <Alert
          type="success" showIcon icon={<EnvironmentOutlined />} style={{ marginBottom: 16 }}
          message="Location is being shared"
          description={`Your location and activity status are recorded about every 2 minutes until you press Stop work. Keep this page open while you work.`}
        />
      )}
      {lost && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="Your last session lost its signal"
          description="No update reached the server for over 5 minutes, so it will be closed at the last update. Press Start work to begin a new one." />
      )}
      {geoWarning && active && <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="Location not updating" description={geoWarning} />}
      {error && <Alert type="error" showIcon closable style={{ marginBottom: 16 }} message={error} onClose={() => setError('')} />}

      <Card style={{ marginBottom: 16, borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>TODAY</Text>
            <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>{minutesLabel(me.todayMinutes)}</div>
            {active
              ? <Space size={6}><Tag color={active.lastState === 'idle' ? 'orange' : 'green'}>{active.lastState === 'idle' ? 'Idle' : 'Working'}</Tag><Text type="secondary">since {clock(active.startedAt)} · {minutesLabel(runningMinutes)} this session</Text></Space>
              : <Text type="secondary">Not working right now</Text>}
          </div>
          {active
            ? <Button danger size="large" icon={<PauseCircleOutlined />} loading={busy} onClick={() => void stop()}>Stop work</Button>
            : <Button type="primary" size="large" icon={<PlayCircleOutlined />} loading={busy} onClick={() => void start()}>Start work</Button>}
        </div>
        {active?.last && (
          <div style={{ marginTop: 12, fontSize: 12 }}>
            <EnvironmentOutlined /> Last location {clock(active.lastPingAt)} · accuracy ~{active.last.accuracy ?? '?'} m ·{' '}
            <a href={mapLink(active.last.lat, active.last.lng)} target="_blank" rel="noreferrer">view on map</a>
          </div>
        )}
      </Card>

      <Title level={5}>Today&apos;s sessions</Title>
      {me.sessions.length === 0 ? <Empty description="No work sessions yet today" /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {me.sessions.map((s) => (
            <Card key={s.id} size="small">
              <Space wrap>
                <b>{clock(s.startedAt)} → {s.endedAt ? clock(s.endedAt) : s.live ? 'now' : '…'}</b>
                <Tag>{minutesLabel(s.minutes)}</Tag>
                {s.live && <Tag color="green">Running</Tag>}
                {s.endReason === 'auto' && <Tag color="orange">Closed: signal lost</Tag>}
                {s.start && <a href={mapLink(s.start.lat, s.start.lng)} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>start location</a>}
              </Space>
            </Card>
          ))}
        </div>
      )}
      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16 }}>
        Tracked hours are added to your weekly timesheet when you stop work. Tracking works only while this page is open in your browser.
      </Paragraph>
    </div>
  );
}
