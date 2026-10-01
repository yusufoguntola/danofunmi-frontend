import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SignupPage from '../../src/pages/SignupPage';
import { CustomerAuthProvider } from '../../src/context/CustomerAuthContext';
import { api, ApiError } from '../../src/lib/api';
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
    api: { customerSignup: vi.fn(), customerGoogleLogin: vi.fn() },
    ApiError,
  };
});

vi.mock('../../src/lib/recaptcha', () => ({ getRecaptchaToken: vi.fn() }));

const STORAGE_KEY = 'danofunmi_customer_session';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <CustomerAuthProvider>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
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
  window.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
});

afterEach(() => {
  delete window.google;
});

describe('SignupPage', () => {
  test('redirects to /orders when already signed in', () => {
    const token = fakeJwt({ type: 'customer', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, customer: { name: 'Ada' } }));

    renderPage();

    expect(screen.getByText('My Orders Page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create your account' })).not.toBeInTheDocument();
  });

  // NigerianPhoneInput carries a `pattern` attribute mirroring the same
  // 10-digit-starting-7/8/9 rule as isValidNigerianPhone, so jsdom's native
  // constraint validation already blocks a real button click when the phone
  // is incomplete/empty — fireEvent.submit bypasses that native layer so we
  // can exercise SignupPage's own isValidNigerianPhone check and its error
  // message directly, the same way a phone value reaching handleSubmit any
  // other way (e.g. future prefilled state) would.
  test('validation blocks submit with an invalid/incomplete phone and shows an error', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.type(screen.getByLabelText('Full name'), 'Ada Eze');
    await user.type(screen.getByLabelText('Email'), 'ada@test.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.type(screen.getByLabelText('Phone number'), '801'); // incomplete

    fireEvent.submit(container.querySelector('form'));

    expect(await screen.findByText('Please enter a valid 10-digit Nigerian phone number.')).toBeInTheDocument();
    expect(api.customerSignup).not.toHaveBeenCalled();
  });

  test('a valid submission calls signup with the right shape and navigates to /orders', async () => {
    const user = userEvent.setup();
    const token = fakeJwt({ type: 'customer' });
    api.customerSignup.mockResolvedValue({ token, customer: { name: 'Ada Eze' } });

    renderPage();

    await user.type(screen.getByLabelText('Full name'), 'Ada Eze');
    await user.type(screen.getByLabelText('Email'), 'ada@test.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.type(screen.getByLabelText('Phone number'), '8012345678');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('My Orders Page')).toBeInTheDocument();
    expect(api.customerSignup).toHaveBeenCalledWith({
      name: 'Ada Eze',
      email: 'ada@test.com',
      phone: '+2348012345678',
      password: 'supersecret',
      recaptchaToken: 'recaptcha-token',
    });
  });

  test('a signup failure (e.g. phone already registered) shows the server error message', async () => {
    const user = userEvent.setup();
    api.customerSignup.mockRejectedValue(new ApiError('Phone number already registered', 409));

    renderPage();

    await user.type(screen.getByLabelText('Full name'), 'Ada Eze');
    await user.type(screen.getByLabelText('Email'), 'ada@test.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.type(screen.getByLabelText('Phone number'), '8012345678');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Phone number already registered')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
  });

  test('a signup failure with a non-ApiError shows the generic fallback message', async () => {
    const user = userEvent.setup();
    api.customerSignup.mockRejectedValue(new Error('boom'));

    renderPage();

    await user.type(screen.getByLabelText('Full name'), 'Ada Eze');
    await user.type(screen.getByLabelText('Email'), 'ada@test.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.type(screen.getByLabelText('Phone number'), '8012345678');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Could not create your account.')).toBeInTheDocument();
  });
});
