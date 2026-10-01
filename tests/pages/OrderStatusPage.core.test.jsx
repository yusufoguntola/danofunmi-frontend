import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OrderStatusPage from '../../src/pages/OrderStatusPage';
import { api, ApiError, bustOrderCache } from '../../src/lib/api';
import { pushSupported, subscribeToPush } from '../../src/lib/push';
import { confirmAction } from '../../src/lib/confirm';
import { useCustomerAuth } from '../../src/context/CustomerAuthContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../src/lib/api', () => ({
  api: {
    getOrder: vi.fn(),
    getPaymentInfo: vi.fn(),
    cancelOrder: vi.fn(),
    uploadReceipt: vi.fn(),
    submitPaymentDetails: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(message, status, body) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
  bustOrderCache: vi.fn(),
}));

vi.mock('../../src/lib/push', () => ({
  pushSupported: vi.fn(),
  subscribeToPush: vi.fn(),
}));

vi.mock('../../src/lib/confirm', () => ({
  confirmAction: vi.fn(),
}));

vi.mock('../../src/context/CustomerAuthContext', () => ({
  useCustomerAuth: vi.fn(),
}));

const baseOrder = {
  id: 'order-1',
  orderNumber: 'ON-1001',
  narration: 'Jollof Combo',
  status: 'PENDING_PAYMENT',
  orderMonth: null,
  siblingOrders: [],
  items: [{ id: 'it1', itemName: 'Jollof Rice', size: '1L', quantity: 2, lineTotal: 9000 }],
  subtotal: 9000,
  logisticsFee: 1000,
  total: 10000,
  location: { name: 'Akobo' },
  customer: { name: 'Ada', phone: '+2348012345678' },
  deliveryAddress: '123 Street',
  landmark: null,
  notes: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  receipts: [],
};

function renderPage(path = '/order/order-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/order/:id" element={<OrderStatusPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getPaymentInfo.mockResolvedValue({
    bankName: 'GTBank',
    accountName: 'Dano Funmi',
    accountNumber: '0123456789',
    maxReceiptFileSizeKB: 2000,
  });
  pushSupported.mockReturnValue(false);
  useCustomerAuth.mockReturnValue({ session: { token: 'cust-tok' } });
});

describe('OrderStatusPage — load/display', () => {
  test('shows a loading state, then the order number, narration, and status badge', async () => {
    api.getOrder.mockResolvedValue(baseOrder);
    renderPage();

    expect(screen.getByText(/Loading your order/)).toBeInTheDocument();
    expect(await screen.findByText('Order #ON-1001')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Jollof Combo' })).toBeInTheDocument();
    expect(document.querySelector('.badge')).toHaveTextContent('PENDING PAYMENT');
  });

  test('shows an error message instead of the order on a failed fetch', async () => {
    api.getOrder.mockRejectedValue(new ApiError('Order not found', 404, null));
    renderPage();

    expect(await screen.findByText('Order not found')).toBeInTheDocument();
  });
});

describe('OrderStatusPage — schedule/split banner', () => {
  test('shows just the month line for a single order with no siblings', async () => {
    api.getOrder.mockResolvedValue({ ...baseOrder, orderMonth: '2026-10', siblingOrders: [] });
    renderPage();

    expect(await screen.findByText(/Scheduled for/)).toBeInTheDocument();
    expect(screen.getByText('October 2026')).toBeInTheDocument();
    expect(screen.queryByText(/split across two deliveries/)).not.toBeInTheDocument();
  });

  test('is absent entirely when the order has no orderMonth', async () => {
    api.getOrder.mockResolvedValue({ ...baseOrder, orderMonth: null });
    renderPage();

    await screen.findByText('Order #ON-1001');
    expect(screen.queryByText(/Scheduled for/)).not.toBeInTheDocument();
  });

  test('shows sibling links with correct hrefs and labels for a split order', async () => {
    api.getOrder.mockResolvedValue({
      ...baseOrder,
      orderMonth: '2026-10',
      siblingOrders: [{ id: 'order-2', narration: 'Combo Deal', orderMonth: '2026-11' }],
    });
    renderPage();

    await screen.findByText(/Scheduled for/);
    const banner = screen.getByText(/split across two deliveries/).closest('p');
    const siblingLink = screen.getByRole('link', { name: 'Combo Deal' });
    expect(siblingLink).toHaveAttribute('href', '/order/order-2');
    expect(banner).toHaveTextContent('November 2026');
  });

  test('pluralizes "deliveries" note for more than one sibling', async () => {
    api.getOrder.mockResolvedValue({
      ...baseOrder,
      orderMonth: '2026-10',
      siblingOrders: [
        { id: 'order-2', narration: 'Combo Deal', orderMonth: '2026-11' },
        { id: 'order-3', narration: 'Extra Items', orderMonth: '2026-11' },
      ],
    });
    renderPage();

    await screen.findByText(/Scheduled for/);
    expect(screen.getByText(/the other orders:/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Combo Deal' })).toHaveAttribute('href', '/order/order-2');
    expect(screen.getByRole('link', { name: 'Extra Items' })).toHaveAttribute('href', '/order/order-3');
  });
});

describe('OrderStatusPage — status step track', () => {
  test('marks only the first step done for PENDING_PAYMENT', async () => {
    api.getOrder.mockResolvedValue({ ...baseOrder, status: 'PENDING_PAYMENT' });
    renderPage();

    await screen.findByText('Order #ON-1001');
    const steps = screen.getAllByRole('listitem').filter((li) => li.className.includes('status-track__step'));
    expect(steps[0]).toHaveClass('is-done');
    expect(steps[1]).not.toHaveClass('is-done');
    expect(steps[steps.length - 1]).not.toHaveClass('is-done');
  });

  test('marks steps up to and including the current one done for a mid-flow status', async () => {
    api.getOrder.mockResolvedValue({ ...baseOrder, status: 'CONFIRMED' });
    renderPage();

    await screen.findByText('Order #ON-1001');
    const steps = screen.getAllByRole('listitem').filter((li) => li.className.includes('status-track__step'));
    // STEPS = [PENDING_PAYMENT, PAYMENT_SUBMITTED, CONFIRMED, PACKED, OUT_FOR_DELIVERY, DELIVERED]
    expect(steps[0]).toHaveClass('is-done');
    expect(steps[1]).toHaveClass('is-done');
    expect(steps[2]).toHaveClass('is-done');
    expect(steps[3]).not.toHaveClass('is-done');
  });

  test('is not rendered at all for a cancelled order', async () => {
    api.getOrder.mockResolvedValue({ ...baseOrder, status: 'CANCELLED' });
    const { container } = renderPage();

    await screen.findByText('Order #ON-1001');
    expect(container.querySelector('.status-track')).not.toBeInTheDocument();
  });
});

describe('OrderStatusPage — cancel order flow', () => {
  test('shows the cancel button only for PENDING_PAYMENT', async () => {
    api.getOrder.mockResolvedValue({ ...baseOrder, status: 'CONFIRMED' });
    renderPage();

    await screen.findByText('Order #ON-1001');
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  test('does nothing if the confirm dialog is dismissed', async () => {
    const user = userEvent.setup();
    api.getOrder.mockResolvedValue(baseOrder);
    confirmAction.mockResolvedValue(false);
    renderPage();

    await screen.findByText('Order #ON-1001');
    await user.click(screen.getByRole('button', { name: 'Cancel order' }));

    await waitFor(() => expect(confirmAction).toHaveBeenCalled());
    expect(api.cancelOrder).not.toHaveBeenCalled();
  });

  test('confirming cancels the order, busts the cache, and reloads it', async () => {
    const user = userEvent.setup();
    api.getOrder.mockResolvedValue(baseOrder);
    confirmAction.mockResolvedValue(true);
    api.cancelOrder.mockResolvedValue({});
    renderPage();

    await screen.findByText('Order #ON-1001');
    await user.click(screen.getByRole('button', { name: 'Cancel order' }));

    await waitFor(() => expect(api.cancelOrder).toHaveBeenCalledWith('order-1'));
    expect(bustOrderCache).toHaveBeenCalledWith('order-1');
    await waitFor(() => expect(api.getOrder).toHaveBeenCalledTimes(2));
  });
});

describe('OrderStatusPage — push notification prompt', () => {
  test('is hidden when push is unsupported', async () => {
    pushSupported.mockReturnValue(false);
    api.getOrder.mockResolvedValue(baseOrder);
    renderPage();

    await screen.findByText('Order #ON-1001');
    expect(screen.queryByText(/Get notified here/)).not.toBeInTheDocument();
  });

  test('enabling it calls subscribeToPush with the order customer phone and dismisses the prompt', async () => {
    const user = userEvent.setup();
    const originalNotification = global.Notification;
    global.Notification = { permission: 'default' };
    pushSupported.mockReturnValue(true);
    api.getOrder.mockResolvedValue(baseOrder);
    subscribeToPush.mockResolvedValue(true);
    renderPage();

    expect(await screen.findByText(/Get notified here/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enable' }));

    await waitFor(() => expect(subscribeToPush).toHaveBeenCalledWith('+2348012345678'));
    expect(screen.queryByText(/Get notified here/)).not.toBeInTheDocument();

    global.Notification = originalNotification;
  });
});

describe('OrderStatusPage — signed-out account prompt', () => {
  test('shows "Create an account" when signed out', async () => {
    useCustomerAuth.mockReturnValue({ session: null });
    api.getOrder.mockResolvedValue(baseOrder);
    renderPage();

    expect(await screen.findByText('Create an account')).toBeInTheDocument();
  });

  test('is hidden when already signed in', async () => {
    useCustomerAuth.mockReturnValue({ session: { token: 'cust-tok' } });
    api.getOrder.mockResolvedValue(baseOrder);
    renderPage();

    await screen.findByText('Order #ON-1001');
    expect(screen.queryByText('Create an account')).not.toBeInTheDocument();
  });
});
