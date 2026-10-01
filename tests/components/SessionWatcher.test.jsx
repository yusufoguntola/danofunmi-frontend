import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SessionWatcher from '../../src/components/SessionWatcher';
import { AdminAuthProvider } from '../../src/context/AdminAuthContext';
import { CustomerAuthProvider } from '../../src/context/CustomerAuthContext';
import { emitSessionExpired } from '../../src/lib/sessionEvents';
import { fakeJwt } from '../helpers/fakeJwt';

const ADMIN_KEY = 'danofunmi_admin_session';
const CUSTOMER_KEY = 'danofunmi_customer_session';
const EXPIRED_FLAG_KEY = 'danofunmi_session_expired';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

function storeAdminSession(expiresInSeconds) {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + expiresInSeconds });
  localStorage.setItem(ADMIN_KEY, JSON.stringify({ token, admin: { email: 'admin@test.com' } }));
}

function storeCustomerSession(expiresInSeconds) {
  const token = fakeJwt({ type: 'customer', exp: Math.floor(Date.now() / 1000) + expiresInSeconds });
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ token, customer: { name: 'Ada' } }));
}

function renderWatcher(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AdminAuthProvider>
        <CustomerAuthProvider>
          <SessionWatcher />
        </CustomerAuthProvider>
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockNavigate.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SessionWatcher — proactive sweep', () => {
  test('logs the admin out and navigates to admin login once their token lapses past the sweep interval', () => {
    const NOW = 1_700_000_000_000;
    vi.useFakeTimers({ now: NOW });
    storeAdminSession(30); // valid for 30s — safely past the 5s clock-skew slack at mount

    renderWatcher('/restricted-path/orders');

    act(() => {
      vi.advanceTimersByTime(40_000); // past expiry (30s) and past one 20s sweep tick
    });

    expect(mockNavigate).toHaveBeenCalledWith('/restricted-path/login', { replace: true, state: { expired: true } });
    expect(localStorage.getItem(ADMIN_KEY)).toBeNull();
    expect(sessionStorage.getItem(EXPIRED_FLAG_KEY)).toBe('admin');
  });
});

describe('SessionWatcher — reactive onSessionExpired', () => {
  test('emitSessionExpired("admin") logs the admin out and redirects away from an admin screen', () => {
    storeAdminSession(3600);
    renderWatcher('/restricted-path/orders');

    act(() => {
      emitSessionExpired('admin');
    });

    expect(mockNavigate).toHaveBeenCalledWith('/restricted-path/login', { replace: true, state: { expired: true } });
    expect(localStorage.getItem(ADMIN_KEY)).toBeNull();
  });

  test('emitSessionExpired("customer") logs the customer out and redirects when on /orders', () => {
    storeCustomerSession(3600);
    renderWatcher('/orders');

    act(() => {
      emitSessionExpired('customer');
    });

    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true, state: { expired: true } });
    expect(localStorage.getItem(CUSTOMER_KEY)).toBeNull();
  });

  test('emitSessionExpired("customer") logs out without navigating when not on /orders', () => {
    storeCustomerSession(3600);
    renderWatcher('/menu');

    act(() => {
      emitSessionExpired('customer');
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(localStorage.getItem(CUSTOMER_KEY)).toBeNull();
  });

  test('a scope-less emitSessionExpired() logs both sessions out when both exist', () => {
    storeAdminSession(3600);
    storeCustomerSession(3600);
    renderWatcher('/restricted-path/orders');

    act(() => {
      emitSessionExpired(null);
    });

    expect(localStorage.getItem(ADMIN_KEY)).toBeNull();
    expect(localStorage.getItem(CUSTOMER_KEY)).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/restricted-path/login', { replace: true, state: { expired: true } });
  });

  test('emitSessionExpired("admin") is a no-op when there is no admin session to expire', () => {
    renderWatcher('/restricted-path/orders');

    act(() => {
      emitSessionExpired('admin');
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
