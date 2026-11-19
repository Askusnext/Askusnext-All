import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  myEvents: vi.fn(), teams: vi.fn(), orgView: vi.fn(), setMember: vi.fn(),
}));

vi.mock('../src/api/calendar', async (original) => ({
  ...(await original<typeof import('../src/api/calendar')>()),
  calendarApi: api,
}));
vi.mock('../src/store', () => ({
  useAppSelector: () => ({ id: 'admin', name: 'Admin', role: 'SuperAdmin' }),
}));
vi.mock('../src/views/CalendarPage', () => ({ default: () => null }));

import UnifiedCalendarPage from '../src/views/UnifiedCalendarPage';

beforeEach(() => {
  vi.resetAllMocks();
  api.myEvents.mockResolvedValue({
    providers: { google: { configured: false }, microsoft: { configured: false } },
    connections: [], days: [], cells: {},
  });
  api.teams.mockResolvedValue({
    teams: [{ team: 'Alphaa Loans', members: [] }],
    staff: [{ userId: 'staff-1', name: 'Sample person', role: 'Employee' }],
  });
  api.orgView.mockResolvedValue({
    days: [],
    rows: [{ userId: 'staff-1', employeeName: 'Sample person', role: 'Employee', teams: ['Alphaa Insurance', 'Alphaa Loans'], now: 'offline', cells: {} }],
  });
  api.setMember.mockResolvedValue({
    teams: [{ team: 'Alphaa Loans', members: [{ userId: 'staff-1', name: 'Sample person', role: 'Employee' }] }],
    staff: [],
  });
});
afterEach(cleanup);

describe('rebranded calendar teams', () => {
  it('displays the new brands while retaining the stored team value for filtering', async () => {
    const user = userEvent.setup();
    render(<UnifiedCalendarPage />);
    await user.click(screen.getByRole('tab', { name: 'Organisation view' }));
    expect(await screen.findByText('Employee · Askus Insurance, Askus Financial Services')).toBeTruthy();
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Askus Insurance', { selector: '.ant-select-item-option-content' }));
    await waitFor(() => expect(api.orgView).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), 'Alphaa Insurance'));
  });

  it('shows the new team name without changing membership request identifiers', async () => {
    const user = userEvent.setup();
    render(<UnifiedCalendarPage />);
    await user.click(screen.getByRole('tab', { name: 'Teams' }));
    expect(await screen.findByText('Askus Financial Services')).toBeTruthy();
    expect(screen.queryByText('Alphaa Loans')).toBeNull();
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Sample person (Employee)', { selector: '.ant-select-item-option-content' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(api.setMember).toHaveBeenCalledWith('Alphaa Loans', 'staff-1', true));
  });
});
