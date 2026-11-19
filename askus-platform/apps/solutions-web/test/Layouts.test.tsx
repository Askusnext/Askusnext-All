import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from '../src/components/AppLayout';
import CustomerPortalLayout from '../src/components/CustomerPortalLayout';
import SiteChrome from '../src/components/SiteChrome';
import { store, loginSuccess, logout } from '../src/store';
import { stopPresenceForLogout } from '../src/presence/session';
import type { User } from '../src/types';

vi.mock('../src/components/PresenceGate', () => ({ default: () => null }));
vi.mock('../src/components/StaffLoginModal', () => ({ default: () => null }));
vi.mock('../src/presence/session', () => ({ stopPresenceForLogout: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  store.dispatch(logout());
  vi.clearAllMocks();
});
afterEach(cleanup);

function renderWorkspace(user?: User) {
  if (user) store.dispatch(loginSuccess({ token: 'test-token', user }));
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/calendar']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/calendar" element={<h1>Calendar content</h1>} />
            <Route path="/tickets" element={<h1>Ticket content</h1>} />
          </Route>
          <Route path="/home" element={<h1>Public home</h1>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('shared Solutions layouts', () => {
  it('uses the home navigation on product pages and closes the menu after routing', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/products/ai-agents']}>
        <SiteChrome>
          <Routes>
            <Route path="/products/ai-agents" element={<h1>Product detail</h1>} />
            <Route path="/contact" element={<h1>Contact page</h1>} />
          </Routes>
        </SiteChrome>
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Solutions' }).getAttribute('aria-current')).toBe('page');
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(within(nav).getByRole('link', { name: 'Contact' }));
    expect(screen.getByRole('heading', { name: 'Contact page' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByText('Next Global Solutions Pvt Ltd')).toHaveLength(2);
  });

  it('keeps permission-filtered workspace links usable through the mobile toggle', async () => {
    const user = userEvent.setup();
    renderWorkspace({ id: 'test-employee', name: 'Test employee', mobile: '9999999999', role: 'Employee', branchId: 'test', permissions: ['tickets'] });
    const nav = screen.getByRole('navigation', { name: 'Workspace navigation' });
    expect(within(nav).queryByRole('link', { name: 'User Management' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Timesheet' })).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Open workspace navigation' });
    await user.click(toggle);
    within(nav).getByRole('link', { name: 'Tickets' }).focus();
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    await user.click(within(nav).getByRole('link', { name: 'Tickets' }));
    expect(screen.getByRole('heading', { name: 'Ticket content' })).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('retains admin navigation and ends presence before clearing the staff session on logout', async () => {
    const user = userEvent.setup();
    renderWorkspace({ id: 'test-admin', name: 'Test admin', mobile: '9999999999', role: 'Admin', branchId: 'test' });
    expect(screen.getByRole('link', { name: 'User Management' })).toBeTruthy();
    vi.mocked(stopPresenceForLogout).mockImplementation(() => {
      expect(localStorage.getItem('tms_token')).toBe('test-token');
    });
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(stopPresenceForLogout).toHaveBeenCalledOnce();
    expect(localStorage.getItem('tms_token')).toBeNull();
    expect(store.getState().auth.user).toBeNull();
    expect(screen.getByRole('heading', { name: 'Public home' })).toBeTruthy();
  });

  it('does not render a workspace sidebar without a staff session', () => {
    renderWorkspace();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Calendar content' })).toBeTruthy();
  });

  it('highlights only New Ticket and logs out only the customer session', async () => {
    const user = userEvent.setup();
    localStorage.setItem('tms_token', 'staff-test-token');
    localStorage.setItem('askus_customer_token', 'customer-test-token');
    localStorage.setItem('askus_customer', JSON.stringify({ name: 'Test customer' }));
    render(
      <MemoryRouter initialEntries={['/customer/tickets/new']}>
        <Routes>
          <Route path="/customer/tickets/new" element={<CustomerPortalLayout><h1>New ticket form</h1></CustomerPortalLayout>} />
          <Route path="/customer/login" element={<h1>Customer sign in</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Customer navigation' });
    expect(within(nav).getByRole('link', { name: 'My Tickets' }).getAttribute('aria-current')).toBeNull();
    expect(within(nav).getByRole('link', { name: 'New Ticket' }).getAttribute('aria-current')).toBe('page');
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(localStorage.getItem('askus_customer_token')).toBeNull();
    expect(localStorage.getItem('askus_customer')).toBeNull();
    expect(localStorage.getItem('tms_token')).toBe('staff-test-token');
    expect(screen.getByRole('heading', { name: 'Customer sign in' })).toBeTruthy();
  });
});
