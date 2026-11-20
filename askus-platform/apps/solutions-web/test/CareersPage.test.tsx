import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CareersPage from '../src/views/CareersPage';

vi.mock('../src/components/StaffLoginModal', () => ({ default: () => null }));
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderCareers(entry = '/careers') {
  return render(<MemoryRouter initialEntries={[entry]}><CareersPage /></MemoryRouter>);
}

describe('careers email submission', () => {
  it('replaces the openings with the application view and retains data when changing its position', async () => {
    const user = userEvent.setup();
    renderCareers();
    expect(screen.queryByRole('heading', { name: 'Apply now' })).toBeNull();
    expect(screen.queryByLabelText('First name')).toBeNull();
    screen.getByRole('link', { name: 'Apply for Operations Manager' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText<HTMLSelectElement>('Position').value).toBe('Operations Manager');
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Apply now' }));
    expect(screen.queryByRole('heading', { name: 'Build with us.' })).toBeNull();
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);
    await user.type(screen.getByLabelText('First name'), 'Test');
    const resume = new File(['Test resume'], 'resume.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Resume (PDF or DOC)'), resume);
    await user.selectOptions(screen.getByLabelText('Position'), 'Loan Officer');
    expect(screen.getByLabelText<HTMLSelectElement>('Position').value).toBe('Loan Officer');
    expect(screen.getByLabelText<HTMLInputElement>('First name').value).toBe('Test');
    expect(screen.getByLabelText<HTMLInputElement>('Resume (PDF or DOC)').files?.[0]).toBe(resume);
    await user.selectOptions(screen.getByLabelText('Position'), 'Fleet Coordinator');
    expect(document.activeElement).toBe(screen.getByLabelText('Position'));
    await user.click(screen.getByRole('link', { name: /Back to open positions/ }));
    expect(screen.queryByRole('heading', { name: 'Apply now' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Build with us.' })).toBeTruthy();
  });

  it('loads the selected role from a direct application URL and handles unavailable roles', () => {
    const { unmount } = renderCareers('/careers?position=Loan+Officer');
    expect(screen.getByRole('heading', { name: 'Apply now' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLSelectElement>('Position').value).toBe('Loan Officer');
    expect(screen.queryByRole('link', { name: 'Apply for Loan Officer' })).toBeNull();
    unmount();
    renderCareers('/careers?position=Unavailable');
    expect(screen.getByRole('alert').textContent).toContain('This position is not available');
    expect(screen.queryByLabelText('First name')).toBeNull();
  });

  it('submits applicant details and the resume as a multipart attachment without claiming delivery', async () => {
    const user = userEvent.setup();
    renderCareers();
    await user.click(screen.getByRole('link', { name: 'No matching position? Send an open application' }));
    await user.type(screen.getByLabelText('First name'), 'Test');
    await user.type(screen.getByLabelText('Last name'), 'Applicant');
    await user.type(screen.getByLabelText('Email'), 'applicant@example.com');
    await user.type(screen.getByLabelText('Mobile number'), '9999999999');
    await user.type(screen.getByLabelText('Message (optional)'), 'Test application');
    const resume = new File(['Test resume'], 'resume.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Resume (PDF or DOC)'), resume);
    const form = screen.getByRole('button', { name: 'Submit Application' }).closest('form')!;
    const submitted = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener('submit', submitted);
    // jsdom's required-file validation does not recognize userEvent's FileList.
    fireEvent.submit(form);
    expect(submitted).toHaveBeenCalledOnce();
    expect(form.action).toBe('https://formsubmit.co/careers@askussolutions.in');
    expect(form.method).toBe('post');
    expect(form.enctype).toBe('multipart/form-data');
    const payload = new FormData(form);
    expect(payload.get('email')).toBe('applicant@example.com');
    expect(payload.get('First name')).toBe('Test');
    expect(payload.get('Position')).toBe('Open Application');
    expect(payload.get('Message')).toBe('Test application');
    expect(payload.get('attachment')).toBeInstanceOf(File);
    expect(payload.has('_captcha')).toBe(false);
    expect(screen.queryByText('Application Submitted!')).toBeNull();
  });

  it('blocks oversized resumes and clears the error when a valid replacement is selected', async () => {
    const user = userEvent.setup();
    renderCareers();
    await user.click(screen.getByRole('link', { name: 'Apply for Operations Manager' }));
    const input = screen.getByLabelText<HTMLInputElement>('Resume (PDF or DOC)');
    const oversized = new File(['test'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversized, 'size', { value: 10_000_001 });
    await user.upload(input, oversized);
    expect(input.validationMessage).toBe('Please choose a resume no larger than 10 MB.');
    const boundary = new File(['test'], 'resume.pdf', { type: 'application/pdf' });
    Object.defineProperty(boundary, 'size', { value: 10_000_000 });
    await user.upload(input, boundary);
    expect(input.validity.customError).toBe(false);
    expect(input.files?.[0]).toBe(boundary);
  });
});
