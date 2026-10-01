import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OrderPage from '../../src/pages/OrderPage';
import { api } from '../../src/lib/api';
import { db } from '../../src/lib/db';
import { useCustomerAuth } from '../../src/context/CustomerAuthContext';
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
  {
    id: 'g1',
    type: 'group',
    name: 'Family Combo',
    category: 'Combos',
    icon: '🍱',
    total: 15000,
    items: [],
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

describe('OrderPage — adding items', () => {
  test('adds an individual item line and reflects it in the cart and totals', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: `1L · ${formatNaira(4500)}` }));

    const cartList = document.querySelector('.cart-list');
    expect(cartList).toHaveTextContent('Buka Stew');
    const summaryTotal = screen.getByText('Subtotal').closest('.summary-total');
    expect(summaryTotal).toHaveTextContent(formatNaira(4500)); // subtotal
    expect(summaryTotal).toHaveTextContent(formatNaira(1000)); // logistics (default loc1)
    expect(summaryTotal).toHaveTextContent(formatNaira(5500)); // total
  });

  test('clicking the same option again increments its quantity instead of duplicating the line', async () => {
    const user = userEvent.setup();
    renderPage();

    const addBtn = await screen.findByRole('button', { name: `1L · ${formatNaira(4500)}` });
    await user.click(addBtn);
    await user.click(addBtn);

    const cartLines = screen.getAllByText('Buka Stew');
    expect(cartLines).toHaveLength(2); // once in the menu card, once in the cart list
    expect(screen.getByText('2')).toBeInTheDocument(); // quantity shown in the cart line
    const summaryTotal = screen.getByText('Subtotal').closest('.summary-total');
    expect(summaryTotal).toHaveTextContent(formatNaira(9000));
  });

  test('adds a combo group line via the "Add combo" button', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: `Add combo · ${formatNaira(15000)}` }));

    const cartList = document.querySelector('.cart-list');
    expect(cartList).toHaveTextContent('Family Combo');
    expect(cartList).toHaveTextContent('Combo');
  });
});

describe('OrderPage — quantity adjustment and removal', () => {
  test('the "+" button increments quantity, the "−" button at quantity 1 removes the line', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: `1L · ${formatNaira(4500)}` }));
    const cartItem = document.querySelector('.cart-list__item');
    const [minus, plus] = within(cartItem).getAllByRole('button');

    await user.click(plus);
    expect(within(cartItem).getByText('2')).toBeInTheDocument();

    await user.click(minus);
    expect(within(cartItem).getByText('1')).toBeInTheDocument();

    await user.click(minus);
    expect(screen.getByText('No items yet — add something from the menu.')).toBeInTheDocument();
  });
});

describe('OrderPage — logistics fee and total by location', () => {
  test('recomputes logistics fee and total when the delivery location changes', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: `1L · ${formatNaira(4500)}` }));
    let summaryTotal = screen.getByText('Subtotal').closest('.summary-total');
    expect(summaryTotal).toHaveTextContent(formatNaira(5500)); // 4500 + 1000 (Akobo)

    await user.selectOptions(screen.getByLabelText('Delivery location'), 'loc2');
    summaryTotal = screen.getByText('Subtotal').closest('.summary-total');
    expect(summaryTotal).toHaveTextContent(formatNaira(6000)); // 4500 + 1500 (Bodija)
  });
});

describe('OrderPage — cart-aware schedule preview', () => {
  test('shows no preview when the cart is empty', async () => {
    renderPage();
    await screen.findByText('Buka Stew');
    expect(screen.queryByText(/scheduled for/)).not.toBeInTheDocument();
  });

  test('shows no preview when the schedule fetch failed (null schedule)', async () => {
    api.getOrderSchedule.mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: `1L · ${formatNaira(4500)}` }));
    expect(screen.queryByText(/scheduled for/)).not.toBeInTheDocument();
    expect(screen.queryByText(/opposite sides/)).not.toBeInTheDocument();
  });

  test('item-only cart shows the item order-month label', async () => {
    api.getOrderSchedule.mockResolvedValue({ itemOrderMonthLabel: 'October 2026', comboOrderMonthLabel: 'November 2026' });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: `1L · ${formatNaira(4500)}` }));
    expect(await screen.findByText(/This order is scheduled for October 2026/)).toBeInTheDocument();
  });

  test('combo-only cart shows the combo order-month label', async () => {
    api.getOrderSchedule.mockResolvedValue({ itemOrderMonthLabel: 'October 2026', comboOrderMonthLabel: 'November 2026' });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: `Add combo · ${formatNaira(15000)}` }));
    expect(await screen.findByText(/This order is scheduled for November 2026/)).toBeInTheDocument();
  });

  test('mixed cart with matching months shows a single label', async () => {
    api.getOrderSchedule.mockResolvedValue({ itemOrderMonthLabel: 'October 2026', comboOrderMonthLabel: 'October 2026' });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: `1L · ${formatNaira(4500)}` }));
    await user.click(await screen.findByRole('button', { name: `Add combo · ${formatNaira(15000)}` }));

    expect(await screen.findByText(/This order is scheduled for October 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/opposite sides/)).not.toBeInTheDocument();
  });

  test('mixed cart with differing months shows the split-checkout warning instead of a label', async () => {
    api.getOrderSchedule.mockResolvedValue({ itemOrderMonthLabel: 'October 2026', comboOrderMonthLabel: 'November 2026' });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: `1L · ${formatNaira(4500)}` }));
    await user.click(await screen.findByRole('button', { name: `Add combo · ${formatNaira(15000)}` }));

    expect(
      await screen.findByText(/combo and your individual items fall on opposite sides/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/This order is scheduled for/)).not.toBeInTheDocument();
  });
});
