import { describe, expect, test, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OrderPage from '../../src/pages/OrderPage';
import { api, ApiError } from '../../src/lib/api';
import { db } from '../../src/lib/db';
import { useCustomerAuth } from '../../src/context/CustomerAuthContext';
import { getRecaptchaToken } from '../../src/lib/recaptcha';
import { formatNaira } from '../../src/lib/format';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../src/lib/api', () => ({
  api: {
    getMenu: vi.fn(),
    getLocations: vi.fn(),
    getOrderSchedule: vi.fn(),
    createOrder: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(message, status, body) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
}));

vi.mock('../../src/lib/db', () => ({
  db: {
    cart: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    orderHistory: { put: vi.fn() },
  },
}));

vi.mock('../../src/context/CustomerAuthContext', () => ({
  useCustomerAuth: vi.fn(),
}));

vi.mock('../../src/lib/recaptcha', () => ({
  getRecaptchaToken: vi.fn(),
}));

const menu = [
  {
    id: 'i1',
    type: 'item',
    name: 'Buka Stew',
    category: 'Soups',
    icon: '🍲',
    options: [{ id: 'opt1', size: '1L', price: 4500 }],
  },
];

const locations = [{ id: 'loc1', name: 'Akobo', logisticsFee: 1000 }];

function renderPage() {
  return render(
    <MemoryRouter>
      <OrderPage />
    </MemoryRouter>
  );
}

// Adds one item to the cart and fills in every required delivery-detail
// field with valid values — the common starting point most submit tests
// need before exercising their own specific behavior.
async function fillValidOrder(user) {
  await user.click(await screen.findByRole('button', { name: `1L · ${formatNaira(4500)}` }));
  await user.type(screen.getByLabelText(/Full name/), 'Ada Lovelace');
  await user.type(screen.getByLabelText(/Phone number/), '8012345678');
  await user.type(screen.getByLabelText(/Delivery address/), '12 Allen Ave');
}

function getForm(container) {
  return container.querySelector('form.order-builder');
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getMenu.mockResolvedValue(menu);
  api.getLocations.mockResolvedValue(locations);
  api.getOrderSchedule.mockResolvedValue({ itemOrderMonthLabel: 'October 2026', comboOrderMonthLabel: 'October 2026' });
  db.cart.get.mockResolvedValue(undefined);
  useCustomerAuth.mockReturnValue({ session: null, refresh: vi.fn() });
  getRecaptchaToken.mockResolvedValue(null);
});

describe('OrderPage — submit validation', () => {
  test('shows an error and does not call createOrder when the cart is empty', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await screen.findByText('Buka Stew');
    await user.type(screen.getByLabelText(/Full name/), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/Phone number/), '8012345678');
    await user.type(screen.getByLabelText(/Delivery address/), '12 Allen Ave');

    fireEvent.submit(getForm(container));

    expect(await screen.findByText('Add at least one item to your order.')).toBeInTheDocument();
    expect(api.createOrder).not.toHaveBeenCalled();
  });

  test('shows an error when a required delivery field is missing', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.click(await screen.findByRole('button', { name: `1L · ${formatNaira(4500)}` }));
    // Deliberately leave customerName/phone/address blank.

    fireEvent.submit(getForm(container));

    expect(
      await screen.findByText('Please fill in your name, phone, address, and delivery location.')
    ).toBeInTheDocument();
    expect(api.createOrder).not.toHaveBeenCalled();
  });

  test('shows an error for an invalid Nigerian phone number', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.click(await screen.findByRole('button', { name: `1L · ${formatNaira(4500)}` }));
    await user.type(screen.getByLabelText(/Full name/), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/Phone number/), '1234567890'); // doesn't start 7/8/9
    await user.type(screen.getByLabelText(/Delivery address/), '12 Allen Ave');

    fireEvent.submit(getForm(container));

    expect(
      await screen.findByText('Please enter a valid 10-digit Nigerian phone number.')
    ).toBeInTheDocument();
    expect(api.createOrder).not.toHaveBeenCalled();
  });
});

describe('OrderPage — single-order submit (the common case)', () => {
  test('calls createOrder, clears the draft, saves one order-history row, and navigates to the new order', async () => {
    const user = userEvent.setup();
    const order = { id: 'order-1', narration: 'ON-1 · Ada Lovelace', orderNumber: 'ON-1001' };
    api.createOrder.mockResolvedValue({ orders: [{ order, payment: { bankName: 'GTBank' } }] });

    renderPage();
    await fillValidOrder(user);
    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));

    await waitFor(() => expect(api.createOrder).toHaveBeenCalled());
    const [payload, token] = api.createOrder.mock.calls[0];
    expect(payload).toMatchObject({
      customerName: 'Ada Lovelace',
      customerPhone: '+2348012345678',
      deliveryAddress: '12 Allen Ave',
      locationId: 'loc1',
      items: [{ menuItemOptionId: 'opt1', quantity: 1 }],
      recaptchaToken: null,
    });
    expect(token).toBeUndefined();

    expect(db.cart.delete).toHaveBeenCalledWith('draft');
    expect(db.orderHistory.put).toHaveBeenCalledTimes(1);
    expect(db.orderHistory.put).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', narration: 'ON-1 · Ada Lovelace', orderNumber: 'ON-1001' })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/order/order-1');
  });

  test('passes the signed-in customer token through to createOrder', async () => {
    const user = userEvent.setup();
    useCustomerAuth.mockReturnValue({ session: { token: 'cust-tok' }, refresh: vi.fn().mockResolvedValue(null) });
    const order = { id: 'order-1', narration: 'ON-1', orderNumber: 'ON-1001' };
    api.createOrder.mockResolvedValue({ orders: [{ order, payment: {} }] });

    renderPage();
    await fillValidOrder(user);
    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));

    await waitFor(() => expect(api.createOrder).toHaveBeenCalled());
    expect(api.createOrder.mock.calls[0][1]).toBe('cust-tok');
  });

  test('shows the ApiError message on a failed submit', async () => {
    const user = userEvent.setup();
    api.createOrder.mockRejectedValue(new ApiError('That item just sold out.', 409, null));

    renderPage();
    await fillValidOrder(user);
    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));

    expect(await screen.findByText('That item just sold out.')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('shows a generic fallback message on a non-ApiError submit failure', async () => {
    const user = userEvent.setup();
    api.createOrder.mockRejectedValue(new Error('boom'));

    renderPage();
    await fillValidOrder(user);
    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });
});

describe('OrderPage — split-checkout submit (2-order response)', () => {
  test('saves a db.orderHistory row for BOTH orders, but still navigates to the first order', async () => {
    const user = userEvent.setup();
    const orderA = { id: 'order-A', narration: 'Items batch', orderNumber: 'ON-A' };
    const orderB = { id: 'order-B', narration: 'Combo batch', orderNumber: 'ON-B' };
    api.createOrder.mockResolvedValue({
      orders: [
        { order: orderA, payment: {} },
        { order: orderB, payment: {} },
      ],
    });

    renderPage();
    await fillValidOrder(user);
    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));

    await waitFor(() => expect(db.orderHistory.put).toHaveBeenCalledTimes(2));
    expect(db.orderHistory.put).toHaveBeenNthCalledWith(1, expect.objectContaining({ orderId: 'order-A' }));
    expect(db.orderHistory.put).toHaveBeenNthCalledWith(2, expect.objectContaining({ orderId: 'order-B' }));
    expect(mockNavigate).toHaveBeenCalledWith('/order/order-A');
  });
});

