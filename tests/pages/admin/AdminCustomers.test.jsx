import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminCustomers from '../../../src/pages/admin/AdminCustomers';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { fakeJwt } from '../../helpers/fakeJwt';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../src/lib/api', () => ({
  api: { adminListCustomers: vi.fn() },
}));

const STORAGE_KEY = 'danofunmi_admin_session';

function seedSession() {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { name: 'Ada Admin' } }));
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminAuthProvider>
        <AdminCustomers />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

function makeCustomers(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i + 1}`,
    name: `Customer ${i + 1}`,
    phone: `080000000${i}`,
    email: `customer${i + 1}@test.com`,
    orderCount: i,
    createdAt: '2026-01-01T00:00:00.000Z',
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  seedSession();
});

describe('AdminCustomers', () => {
  test('fetches and renders the customer list', async () => {
    api.adminListCustomers.mockResolvedValue(makeCustomers(2));

    renderPage();

    expect(await screen.findByText('Customer 1')).toBeInTheDocument();
    expect(screen.getByText('Customer 2')).toBeInTheDocument();
    expect(screen.getByText('2 total.', { exact: false })).toBeInTheDocument();
  });

  test('shows the empty state when there are no customers', async () => {
    api.adminListCustomers.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No customers yet.')).toBeInTheDocument();
  });

  test('search filters by name, phone, or email, case-insensitively', async () => {
    const user = userEvent.setup();
    api.adminListCustomers.mockResolvedValue([
      { id: 'c1', name: 'Ada Lovelace', phone: '08011112222', email: 'ada@test.com', orderCount: 1, createdAt: '2026-01-01' },
      { id: 'c2', name: 'Bisi Johnson', phone: '08033334444', email: 'bisi@test.com', orderCount: 2, createdAt: '2026-01-02' },
    ]);

    renderPage();
    await screen.findByText('Ada Lovelace');

    await user.type(screen.getByPlaceholderText(/Search by name/), 'ADA');

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByText('Bisi Johnson')).not.toBeInTheDocument();
  });

  test('search with no matches shows the "no match" message', async () => {
    const user = userEvent.setup();
    api.adminListCustomers.mockResolvedValue(makeCustomers(1));

    renderPage();
    await screen.findByText('Customer 1');

    await user.type(screen.getByPlaceholderText(/Search by name/), 'nonexistent');

    expect(screen.getByText('No customers match your search.')).toBeInTheDocument();
  });

  test('clicking a row navigates to that customer’s detail page', async () => {
    const user = userEvent.setup();
    api.adminListCustomers.mockResolvedValue(makeCustomers(1));

    renderPage();
    const row = await screen.findByText('Customer 1');

    await user.click(row);

    expect(mockNavigate).toHaveBeenCalledWith('/restricted-path/customers/c1');
  });

  test('paginates: only the first page is shown, and Next reveals the rest', async () => {
    const user = userEvent.setup();
    api.adminListCustomers.mockResolvedValue(makeCustomers(12));

    renderPage();
    await screen.findByText('Customer 1');

    expect(screen.getByText('Customer 10')).toBeInTheDocument();
    expect(screen.queryByText('Customer 11')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Customer 11')).toBeInTheDocument();
    expect(screen.queryByText('Customer 1')).not.toBeInTheDocument();
  });
});
