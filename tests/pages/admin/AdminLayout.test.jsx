import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminLayout from '../../../src/pages/admin/AdminLayout';
import ProtectedRoute from '../../../src/components/ProtectedRoute';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { fakeJwt } from '../../helpers/fakeJwt';

vi.mock('../../../src/lib/api', () => ({
  api: { adminRequestsUnreadCount: vi.fn(), adminInterestUnreadCount: vi.fn() },
}));

const STORAGE_KEY = 'danofunmi_admin_session';

function seedSession() {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { name: 'Ada Admin' } }));
}

function renderLayout({ initialEntries = ['/restricted-path'] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/restricted-path/login" element={<p>Admin Login Page</p>} />
          <Route
            path="/restricted-path"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<p>Orders Content</p>} />
            <Route path="menu" element={<p>Menu Content</p>} />
          </Route>
        </Routes>
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.adminRequestsUnreadCount.mockResolvedValue({ count: 0 });
  api.adminInterestUnreadCount.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AdminLayout', () => {
  test('renders nav chrome, the signed-in admin name, and the routed Outlet content', async () => {
    seedSession();
    renderLayout();

    expect(await screen.findByText('Orders Content')).toBeInTheDocument();
    expect(screen.getByText('Ada Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Customers' })).toBeInTheDocument();
  });

  test('fetches unread counts on mount and shows a badge when a count is > 0', async () => {
    seedSession();
    api.adminRequestsUnreadCount.mockResolvedValue({ count: 3 });
    api.adminInterestUnreadCount.mockResolvedValue({ count: 0 });

    renderLayout();

    const requestsLink = await screen.findByRole('link', { name: /Requests/ });
    expect(requestsLink).toHaveTextContent('3');
  });

  test('shows no badge when the unread count is 0', async () => {
    seedSession();
    renderLayout();
    await screen.findByText('Orders Content');

    const requestsLink = screen.getByRole('link', { name: /Requests/ });
    expect(requestsLink.textContent).toBe('Requests');
  });

  test('polls unread counts again every 30s', async () => {
    vi.useFakeTimers();
    seedSession();

    renderLayout();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.adminRequestsUnreadCount).toHaveBeenCalledTimes(1);
    expect(api.adminInterestUnreadCount).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(api.adminRequestsUnreadCount).toHaveBeenCalledTimes(2);
    expect(api.adminInterestUnreadCount).toHaveBeenCalledTimes(2);
  });

  test('clicking Log out clears the session and navigates to the admin login route', async () => {
    const user = userEvent.setup();
    seedSession();
    renderLayout();
    await screen.findByText('Orders Content');

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByText('Admin Login Page')).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
