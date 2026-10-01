import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminCustomerDetail from '../../../src/pages/admin/AdminCustomerDetail';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { fakeJwt } from '../../helpers/fakeJwt';

const STORAGE_KEY = 'danofunmi_admin_session';

vi.mock('../../../src/lib/api', () => ({
  api: { adminGetCustomer: vi.fn() },
}));

function seedSession() {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { email: 'admin@test.com' } }));
  return token;
}

function renderPage(id = 'cust1') {
  return render(
    <MemoryRouter initialEntries={[`/restricted-path/customers/${id}`]}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/restricted-path/customers/:id" element={<AdminCustomerDetail />} />
        </Routes>
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

function fullData(overrides = {}) {
  return {
    customer: {
      id: 'cust1',
      name: 'Jane Doe',
      phone: '08011111111',
      email: 'jane@example.com',
      address: '12 Marina Street',
      landmark: 'Near the big mosque',
      createdAt: '2026-01-01T00:00:00Z',
    },
    orders: [
      {
        id: 'o1',
        orderNumber: 'ORD-1',
        narration: 'Jollof + chicken',
        total: 5000,
        status: 'DELIVERED',
        createdAt: '2026-02-01T00:00:00Z',
      },
    ],
    feedback: [
      {
        id: 'f1',
        createdAt: '2026-02-02T00:00:00Z',
        rating: 4,
        comment: 'Great food!',
        order: { narration: 'Jollof + chicken' },
      },
    ],
    requests: [
      {
        id: 'r1',
        createdAt: '2026-02-03T00:00:00Z',
        requestType: 'item_request',
        message: 'More pepper please',
        orderNarration: 'Jollof + chicken',
      },
    ],
    whatsappMessages: [
      { id: 'w1', createdAt: '2026-02-04T00:00:00Z', direction: 'inbound', body: 'Hi there' },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AdminCustomerDetail', () => {
  test('shows a loading state before the fetch resolves', () => {
    seedSession();
    api.adminGetCustomer.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('renders the customer header info from the single fetch', async () => {
    const token = seedSession();
    api.adminGetCustomer.mockResolvedValue(fullData());

    renderPage('cust1');

    expect(await screen.findByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();
    expect(api.adminGetCustomer).toHaveBeenCalledWith(token, 'cust1');
    expect(screen.getByText('08011111111')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('12 Marina Street')).toBeInTheDocument();
    expect(screen.getByText('Near the big mosque')).toBeInTheDocument();
    expect(screen.getByText(/1 · ₦5,000/)).toBeInTheDocument();
  });

  test('shows a dash for missing optional fields', async () => {
    seedSession();
    api.adminGetCustomer.mockResolvedValue(
      fullData({ customer: { ...fullData().customer, phone: '', email: '', address: '', landmark: '' } })
    );

    renderPage();

    await screen.findByRole('heading', { name: 'Jane Doe' });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });

  test('shows an error state when the fetch fails', async () => {
    seedSession();
    api.adminGetCustomer.mockRejectedValue(new Error('Customer not found'));

    renderPage();

    expect(await screen.findByText('Customer not found')).toBeInTheDocument();
  });

  test('defaults to the Orders tab, showing order rows', async () => {
    seedSession();
    api.adminGetCustomer.mockResolvedValue(fullData());

    renderPage();

    expect(await screen.findByText('ORD-1')).toBeInTheDocument();
    expect(screen.getByText('Jollof + chicken')).toBeInTheDocument();
  });

  test('switching to the Feedback tab shows feedback rows with star ratings', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetCustomer.mockResolvedValue(fullData());

    renderPage();
    await screen.findByText('ORD-1');

    await user.click(screen.getByRole('button', { name: 'Feedback' }));

    expect(screen.getByText('Great food!')).toBeInTheDocument();
    expect(screen.getByLabelText('4 out of 5')).toBeInTheDocument();
    // Orders tab content is no longer shown
    expect(screen.queryByText('ORD-1')).not.toBeInTheDocument();
  });

  test('switching to the Requests tab shows request rows', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetCustomer.mockResolvedValue(fullData());

    renderPage();
    await screen.findByText('ORD-1');

    await user.click(screen.getByRole('button', { name: 'Requests' }));

    expect(screen.getByText('More pepper please')).toBeInTheDocument();
    expect(screen.getByText('item_request')).toBeInTheDocument();
  });

  test('switching to the WhatsApp tab shows message rows', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetCustomer.mockResolvedValue(fullData());

    renderPage();
    await screen.findByText('ORD-1');

    await user.click(screen.getByRole('button', { name: 'WhatsApp' }));

    expect(screen.getByText('Hi there')).toBeInTheDocument();
    expect(screen.getByText('inbound')).toBeInTheDocument();
  });

  test('shows an empty state per tab when its data array is empty', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetCustomer.mockResolvedValue(
      fullData({ orders: [], feedback: [], requests: [], whatsappMessages: [] })
    );

    renderPage();
    expect(await screen.findByText('No orders yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Feedback' }));
    expect(screen.getByText('No feedback left yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Requests' }));
    expect(screen.getByText('No chat requests logged.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(screen.getByText('No WhatsApp messages.')).toBeInTheDocument();
  });
});
