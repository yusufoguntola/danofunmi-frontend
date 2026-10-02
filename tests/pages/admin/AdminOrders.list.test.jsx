import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminOrders from '../../../src/pages/admin/AdminOrders';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { fakeJwt } from '../../helpers/fakeJwt';

const STORAGE_KEY = 'danofunmi_admin_session';

vi.mock('../../../src/lib/api', () => ({
  api: {
    BASE_URL: 'http://localhost:4000',
    adminListOrders: vi.fn(),
    getLocations: vi.fn(),
    getPaymentInfo: vi.fn(),
    adminGetOrderMonths: vi.fn(),
    adminUpdateOrderStatus: vi.fn(),
    adminUpdateOrderLocation: vi.fn(),
    adminUpdateOrderMonth: vi.fn(),
    adminUpdateReceiptStatus: vi.fn(),
  },
}));

vi.mock('../../../src/lib/confirm', () => ({
  confirmAction: vi.fn(),
  confirmWithSelect: vi.fn(),
  confirmWithInput: vi.fn(),
}));

function seedSession() {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { email: 'admin@test.com' } }));
  return token;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminAuthProvider>
        <AdminOrders />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

function makeOrder(overrides = {}) {
  return {
    id: 'order-1',
    orderNumber: 'ON-1001',
    narration: 'Jollof Combo',
    status: 'CONFIRMED',
    orderMonth: '2026-10',
    statusUpdatedAt: '2026-09-15T09:00:00.000Z',
    createdAt: '2026-09-14T08:00:00.000Z',
    customer: { name: 'Ada Lovelace', phone: '+2348011111111' },
    total: 12000,
    subtotal: 11000,
    logisticsFee: 1000,
    locationId: 'loc1',
    location: { name: 'Lekki' },
    deliveryAddress: '12 Main St',
    landmark: null,
    notes: null,
    riderContact: null,
    splitGroupId: null,
    items: [{ id: 'it1', itemName: 'Jollof Rice', size: '1L', quantity: 2, lineTotal: 9000 }],
    receipts: [],
    ...overrides,
  };
}

const LOCATIONS = [
  { id: 'loc1', name: 'Lekki', logisticsFee: 1000 },
  { id: 'loc2', name: 'Akobo', logisticsFee: 1500 },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.getLocations.mockResolvedValue(LOCATIONS);
  api.getPaymentInfo.mockResolvedValue({
    bankName: 'GTBank',
    accountName: 'Dano Funmi',
    accountNumber: '0123456789',
  });
  api.adminGetOrderMonths.mockResolvedValue(['2026-09', '2026-10']);
});

describe('AdminOrders — list render', () => {
  test('shows a loading state, then the order rows', async () => {
    seedSession();
    api.adminListOrders.mockResolvedValue([makeOrder()]);

    renderPage();

    expect(screen.getByText(/Loading orders/)).toBeInTheDocument();
    const narrationCell = await screen.findByText('ON-1001');
    const row = narrationCell.closest('tr');
    expect(screen.getByText('Jollof Combo')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('+2348011111111')).toBeInTheDocument();
    expect(screen.getByText('₦12,000')).toBeInTheDocument();
    // "CONFIRMED" also appears as a status-filter chip, and "October 2026"
    // also appears as a month-filter <option> — scope both to the row.
    expect(within(row).getByText('CONFIRMED')).toBeInTheDocument();
    expect(within(row).getByText('October 2026')).toBeInTheDocument();
  });

  test('shows an empty state when there are no orders', async () => {
    seedSession();
    api.adminListOrders.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('No orders here yet.')).toBeInTheDocument();
  });

  test('fetches locations, payment info, and available months on mount', async () => {
    const token = seedSession();
    api.adminListOrders.mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(api.getLocations).toHaveBeenCalled());
    expect(api.getPaymentInfo).toHaveBeenCalled();
    expect(api.adminGetOrderMonths).toHaveBeenCalledWith(token);
  });
});

describe('AdminOrders — status-chip filtering', () => {
  test('loads with no status/month filter initially', async () => {
    const token = seedSession();
    api.adminListOrders.mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(api.adminListOrders).toHaveBeenCalledWith(token, undefined, undefined));
  });

  test('clicking a status chip re-loads filtered by that status', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminListOrders.mockResolvedValue([]);

    renderPage();
    await waitFor(() => expect(api.adminListOrders).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'CONFIRMED' }));

    await waitFor(() => expect(api.adminListOrders).toHaveBeenLastCalledWith(token, 'CONFIRMED', undefined));
  });

  test('"All" chip clears the status filter again', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminListOrders.mockResolvedValue([]);

    renderPage();
    await waitFor(() => expect(api.adminListOrders).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'CANCELLED' }));
    await waitFor(() => expect(api.adminListOrders).toHaveBeenLastCalledWith(token, 'CANCELLED', undefined));

    await user.click(screen.getByRole('button', { name: 'All' }));

    await waitFor(() => expect(api.adminListOrders).toHaveBeenLastCalledWith(token, undefined, undefined));
  });
});

describe('AdminOrders — month filtering', () => {
  test('renders fetched months as formatted options and re-loads on selection', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminListOrders.mockResolvedValue([]);

    renderPage();
    await waitFor(() => expect(api.adminGetOrderMonths).toHaveBeenCalled());

    expect(screen.getByRole('option', { name: 'September 2026' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'October 2026' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Month'), '2026-10');

    await waitFor(() => expect(api.adminListOrders).toHaveBeenLastCalledWith(token, undefined, '2026-10'));
  });
});

describe('AdminOrders — row selection / detail panel', () => {
  test('selecting a row opens the detail panel with its items and customer info', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminListOrders.mockResolvedValue([makeOrder()]);

    renderPage();
    await screen.findByText('ON-1001');

    await user.click(screen.getByText('Jollof Combo'));

    expect(screen.getByText('#ON-1001 · Jollof Combo')).toBeInTheDocument();
    expect(screen.getByText(/Jollof Rice/)).toBeInTheDocument();
    expect(screen.getByText(/1L × 2/)).toBeInTheDocument();
    expect(screen.getByText(/12 Main St/)).toBeInTheDocument();
    expect(screen.getByText(/Lekki/)).toBeInTheDocument();
  });

  test('closing the detail panel via the × button clears the selection', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminListOrders.mockResolvedValue([makeOrder()]);

    renderPage();
    await screen.findByText('ON-1001');
    await user.click(screen.getByText('Jollof Combo'));
    expect(screen.getByText('#ON-1001 · Jollof Combo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('#ON-1001 · Jollof Combo')).not.toBeInTheDocument();
  });

  test('shows the "part of a split checkout" note only when splitGroupId is set', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminListOrders.mockResolvedValue([makeOrder({ splitGroupId: 'split-1' })]);

    renderPage();
    await screen.findByText('ON-1001');
    await user.click(screen.getByText('Jollof Combo'));

    expect(screen.getByText(/part of a split checkout/)).toBeInTheDocument();
  });

  test('omits the split-checkout note for a regular order', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminListOrders.mockResolvedValue([makeOrder({ splitGroupId: null })]);

    renderPage();
    await screen.findByText('ON-1001');
    await user.click(screen.getByText('Jollof Combo'));

    expect(screen.queryByText(/part of a split checkout/)).not.toBeInTheDocument();
  });
});
