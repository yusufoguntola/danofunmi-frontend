import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MenuPage from '../../src/pages/MenuPage';
import { api } from '../../src/lib/api';

// MenuPage renders OrderScheduleNotice (a real child, not mocked here — this
// test only cares that MenuPage's own fetch/error logic works, and that the
// page composes without crashing), which also calls getOrderSchedule.
vi.mock('../../src/lib/api', () => ({
  api: { getMenu: vi.fn(), getOrderSchedule: vi.fn(() => new Promise(() => {})) },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MenuPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getOrderSchedule.mockReturnValue(new Promise(() => {}));
});

describe('MenuPage', () => {
  test('fetches the menu on mount and renders items grouped by category', async () => {
    api.getMenu.mockResolvedValue([
      { id: 'i1', type: 'item', name: 'Buka Stew', category: 'Soups', options: [{ id: 'o1', size: '1L', price: 4500 }] },
      { id: 'i2', type: 'item', name: 'Efo Riro', category: 'Soups', options: [{ id: 'o2', size: '1L', price: 4500 }] },
    ]);

    renderPage();

    expect(await screen.findByText('Buka Stew')).toBeInTheDocument();
    expect(screen.getByText('Efo Riro')).toBeInTheDocument();
    expect(screen.getByText('Soups')).toBeInTheDocument();
  });

  test('shows an error message if the menu fetch fails, without crashing', async () => {
    api.getMenu.mockRejectedValue(new Error('Could not load menu'));

    renderPage();

    expect(await screen.findByText('Could not load menu')).toBeInTheDocument();
  });

  test('renders the static chrome (brand link, order-now CTA, back-to-orders link)', async () => {
    api.getMenu.mockResolvedValue([]);
    renderPage();
    await screen.findByText("This month's menu");

    expect(screen.getByRole('link', { name: /order now/i })).toHaveAttribute('href', '/order');
    expect(screen.getByRole('link', { name: /back to my orders/i })).toHaveAttribute('href', '/orders');
  });
});
