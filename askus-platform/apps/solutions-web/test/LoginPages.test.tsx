import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../src/views/LoginPage';
import CustomerLoginPage from '../src/views/CustomerLoginPage';
import { api } from '../src/api/mockApi';
import customerApi from '../src/api/customerApi';
import { store, logout } from '../src/store';

vi.mock('../src/api/mockApi', () => ({ api: { sendOTP: vi.fn(), verifyOTP: vi.fn() } }));
vi.mock('../src/api/customerApi', () => ({ default: { requestOtp: vi.fn(), verifyOtp: vi.fn() } }));

beforeEach(() => {
  localStorage.clear();
  store.dispatch(logout());
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('restyled sign-in screens', () => {
  it('preserves staff first-sign-in verification and the Agent destination', async () => {
    const user = userEvent.setup();
    vi.mocked(api.sendOTP)
      .mockResolvedValueOnce({ success: true, message: 'Verify email', needs: 'email', sessionId: '' })
      .mockResolvedValueOnce({ success: true, message: 'Codes sent', sessionId: 'test-session', channels: ['sms', 'email'] });
    vi.mocked(api.verifyOTP).mockResolvedValue({
      token: 'test-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: { id: 'test-agent', name: 'Test agent', mobile: '9999999999', role: 'Agent', branchId: 'test' },
    });
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/timesheet" element={<h1>Agent timesheet</h1>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );
    await user.type(screen.getByLabelText('Mobile number or email'), '9999999999');
    await user.click(screen.getByRole('button', { name: 'Send Code' }));
    await user.type(await screen.findByLabelText('Email address (to verify on first sign-in)'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Code' }));
    expect(api.sendOTP).toHaveBeenLastCalledWith('9999999999', 'test@example.com');
    await user.type(await screen.findByLabelText('Code sent to your mobile'), '123456');
    await user.type(screen.getByLabelText('Code sent to your email'), '654321');
    await user.click(screen.getByRole('button', { name: 'Verify and Log In' }));
    expect(api.verifyOTP).toHaveBeenCalledWith('9999999999', '123456', 'test-session', { identifier: 'test@example.com', code: '654321' });
    expect(await screen.findByRole('heading', { name: 'Agent timesheet' })).toBeTruthy();
  });

  it('keeps customer email OTP verification and portal navigation working', async () => {
    const user = userEvent.setup();
    vi.mocked(customerApi.requestOtp).mockResolvedValue({ sent: true, channels: ['email'] });
    vi.mocked(customerApi.verifyOtp).mockResolvedValue({
      token: 'test-token',
      customer: { id: 'test-customer', name: 'Test customer', email: 'test@example.com', mobile: '9999999999' },
    });
    render(
      <MemoryRouter initialEntries={['/customer/login']}>
        <Routes>
          <Route path="/customer/login" element={<CustomerLoginPage />} />
          <Route path="/customer/tickets" element={<h1>Customer tickets</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('Mobile number or email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Code' }));
    await user.type(await screen.findByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify and Log In' }));
    expect(customerApi.verifyOtp).toHaveBeenCalledWith('test@example.com', '123456', undefined);
    expect(await screen.findByRole('heading', { name: 'Customer tickets' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('askus_customer') ?? '{}').name).toBe('Test customer');
  });
});
