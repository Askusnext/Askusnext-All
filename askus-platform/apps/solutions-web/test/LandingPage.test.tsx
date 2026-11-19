import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import LandingPage from '../src/views/LandingPage';

vi.mock('../src/components/StaffLoginModal', () => ({
  default: ({ open, onClose, contact }: { open: boolean; onClose: () => void; contact: ReactNode }) =>
    open ? <div role="dialog" aria-label="Staff login"><button onClick={onClose}>Close</button>{contact}</div> : null,
}));

afterEach(cleanup);

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route path="/home" element={<LandingPage />} />
        <Route path="/contact" element={<h1>Contact page</h1>} />
        <Route path="/products/ai-agents" element={<h1>AI agents page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('home page navigation', () => {
  it('lets visitors pause and resume the animated solution illustrations', async () => {
    const user = userEvent.setup();
    renderHome();
    for (const name of [
      '3D-style AI assistant with a floating conversation bubble',
      '3D-style city taxi with a live location pin',
      '3D-style protection shield and insurance policy',
      '3D-style financial growth with coins and rising columns',
    ]) {
      expect(screen.getByRole('img', { name })).toBeTruthy();
    }
    await user.click(screen.getByRole('button', { name: 'Pause animations' }));
    expect(document.querySelector('.lp')?.getAttribute('data-motion')).toBe('paused');
    expect(screen.getByRole('button', { name: 'Play animations' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Play animations' }));
    expect(document.querySelector('.lp')?.getAttribute('data-motion')).toBe('playing');
  });

  it('opens the mobile navigation and closes it on Escape, returning focus to its toggle', async () => {
    const user = userEvent.setup();
    renderHome();
    const toggle = screen.getByRole('button', { name: 'Open navigation' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' });
    within(navigation).getByRole('link', { name: 'Solutions' }).focus();
    await user.keyboard('{Escape}');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('keeps solution destinations and the hero section link available', async () => {
    const user = userEvent.setup();
    renderHome();
    const explore = screen.getByRole('link', { name: 'Explore our solutions' });
    expect(explore.getAttribute('href')).toBe('#solutions');
    expect(document.querySelector('#solutions')).toBeTruthy();
    const destinations = [
      ['AskUs AI Agents', '/products/ai-agents'],
      ['O2 Taxi', '/products/o2-taxi'],
      ['Askus Insurance', '/products/alphaa-insurance'],
      ['Askus Financial Services', '/products/alphaa-loans'],
    ];
    for (const [name, destination] of destinations) {
      expect(screen.getByRole('link', { name: `Explore ${name}` }).getAttribute('href')).toBe(destination);
    }
    await user.click(screen.getByRole('link', { name: 'Explore AskUs AI Agents' }));
    expect(screen.getByRole('heading', { name: 'AI agents page' })).toBeTruthy();
  });

  it('opens and closes the existing login modal and routes its access link to Contact', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('dialog', { name: 'Staff login' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Staff login' }));
    await user.click(screen.getByRole('link', { name: 'Need access? Contact Admin' }));
    expect(screen.getByRole('heading', { name: 'Contact page' })).toBeTruthy();
  });
});
