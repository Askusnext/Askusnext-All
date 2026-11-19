import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  me: vi.fn(), accept: vi.fn(), defer: vi.fn(), withdraw: vi.fn(),
  startSession: vi.fn(), heartbeat: vi.fn(), endSession: vi.fn(),
}));

vi.mock('../src/api/presence', async (orig) => ({
  ...(await orig<typeof import('../src/api/presence')>()),
  presenceApi: api,
  endSessionBestEffort: vi.fn(),
}));

import PresenceGate from '../src/components/PresenceGate';
import { stopPresenceForLogout } from '../src/presence/session';
import * as presenceModule from '../src/api/presence';

const notice = {
  version: '1', title: 'Share your workspace presence?',
  summary: 'Askus Solutions records whether this workspace is in view, in the background, or no longer reachable. Authorized managers can see that status. Other tabs and apps are not monitored.',
  collected: 'Your signed-in staff identity, an opaque session identifier, a presence state and the times it changed.',
  audience: 'Only your current reporting Admin and authorized Super Admins.',
  notCollected: 'No other tab URLs, other website titles, desktop applications, keystrokes, screenshots, recordings, microphone, camera or off-site browsing.',
  meaning: '"Active" only means a Solutions tab is visible and focused.', stop: 'Withdraw permission any time.',
};
const me = (o: Record<string, unknown> = {}) => ({
  role: 'Employee', trackable: true, needsDecision: true, notice, config: { heartbeatSeconds: 30 },
  consent: null, state: 'not_enabled', stateSince: null, lastSeenAt: null, ...o,
});
const accepted = (o: Record<string, unknown> = {}) => me({ needsDecision: false, consent: { decision: 'accepted', noticeVersion: '1', decidedAt: 'x', current: true }, state: 'active', ...o });

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.startSession.mockResolvedValue({ sessionId: 'S'.repeat(24), heartbeatSeconds: 30 });
  api.heartbeat.mockResolvedValue({ ok: true, ignored: false });
});
afterEach(() => cleanup());

describe('who is asked', () => {
  it.each(['Admin', 'Employee', 'Agent'])('%s sees the prompt when no current consent exists', async (role) => {
    api.me.mockResolvedValue(me({ role }));
    render(<PresenceGate role={role} />);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Other tabs and apps are not monitored/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Allow' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Not now' })).toBeTruthy();
    expect(within(dialog).queryByRole('checkbox')).toBeNull(); // no checkbox, no second Start button
    expect(within(dialog).getAllByRole('button')).toHaveLength(2); // exactly Allow and Not now
  });

  it.each(['SuperAdmin', 'Customer', undefined])('%s never sees the prompt and the server is not even asked', async (role) => {
    render(<PresenceGate role={role} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTestId('presence-indicator')).toBeNull();
    expect(api.me).not.toHaveBeenCalled();
    expect(api.startSession).not.toHaveBeenCalled();
  });

  it('explains what is collected, who sees it, the limits and how to stop', async () => {
    api.me.mockResolvedValue(me());
    render(<PresenceGate role="Employee" />);
    const dialog = await screen.findByRole('dialog');
    for (const t of [/What is collected/, /Who can see it/, /What is never collected/, /What Active means/, /How to stop/, /keystrokes/, /reporting Admin/]) {
      expect(within(dialog).getByText(t)).toBeTruthy();
    }
  });
});

describe('Allow and Not now', () => {
  it('Allow starts presence only after the server confirms consent', async () => {
    api.me.mockResolvedValue(me());
    let resolveAccept!: (v: unknown) => void;
    api.accept.mockReturnValue(new Promise((r) => { resolveAccept = r; }));
    const user = userEvent.setup();
    render(<PresenceGate role="Employee" />);
    await user.click(await screen.findByRole('button', { name: 'Allow' }));
    expect(api.accept).toHaveBeenCalledWith('1');
    expect(api.startSession).not.toHaveBeenCalled(); // server has not answered yet
    await act(async () => resolveAccept(accepted()));
    await waitFor(() => expect(api.startSession).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('presence-indicator')).toBeTruthy();
  });

  it('if saving fails it says so, stays open and starts nothing (never pretends it saved)', async () => {
    api.me.mockResolvedValue(me());
    api.accept.mockRejectedValue(new Error('Server unavailable'));
    const user = userEvent.setup();
    render(<PresenceGate role="Agent" />);
    await user.click(await screen.findByRole('button', { name: 'Allow' }));
    expect(await screen.findByText('Server unavailable')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(api.startSession).not.toHaveBeenCalled();
  });

  it('Not now saves the deferral, starts no session, and is not shown again on re-renders or route changes', async () => {
    api.me.mockResolvedValue(me());
    api.defer.mockResolvedValue(me({ needsDecision: false, consent: { decision: 'deferred', noticeVersion: '1', decidedAt: 'x', current: true } }));
    const user = userEvent.setup();
    const { rerender } = render(<PresenceGate role="Employee" />);
    await user.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(api.defer).toHaveBeenCalledWith('1');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    for (let i = 0; i < 3; i++) rerender(<PresenceGate role="Employee" />); // what a route change looks like to a persistent layout
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.me).toHaveBeenCalledTimes(1);
    expect(api.startSession).not.toHaveBeenCalled();
    expect(screen.getByTestId('presence-indicator').textContent).toMatch(/Not enabled/);
  });

  it('the prompt appears once even if the component re-renders while it is open', async () => {
    api.me.mockResolvedValue(me());
    const { rerender } = render(<PresenceGate role="Employee" />);
    await screen.findByRole('dialog');
    rerender(<PresenceGate role="Employee" />);
    rerender(<PresenceGate role="Employee" />);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(api.me).toHaveBeenCalledTimes(1);
  });

  it('a changed notice version asks again; an old decision is never silently reused', async () => {
    api.me.mockResolvedValue(me({ consent: { decision: 'accepted', noticeVersion: '0', decidedAt: 'x', current: false }, needsDecision: true }));
    render(<PresenceGate role="Employee" />);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(api.startSession).not.toHaveBeenCalled();
  });
});

describe('resume, indicator, withdrawal, logout', () => {
  it('resumes automatically with a valid current consent and shows no prompt', async () => {
    api.me.mockResolvedValue(accepted());
    render(<PresenceGate role="Employee" />);
    await waitFor(() => expect(api.startSession).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('presence-indicator').textContent).toMatch(/Available/);
  });

  it('the persistent indicator shows Not enabled distinctly from Offline', async () => {
    api.me.mockResolvedValue(me({ needsDecision: false, consent: { decision: 'withdrawn', noticeVersion: '1', decidedAt: 'x', current: true } }));
    render(<PresenceGate role="Employee" />);
    const ind = await screen.findByTestId('presence-indicator');
    expect(ind.textContent).toMatch(/Not enabled/);
    expect(ind.textContent).not.toMatch(/Offline/);
  });

  it('withdrawing stops heartbeats and can be revisited with Allow', async () => {
    api.me.mockResolvedValue(accepted());
    api.withdraw.mockResolvedValue(me({ needsDecision: false, consent: { decision: 'withdrawn', noticeVersion: '1', decidedAt: 'x', current: true } }));
    const user = userEvent.setup();
    render(<PresenceGate role="Employee" />);
    await waitFor(() => expect(api.startSession).toHaveBeenCalled());
    await user.click(screen.getByTestId('presence-indicator'));
    await user.click(await screen.findByRole('button', { name: 'Withdraw permission' }));
    expect(api.withdraw).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('presence-indicator').textContent).toMatch(/Not enabled/));
    await user.click(screen.getByTestId('presence-indicator'));
    expect(await screen.findByRole('button', { name: 'Allow' })).toBeTruthy(); // way back in
  });

  it('logout stops heartbeats and ends the session', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.me.mockResolvedValue(accepted());
    render(<PresenceGate role="Employee" />);
    await waitFor(() => expect(api.startSession).toHaveBeenCalled());
    stopPresenceForLogout();
    expect(presenceModule.endSessionBestEffort).toHaveBeenCalledWith('S'.repeat(24));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(api.heartbeat).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('unmounting (sign-out navigation) also stops heartbeats', async () => {
    api.me.mockResolvedValue(accepted());
    const { unmount } = render(<PresenceGate role="Employee" />);
    await waitFor(() => expect(api.startSession).toHaveBeenCalled());
    unmount();
    expect(presenceModule.endSessionBestEffort).toHaveBeenCalled();
  });
});
