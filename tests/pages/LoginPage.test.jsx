import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../../src/pages/LoginPage';
import { CustomerAuthProvider } from '../../src/context/CustomerAuthContext';
import { api, ApiError } from '../../src/lib/api';
import { consumeSessionExpired } from '../../src/lib/sessionEvents';
import { getRecaptchaToken } from '../../src/lib/recaptcha';
import { fakeJwt } from '../helpers/fakeJwt';

vi.mock('../../src/lib/api', () => {
  class ApiError extends Error {
    constructor(message, status, body) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  return {
    api: { customerLogin: vi.fn(), customerGoogleLogin: vi.fn() },
    ApiError,
  };
});

vi.mock('../../src/lib/sessionEvents', () => ({ consumeSessionExpired: vi.fn(() => false) }));
vi.mock('../../src/lib/recaptcha', () => ({ getRecaptchaToken: vi.fn() }));

const STORAGE_KEY = 'danofunmi_customer_session';

function renderPage({ initialEntries = ['/login'] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <CustomerAuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/orders" element={<p>My Orders Page</p>} />
        </Routes>
      </CustomerAuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getRecaptchaToken.mockResolvedValue('recaptcha-token');
  consumeSessionExpired.mockReturnValue(false);
  // GoogleSignInButton is a real child here — stub window.google minimally
  // so it doesn't error if it reaches initialize()/renderButton().
  window.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
});

afterEach(() => {
  delete window.google;
});

describe('LoginPage', () => {
  test('redirects to /orders when already signed in', () => {
    const token = fakeJwt({ type: 'customer', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, customer: { name: 'Ada' } }));

    renderPage();

    expect(screen.getByText('My Orders Page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  test('a successful login navigates to /orders', async () => {
    const user = userEvent.setup();
    const token = fakeJwt({ type: 'customer' });
    api.customerLogin.mockResolvedValue({ token, customer: { name: 'Ada' } });

    renderPage();

    await user.type(screen.getByLabelText('Email or phone number'), 'ada@test.com');
    await user.type(screen.getByLabelText('Password'), 'secretpw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('My Orders Page')).toBeInTheDocument();
    expect(api.customerLogin).toHaveBeenCalledWith('ada@test.com', 'secretpw', 'recaptcha-token');
  });

  test('a failed login shows the server error message', async () => {
    const user = userEvent.setup();
    api.customerLogin.mockRejectedValue(new ApiError('Invalid credentials', 401));

    renderPage();

    await user.type(screen.getByLabelText('Email or phone number'), 'ada@test.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  test('a failed login with a non-ApiError shows the generic fallback message', async () => {
    const user = userEvent.setup();
    api.customerLogin.mockRejectedValue(new Error('boom'));

    renderPage();

    await user.type(screen.getByLabelText('Email or phone number'), 'ada@test.com');
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
