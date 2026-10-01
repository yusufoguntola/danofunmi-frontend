import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminAuthProvider, useAdminAuth } from '../../src/context/AdminAuthContext';
import { api } from '../../src/lib/api';
import { fakeJwt } from '../helpers/fakeJwt';

vi.mock('../../src/lib/api', () => ({
  api: { adminLogin: vi.fn() },
}));

const STORAGE_KEY = 'danofunmi_admin_session';

// A minimal consumer that exercises the context's full surface via buttons/text,
// the same way a real admin page would through useAdminAuth().
function Harness() {
  const { session, login, logout } = useAdminAuth();
  return (
    <div>
      <p data-testid="session">{session ? session.admin.email : 'signed-out'}</p>
      <button onClick={() => login('admin@test.com', 'pw')}>Log in</button>
      <button onClick={() => logout()}>Log out</button>
    </div>
  );
}

function renderHarness() {
  return render(
    <AdminAuthProvider>
      <Harness />
    </AdminAuthProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AdminAuthProvider', () => {
  test('starts signed-out when localStorage has no session', () => {
    renderHarness();
    expect(screen.getByTestId('session')).toHaveTextContent('signed-out');
  });

  test('hydrates from a valid stored session', () => {
    const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { email: 'admin@test.com' } }));

    renderHarness();

    expect(screen.getByTestId('session')).toHaveTextContent('admin@test.com');
  });

  test('drops an already-expired stored session instead of hydrating it', () => {
    const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) - 3600 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { email: 'admin@test.com' } }));

    renderHarness();

    expect(screen.getByTestId('session')).toHaveTextContent('signed-out');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test('ignores unparsable localStorage content rather than throwing', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    renderHarness();
    expect(screen.getByTestId('session')).toHaveTextContent('signed-out');
  });

  test('login stores the session and updates state', async () => {
    const user = userEvent.setup();
    const token = fakeJwt({ type: 'admin' });
    api.adminLogin.mockResolvedValue({ token, admin: { email: 'admin@test.com' } });

    renderHarness();
    await user.click(screen.getByText('Log in'));

    expect(api.adminLogin).toHaveBeenCalledWith('admin@test.com', 'pw');
    expect(screen.getByTestId('session')).toHaveTextContent('admin@test.com');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).admin.email).toBe('admin@test.com');
  });

  test('logout clears the session and localStorage', async () => {
    const user = userEvent.setup();
    const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { email: 'admin@test.com' } }));

    renderHarness();
    expect(screen.getByTestId('session')).toHaveTextContent('admin@test.com');

    await user.click(screen.getByText('Log out'));

    expect(screen.getByTestId('session')).toHaveTextContent('signed-out');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('useAdminAuth', () => {
  test('throws when used outside AdminAuthProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow('useAdminAuth must be used within AdminAuthProvider');
    consoleErrorSpy.mockRestore();
  });
});
