import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MyOrdersPage from '../../src/pages/MyOrdersPage';
import { CustomerAuthProvider } from '../../src/context/CustomerAuthContext';
import { api } from '../../src/lib/api';
import { fakeJwt } from '../helpers/fakeJwt';

vi.mock('../../src/lib/api', () => ({
  api: { getCustomerOrders: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

const STORAGE_KEY = 'danofunmi_customer_session';

function signIn() {
  const token = fakeJwt({ type: 'customer', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, customer: { name: 'Ada Eze' } }));
  return token;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CustomerAuthProvider>
        <MyOrdersPage />
      </CustomerAuthProvider>
    </MemoryRouter>
  );
}

const ORDERS = [
  { id: 'o1', orderNumber: 'DFM-001', narration: 'DFM-AAAAAA', status: 'PENDING_PAYMENT', total: 5000, createdAt: '2026-09-01T00:00:00.000Z' },
  { id: 'o2', orderNumber: 'DFM-002', narration: 'DFM-BBBBBB', status: 'DELIVERED', total: 7000, createdAt: '2026-09-05T00:00:00.000Z' },
  { id: 'o3', orderNumber: 'DFM-003', narration: 'DFM-CCCCCC', status: 'CANCELLED', total: 3000, createdAt: '2026-09-10T00:00:00.000Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('MyOrdersPage — signed out', () => {
  test('shows the signed-out CTA and never calls getCustomerOrders', () => {
    renderPage();

    expect(screen.getByText('Create an account to see your orders')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(api.getCustomerOrders).not.toHaveBeenCalled();
  });

  test('the track-by-narration box still works and navigates to the order', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Track an order'), 'DFM-AAAAAA');
    await user.click(screen.getByRole('button', { name: 'Track' }));

    expect(mockNavigate).toHaveBeenCalledWith('/order/DFM-AAAAAA');
  });

  test('tracking with a blank value shows a validation error instead of navigating', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Track' }));

    expect(await screen.findByText('Enter an order narration (DFM-XXXXXX) or order number.')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('MyOrdersPage — signed in', () => {
  test('fetches and renders orders, defaulting to the Open tab', async () => {
    signIn();
    api.getCustomerOrders.mockResolvedValue(ORDERS);

    renderPage();

    expect(await screen.findByText('DFM-001')).toBeInTheDocument();
    expect(screen.queryByText('DFM-002')).not.toBeInTheDocument();
    expect(screen.queryByText('DFM-003')).not.toBeInTheDocument();
    expect(api.getCustomerOrders).toHaveBeenCalledWith(expect.any(String));
  });

  test('switching tabs filters by status (Completed, Canceled, All)', async () => {
    signIn();
    api.getCustomerOrders.mockResolvedValue(ORDERS);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('DFM-001');

    await user.click(screen.getByRole('button', { name: 'Completed' }));
    expect(screen.getByText('DFM-002')).toBeInTheDocument();
    expect(screen.queryByText('DFM-001')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Canceled' }));
    expect(screen.getByText('DFM-003')).toBeInTheDocument();
    expect(screen.queryByText('DFM-002')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('DFM-001')).toBeInTheDocument();
    expect(screen.getByText('DFM-002')).toBeInTheDocument();
    expect(screen.getByText('DFM-003')).toBeInTheDocument();
  });

  test('shows the empty state when the account has no orders at all', async () => {
    signIn();
    api.getCustomerOrders.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No orders yet — once you place one, it'll show up here.")).toBeInTheDocument();
  });

  test('shows a per-tab empty message when orders exist but none match the active tab', async () => {
    signIn();
    api.getCustomerOrders.mockResolvedValue([ORDERS[1]]); // only a DELIVERED order
    renderPage();

    expect(await screen.findByText('Nothing in this tab yet.')).toBeInTheDocument();
  });

  test('shows a loading state before the fetch resolves', () => {
    signIn();
    api.getCustomerOrders.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('the Track link on a row points at that order', async () => {
    signIn();
    api.getCustomerOrders.mockResolvedValue(ORDERS);

    renderPage();
    await screen.findByText('DFM-001');

    expect(screen.getByRole('link', { name: 'Track' })).toHaveAttribute('href', '/order/o1');
  });
});
