import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../../src/pages/LandingPage';
import { api } from '../../src/lib/api';
import { db } from '../../src/lib/db';

// LandingPage renders real MenuGrid/OrderScheduleNotice/SiteFooter children
// (all independently tested elsewhere) — only their dependencies are mocked
// here, not the components themselves.
vi.mock('../../src/lib/api', () => ({
  api: { getMenu: vi.fn(), getFeedback: vi.fn(), getOrderSchedule: vi.fn() },
}));

vi.mock('../../src/lib/db', () => ({
  db: { cart: { get: vi.fn() } },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Keep OrderScheduleNotice (a real child) quiet — it has its own tests.
  api.getOrderSchedule.mockReturnValue(new Promise(() => {}));
});

describe('LandingPage — menu', () => {
  test('fetches the menu on mount and renders a short preview via MenuGrid (limit={6}), not the full category-grouped grid', async () => {
    api.getMenu.mockResolvedValue([
      { id: 'i1', type: 'item', name: 'Buka Stew', category: 'Soups', icon: '🍲', options: [{ id: 'o1', size: '1L', price: 4500 }] },
    ]);
    api.getFeedback.mockResolvedValue([]);
    db.cart.get.mockResolvedValue(undefined);

    renderPage();

    expect(await screen.findByText('Buka Stew')).toBeInTheDocument();
    // limit mode renders a flat preview grid, not category column headers.
    expect(screen.queryByText('Soups')).not.toBeInTheDocument();
  });

  test('shows a "View full menu" link to /menu when there are more items than the preview limit', async () => {
    api.getMenu.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({
        id: `i${i}`,
        type: 'item',
        name: `Item ${i}`,
        category: 'Soups',
        icon: '🍲',
        options: [{ id: `o${i}`, size: '1L', price: 4500 }],
      }))
    );
    api.getFeedback.mockResolvedValue([]);
    db.cart.get.mockResolvedValue(undefined);

    renderPage();

    await screen.findByText('Item 0');
    expect(screen.getByRole('link', { name: /View full menu/ })).toHaveAttribute('href', '/menu');
  });

  test('top nav "Menu" is a real link to /menu, not an in-page anchor', async () => {
    api.getMenu.mockResolvedValue([]);
    api.getFeedback.mockResolvedValue([]);
    db.cart.get.mockResolvedValue(undefined);

    renderPage();
    await screen.findByText("This month's menu");

    // SiteFooter has its own separate "Menu" anchor link — scope to the top nav.
    const topNav = document.querySelector('nav.nav__links');
    expect(within(topNav).getByRole('link', { name: 'Menu' })).toHaveAttribute('href', '/menu');
  });
});

describe('LandingPage — reviews section', () => {
  test('is absent when there is no feedback', async () => {
    api.getMenu.mockResolvedValue([]);
    api.getFeedback.mockResolvedValue([]);
    db.cart.get.mockResolvedValue(undefined);

    renderPage();

    await screen.findByText("This month's menu");
    expect(screen.queryByText('What customers say')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Reviews' })).not.toBeInTheDocument();
  });

  test('renders once feedback is fetched, with the reviewer name and a working nav link', async () => {
    api.getMenu.mockResolvedValue([]);
    api.getFeedback.mockResolvedValue([
      { id: 'f1', rating: 4, comment: 'Delicious and arrived on time!', name: 'Ada', createdAt: '2026-09-01T00:00:00.000Z' },
    ]);
    db.cart.get.mockResolvedValue(undefined);

    renderPage();

    expect(await screen.findByText('What customers say')).toBeInTheDocument();
    expect(screen.getByText(/Delicious and arrived on time!/)).toBeInTheDocument();
    expect(screen.getByText(/Ada/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reviews' })).toHaveAttribute('href', '#reviews');
  });
});

describe('LandingPage — "continue your order" banner', () => {
  test('shows when a draft cart with items exists, with the right item count and link', async () => {
    api.getMenu.mockResolvedValue([]);
    api.getFeedback.mockResolvedValue([]);
    db.cart.get.mockResolvedValue({ items: [{ quantity: 2 }, { quantity: 1 }] });

    renderPage();

    expect(await screen.findByText(/3 item\(s\) saved/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue your order' })).toHaveAttribute('href', '/order');
  });

  test('is hidden when there is no draft at all', async () => {
    api.getMenu.mockResolvedValue([]);
    api.getFeedback.mockResolvedValue([]);
    db.cart.get.mockResolvedValue(undefined);

    renderPage();

    await screen.findByText("This month's menu");
    expect(screen.queryByText(/item\(s\) saved/)).not.toBeInTheDocument();
  });

  test('is hidden when the draft cart has an empty items array', async () => {
    api.getMenu.mockResolvedValue([]);
    api.getFeedback.mockResolvedValue([]);
    db.cart.get.mockResolvedValue({ items: [] });

    renderPage();

    await screen.findByText("This month's menu");
    expect(screen.queryByText(/item\(s\) saved/)).not.toBeInTheDocument();
  });
});

describe('LandingPage — menu fetch error', () => {
  test('shows the error message without crashing, and the menu fetch error does not block the rest of the page', async () => {
    api.getMenu.mockRejectedValue(new Error('Could not load menu'));
    api.getFeedback.mockResolvedValue([]);
    db.cart.get.mockResolvedValue(undefined);

    renderPage();

    expect(await screen.findByText('Could not load menu')).toBeInTheDocument();
    expect(screen.getByText("This month's menu")).toBeInTheDocument();
  });
});
