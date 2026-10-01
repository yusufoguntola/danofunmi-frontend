import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminLogin from '../../../src/pages/admin/AdminLogin';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api, ApiError } from '../../../src/lib/api';
import { consumeSessionExpired } from '../../../src/lib/sessionEvents';
import { fakeJwt } from '../../helpers/fakeJwt';

vi.mock('../../../src/lib/api', () => {
  class ApiError extends Error {
    constructor(message, status, body) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  return {
    api: { adminLogin: vi.fn() },
    ApiError,
  };
});

vi.mock('../../../src/lib/sessionEvents', () => ({ consumeSessionExpired: vi.fn(() => false) }));

const STORAGE_KEY = 'danofunmi_admin_session';

function renderPage({ initialEntries = ['/restricted-path/login'] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/restricted-path/login" element={<AdminLogin />} />
          <Route path="/restricted-path" element={<p>Admin Dashboard</p>} />
        </Routes>
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  consumeSessionExpired.mockReturnValue(false);
});

describe('AdminLogin', () => {
  test('redirects to /restricted-path when already signed in', () => {
    const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { name: 'Ada' } }));

    renderPage();

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  test('a successful login navigates to /restricted-path', async () => {
    const user = userEvent.setup();
    const token = fakeJwt({ type: 'admin' });
    api.adminLogin.mockResolvedValue({ token, admin: { name: 'Ada' } });

    renderPage();

    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'secretpw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Admin Dashboard')).toBeInTheDocument();
    expect(api.adminLogin).toHaveBeenCalledWith('admin@test.com', 'secretpw');
  });

  test('a failed login shows the server error message', async () => {
    const user = userEvent.setup();
    api.adminLogin.mockRejectedValue(new ApiError('Invalid credentials', 401));

    renderPage();

    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  test('a failed login with a non-ApiError shows the generic fallback message', async () => {
    const user = userEvent.setup();
    api.adminLogin.mockRejectedValue(new Error('boom'));

    renderPage();

    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Could not sign in.')).toBeInTheDocument();
  });

  test('shows the session-expired banner when consumeSessionExpired() returns true', () => {
    consumeSessionExpired.mockReturnValue(true);

    renderPage();

    expect(screen.getByText('Your session expired — please sign in again.')).toBeInTheDocument();
  });

  test('does not show the session-expired banner by default', () => {
    renderPage();
    expect(screen.queryByText(/session expired/)).not.toBeInTheDocument();
  });
});
