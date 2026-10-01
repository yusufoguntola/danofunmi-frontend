import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrderPage from '../../src/pages/OrderPage';
import { api } from '../../src/lib/api';
import { db } from '../../src/lib/db';
import { useCustomerAuth } from '../../src/context/CustomerAuthContext';

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

const locations = [
  { id: 'loc1', name: 'Akobo', logisticsFee: 1000 },
  { id: 'loc2', name: 'Bodija', logisticsFee: 1500 },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <OrderPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getMenu.mockResolvedValue(menu);
  api.getLocations.mockResolvedValue(locations);
  api.getOrderSchedule.mockResolvedValue({ itemOrderMonthLabel: 'October 2026', comboOrderMonthLabel: 'October 2026' });
  db.cart.get.mockResolvedValue(undefined);
  useCustomerAuth.mockReturnValue({ session: null, refresh: vi.fn() });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('OrderPage — draft hydration', () => {
  test('hydrates the cart and delivery-detail fields from a saved draft', async () => {
    db.cart.get.mockResolvedValue({
      items: [{ optionId: 'opt1', itemName: 'Buka Stew', size: '1L', unitPrice: 4500, quantity: 3 }],
      customerName: 'Zee Draft',
      customerPhone: '+2348099998888',
      deliveryAddress: '45 Draft Street',
      landmark: 'Near the draft mall',
      locationId: 'loc2',
      notes: 'Leave with security',
    });

    renderPage();

    expect(await screen.findByDisplayValue('Zee Draft')).toBeInTheDocument();
    expect(screen.getByDisplayValue('45 Draft Street')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Near the draft mall')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Leave with security')).toBeInTheDocument();
    expect(screen.getByLabelText('Delivery location')).toHaveValue('loc2');
    const cartList = document.querySelector('.cart-list');
    expect(cartList).toHaveTextContent('Buka Stew');
    expect(cartList).toHaveTextContent('3');
  });

  test('falls back to the first location when the draft has no locationId', async () => {
    db.cart.get.mockResolvedValue({
      items: [],
      customerName: 'Zee Draft',
      customerPhone: '',
      deliveryAddress: '',
      landmark: '',
      notes: '',
    });

    renderPage();

    expect(await screen.findByDisplayValue('Zee Draft')).toBeInTheDocument();
    expect(screen.getByLabelText('Delivery location')).toHaveValue('loc1');
  });
});

describe('OrderPage — debounced autosave', () => {
  test('saves the cart/form to db.cart.put only after the debounce delay elapses', async () => {
    renderPage();
    await screen.findByText('Buka Stew');

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Ada' } });

    expect(db.cart.put).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(db.cart.put).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(db.cart.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'draft', customerName: 'Ada' })
    );
  });

  test('deletes the draft instead of saving when the form/cart become empty', async () => {
    renderPage();
    await screen.findByText('Buka Stew');

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Ada' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(db.cart.put).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: '' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(db.cart.delete).toHaveBeenCalledWith('draft');
  });

  test('never autosaves before the initial draft/menu load has resolved (gated by draftRestored)', async () => {
    vi.useFakeTimers();
    db.cart.get.mockReturnValue(new Promise(() => {})); // load never resolves
    api.getMenu.mockReturnValue(new Promise(() => {}));
    api.getLocations.mockReturnValue(new Promise(() => {}));

    renderPage();

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(db.cart.put).not.toHaveBeenCalled();
    expect(db.cart.delete).not.toHaveBeenCalled();
  });
});

describe('OrderPage — signed-in account prefill', () => {
  test('refreshes the session, then prefills and locks fields the account provided', async () => {
    const mockRefresh = vi.fn().mockResolvedValue({
      name: 'Ada',
      phone: '+2348012345678',
      address: '1 Account Street',
      landmark: 'Near the account mall',
    });
    useCustomerAuth.mockReturnValue({
      session: { token: 'cust-tok', customer: { name: 'Stale Name' } },
      refresh: mockRefresh,
    });
    db.cart.get.mockResolvedValue(undefined);

    renderPage();

    expect(await screen.findByDisplayValue('Ada')).toBeInTheDocument();
    expect(mockRefresh).toHaveBeenCalled();
    expect(screen.getByDisplayValue('1 Account Street')).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveAttribute('readonly');
    expect(screen.getByLabelText(/Delivery address/)).toHaveAttribute('readonly');
    expect(screen.getAllByText('· from your account').length).toBeGreaterThan(0);
  });

  test('a hand-typed/draft value takes precedence over the account value and stays editable', async () => {
    useCustomerAuth.mockReturnValue({
      session: { token: 'cust-tok', customer: { name: 'Account Name' } },
      refresh: vi.fn().mockResolvedValue({ name: 'Account Name' }),
    });
    db.cart.get.mockResolvedValue({
      items: [],
      customerName: 'Zee Draft',
      customerPhone: '',
      deliveryAddress: '',
      landmark: '',
      notes: '',
    });

    renderPage();

    expect(await screen.findByDisplayValue('Zee Draft')).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).not.toHaveAttribute('readonly');
  });

  test('refresh() is not called when signed out', async () => {
    const mockRefresh = vi.fn();
    useCustomerAuth.mockReturnValue({ session: null, refresh: mockRefresh });
    db.cart.get.mockResolvedValue(undefined);

    renderPage();

    await screen.findByText('Buka Stew');
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
