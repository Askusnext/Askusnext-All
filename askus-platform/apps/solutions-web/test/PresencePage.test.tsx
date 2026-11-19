import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ team: vi.fn(), history: vi.fn(), admins: vi.fn() }));
const feed = vi.hoisted(() => ({ opts: null as any, started: 0, stopped: 0 }));

vi.mock('../src/api/presence', async (orig) => ({ ...(await orig<typeof import('../src/api/presence')>()), presenceApi: api }));
vi.mock('../src/presence/liveFeed', () => ({
  LiveFeed: class {
    constructor(o: unknown) { feed.opts = o; }
    start() { feed.started++; }
    stop() { feed.stopped++; }
  },
}));

import PresencePage from '../src/views/PresencePage';
import { loginSuccess, store } from '../src/store';

const row = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  userId: id, name, role: 'Employee', reportingAdminId: 'A', reportingAdminName: 'Alice', state: 'active',
  stateSince: new Date(Date.now() - 5 * 60_000).toISOString(), lastSeenAt: new Date().toISOString(), version: 1, ...over,
});
const team = (rows: unknown[], canAssign = false) => ({ serverNow: new Date().toISOString(), total: rows.length, page: 1, pageSize: 200, rows, canAssign, thresholds: { offlineSeconds: 120, awayMinutes: 10 } });

function show(role: 'Admin' | 'SuperAdmin') {
  store.dispatch(loginSuccess({ token: 't', user: { id: 'me', name: 'Me', role, mobile: '', email: '', branchId: 'b' } as never }));
  return render(<Provider store={store}><MemoryRouter><PresencePage /></MemoryRouter></Provider>);
}
const push = (e: unknown) => act(async () => feed.opts.onEvent(e));
const conn = (c: string) => act(async () => feed.opts.onConnection(c));

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  feed.opts = null; feed.started = 0; feed.stopped = 0;
  api.team.mockResolvedValue(team([row('e1', 'Eve Employee'), row('g1', 'Ann Agent', { role: 'Agent', state: 'background', version: 2 })]));
  api.admins.mockResolvedValue([{ id: 'A', name: 'Alice Admin' }]);
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe('Admin view (team only)', () => {
  it('shows only what the server returned, with no assignment controls and no Admin column', async () => {
    show('Admin');
    expect(await screen.findByText('Eve Employee')).toBeTruthy();
    expect(screen.getByText('Ann Agent')).toBeTruthy();
    expect(screen.queryByText('Manage assignments')).toBeNull();
    expect(screen.queryByText('Reporting Admin')).toBeNull();
    expect(api.admins).not.toHaveBeenCalled(); // an Admin never even loads the assignable-Admin list
    expect(screen.getByText(/Employees and Agents assigned to you/)).toBeTruthy();
  });

  it('shows an honest empty state when nobody is assigned', async () => {
    api.team.mockResolvedValue(team([]));
    show('Admin');
    expect(await screen.findByText('No staff are assigned to you yet')).toBeTruthy();
  });

  it('includes the plain-language legend and says Active is not proof of work or payroll time', async () => {
    show('Admin');
    await screen.findByText('Eve Employee');
    expect(screen.getByText('What these states mean')).toBeTruthy();
    expect(screen.getByText(/does not prove typing, productivity or working time/)).toBeTruthy();
    expect(screen.getByText(/cause is unknown/)).toBeTruthy();
    expect(screen.getByText(/not proof of work or productivity/)).toBeTruthy();
    expect(screen.getByText(/not used for attendance or payroll/)).toBeTruthy();
  });

  it('shows presence badge, time in state, last seen and the history button per person', async () => {
    show('Admin');
    const r = (await screen.findByText('Eve Employee')).closest('tr')!;
    expect(within(r).getByText('Active in Solutions')).toBeTruthy();
    expect(within(r).getByText(/^\d+m$/)).toBeTruthy();
    expect(within(r).getByRole('button', { name: 'History' })).toBeTruthy();
  });

  it('opens bounded recent history for a person', async () => {
    api.history.mockResolvedValue({ userId: 'e1', name: 'Eve Employee', retentionDays: 30, transitions: [{ from: 'offline', to: 'active', at: '2026-11-18T10:00:00Z' }] });
    const user = userEvent.setup();
    show('Admin');
    await user.click(within((await screen.findByText('Eve Employee')).closest('tr')!).getByRole('button', { name: 'History' }));
    expect(api.history).toHaveBeenCalledWith('e1', 50);
    expect(await screen.findByText(/Kept for 30 days/)).toBeTruthy();
  });
});

describe('Super Admin view', () => {
  it('shows the reporting Admin, flags unassigned staff, and offers assignment management', async () => {
    api.team.mockResolvedValue(team([row('e1', 'Eve Employee'), row('e2', 'Eli Employee', { reportingAdminId: null, reportingAdminName: null }), row('a1', 'Bob Admin', { role: 'Admin', reportingAdminId: null, reportingAdminName: null })], true));
    show('SuperAdmin');
    expect(await screen.findByText('Reporting Admin')).toBeTruthy();
    expect(screen.getByText('Unassigned')).toBeTruthy();
    expect(screen.getByText('Manage assignments')).toBeTruthy();
    expect(screen.getByText('Bob Admin')).toBeTruthy();
    await waitFor(() => expect(api.admins).toHaveBeenCalled());
    expect(screen.getByText(/All Admins, Employees and Agents/)).toBeTruthy();
  });
});

describe('live behaviour', () => {
  it('applies live updates and ignores stale (older) ones', async () => {
    show('Admin');
    await screen.findByText('Eve Employee');
    await push({ type: 'upsert', row: row('e1', 'Eve Employee', { state: 'away', version: 5 }) });
    expect(within(screen.getByText('Eve Employee').closest('tr')!).getByText('Away (10+ min)')).toBeTruthy();
    await push({ type: 'upsert', row: row('e1', 'Eve Employee', { state: 'active', version: 3 }) }); // older: dropped
    expect(within(screen.getByText('Eve Employee').closest('tr')!).getByText('Away (10+ min)')).toBeTruthy();
  });

  it('removes a person the moment they are reassigned away', async () => {
    show('Admin');
    await screen.findByText('Eve Employee');
    await push({ type: 'removed', userId: 'e1' });
    expect(screen.queryByText('Eve Employee')).toBeNull();
    expect(screen.getByText('Ann Agent')).toBeTruthy();
  });

  it('shows the data as stale while reconnecting or disconnected, and clears it when live', async () => {
    show('Admin');
    await screen.findByText('Eve Employee');
    await conn('live');
    expect(screen.queryByTestId('stale-banner')).toBeNull();
    expect(screen.getByTestId('connection-tag').textContent).toBe('Live');
    await conn('reconnecting');
    expect(screen.getByTestId('stale-banner').textContent).toMatch(/out of date/);
    expect(screen.getByTestId('connection-tag').textContent).toMatch(/Reconnecting/);
    await conn('disconnected');
    expect(screen.getByTestId('stale-banner').textContent).toMatch(/Live updates are off/);
    await conn('live');
    expect(screen.queryByTestId('stale-banner')).toBeNull();
  });

  it('after a reconnect it fetches a fresh authorized snapshot before trusting live events', async () => {
    show('Admin');
    await screen.findByText('Eve Employee');
    const before = api.team.mock.calls.length;
    api.team.mockResolvedValue(team([row('e1', 'Eve Employee', { version: 9 })]));
    await act(async () => feed.opts.onReady());
    await waitFor(() => expect(api.team.mock.calls.length).toBeGreaterThan(before));
    await waitFor(() => expect(screen.queryByText('Ann Agent')).toBeNull()); // no longer in scope after the refresh
  });

  it('cleans up the socket on unmount (logout / navigation)', async () => {
    const { unmount } = show('Admin');
    await screen.findByText('Eve Employee');
    expect(feed.started).toBe(1);
    unmount();
    expect(feed.stopped).toBe(1);
  });

  it('reports a failed load instead of showing an empty team as if it were real', async () => {
    api.team.mockRejectedValue(new Error('Forbidden'));
    show('Admin');
    expect(await screen.findByText('Forbidden')).toBeTruthy();
  });
});
