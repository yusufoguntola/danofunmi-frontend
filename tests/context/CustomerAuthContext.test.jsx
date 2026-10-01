import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerAuthProvider, useCustomerAuth } from '../../src/context/CustomerAuthContext';
import { api } from '../../src/lib/api';
import { fakeJwt } from '../helpers/fakeJwt';

vi.mock('../../src/lib/api', () => ({
  api: {
    customerSignup: vi.fn(),
    customerLogin: vi.fn(),
    customerGoogleLogin: vi.fn(),
    getCustomerProfile: vi.fn(),
  },
}));

const STORAGE_KEY = 'danofunmi_customer_session';

// A minimal consumer exercising the context's full surface via buttons/text,
// the same approach as AdminAuthContext.test.jsx's Harness.
function Harness() {
  const { session, signup, login, loginWithGoogle, logout, refresh } = useCustomerAuth();
  return (
    <div>
      <p data-testid="session">{session ? session.customer?.name : 'signed-out'}</p>
      <button onClick={() => signup({ name: 'Ada', email: 'ada@test.com', phone: '08011112222', password: 'pw' })}>
        Sign up
      </button>
      <button onClick={() => login('ada@test.com', 'pw')}>Log in</button>
      <button onClick={() => loginWithGoogle('google-credential')}>Google</button>
      <button onClick={() => logout()}>Log out</button>
      <button onClick={() => refresh()}>Refresh</button>
    </div>
  );
}

function renderHarness() {
  return render(
    <CustomerAuthProvider>
      <Harness />
    </CustomerAuthProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('CustomerAuthProvider', () => {
  test('starts signed-out when localStorage has no session', () => {
    renderHarness();
    expect(screen.getByTestId('session')).toHaveTextContent('signed-out');
  });

  test('hydrates from a valid stored session', () => {
    const token = fakeJwt({ type: 'customer', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, customer: { name: 'Ada' } }));

    renderHarness();

    expect(screen.getByTestId('session')).toHaveTextContent('Ada');
  });

  test('drops an already-expired stored session instead of hydrating it', () => {
    const token = fakeJwt({ type: 'customer', exp: Math.floor(Date.now() / 1000) - 3600 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, customer: { name: 'Ada' } }));

    renderHarness();

    expect(screen.getByTestId('session')).toHaveTextContent('signed-out');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test('ignores unparsable localStorage content rather than throwing', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    renderHarness();
    expect(screen.getByTestId('session')).toHaveTextContent('signed-out');
  });

  test('signup stores the session and updates state', async () => {
    const user = userEvent.setup();
    const token = fakeJwt({ type: 'customer' });
    api.customerSignup.mockResolvedValue({ token, customer: { name: 'Ada' } });

    renderHarness();
    await user.click(screen.getByText('Sign up'));

    expect(api.customerSignup).toHaveBeenCalledWith({
      name: 'Ada',
      email: 'ada@test.com',
      phone: '08011112222',
      password: 'pw',
      recaptchaToken: undefined,
    });
    expect(screen.getByTestId('session')).toHaveTextContent('Ada');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).customer.name).toBe('Ada');
  });

  test('login stores the session and updates state', async () => {
    const user = userEvent.setup();
    const token = fakeJwt({ type: 'customer' });
    api.customerLogin.mockResolvedValue({ token, customer: { name: 'Ada' } });

    renderHarness();
    await user.click(screen.getByText('Log in'));

    expect(api.customerLogin).toHaveBeenCalledWith('ada@test.com', 'pw', undefined);
    expect(screen.getByTestId('session')).toHaveTextContent('Ada');
  });

  test('loginWithGoogle stores the session and updates state', async () => {
    const user = userEvent.setup();
    const token = fakeJwt({ type: 'customer' });
    api.customerGoogleLogin.mockResolvedValue({ token, customer: { name: 'Gina' } });

    renderHarness();
    await user.click(screen.getByText('Google'));

    expect(api.customerGoogleLogin).toHaveBeenCalledWith('google-credential');
    expect(screen.getByTestId('session')).toHaveTextContent('Gina');
  });

  test('logout clears the session and localStorage', async () => {
    const user = userEvent.setup();
    const token = fakeJwt({ type: 'customer', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, customer: { name: 'Ada' } }));

    renderHarness();
    expect(screen.getByTestId('session')).toHaveTextContent('Ada');

    await user.click(screen.getByText('Log out'));

    expect(screen.getByTestId('session')).toHaveTextContent('signed-out');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  describe('refresh', () => {
    test('is a no-op when signed out', async () => {
      const user = userEvent.setup();
      renderHarness();

      await user.click(screen.getByText('Refresh'));

      expect(api.getCustomerProfile).not.toHaveBeenCalled();
      expect(screen.getByTestId('session')).toHaveTextContent('signed-out');
    });

    test('re-fetches the profile and re-persists the updated session', async () => {
      const user = userEvent.setup();
      const token = fakeJwt({ type: 'customer', exp: Math.floor(Date.now() / 1000) + 3600 });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, customer: { name: 'Ada' } }));
      api.getCustomerProfile.mockResolvedValue({ name: 'Ada Updated', phone: '08099998888' });

      renderHarness();
      await user.click(screen.getByText('Refresh'));

      expect(api.getCustomerProfile).toHaveBeenCalledWith(token);
      expect(await screen.findByText('Ada Updated')).toBeInTheDocument();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored.token).toBe(token);
      expect(stored.customer.name).toBe('Ada Updated');
    });

    test('swallows a failed refresh (e.g. expired token) and leaves the session untouched', async () => {
      const user = userEvent.setup();
      const token = fakeJwt({ type: 'customer', exp: Math.floor(Date.now() / 1000) + 3600 });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, customer: { name: 'Ada' } }));
      api.getCustomerProfile.mockRejectedValue(new Error('401'));

      renderHarness();
      await user.click(screen.getByText('Refresh'));

      await vi.waitFor(() => expect(api.getCustomerProfile).toHaveBeenCalled());
      expect(screen.getByTestId('session')).toHaveTextContent('Ada');
    });
  });
});

describe('useCustomerAuth', () => {
  test('throws when used outside CustomerAuthProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow('useCustomerAuth must be used within CustomerAuthProvider');
    consoleErrorSpy.mockRestore();
  });
});
