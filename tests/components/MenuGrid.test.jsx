import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MenuGrid from '../../src/components/MenuGrid';
import { sendChatPrompt } from '../../src/lib/chatBridge';
import { formatNaira } from '../../src/lib/format';

vi.mock('../../src/lib/chatBridge', () => ({ sendChatPrompt: vi.fn() }));

const categories = ['Soups', 'Combos'];
const menu = [
  {
    id: 'item1',
    type: 'item',
    category: 'Soups',
    name: 'Egusi',
    description: 'Spicy egusi soup',
    icon: '🍲',
    options: [{ id: 'o1', size: '1L' }, { id: 'o2', size: '2L' }],
  },
  {
    id: 'group1',
    type: 'group',
    category: 'Combos',
    name: 'Party Pack',
    description: 'Feeds 4',
    icon: '🎉',
    total: 9000,
    grossTotal: 10000,
    discount: { type: 'PERCENTAGE', value: 10, amount: 1000 },
    items: [{ id: 'gi1', name: 'Jollof Rice', size: '1L', quantity: 1, unitPrice: 5000, isBonus: false, icon: '🍚' }],
  },
];

function renderGrid(props = {}) {
  return render(
    <MemoryRouter>
      <MenuGrid menu={menu} categories={categories} {...props} />
    </MemoryRouter>
  );
}

describe('MenuGrid', () => {
  test('renders categories and their items/groups', () => {
    renderGrid();

    expect(screen.getByText('Soups')).toBeInTheDocument();
    expect(screen.getByText('Egusi')).toBeInTheDocument();
    expect(screen.getByText('1L · 2L')).toBeInTheDocument();

    expect(screen.getByText('Combos')).toBeInTheDocument();
    expect(screen.getByText('Party Pack')).toBeInTheDocument();
    expect(screen.getByText(formatNaira(9000))).toBeInTheDocument();
  });

  test('clicking a combo\'s "View details" opens its GroupDetailsModal with the right data', async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.click(screen.getByRole('button', { name: 'View details' }));

    // Modal title (h3) is the group name — MenuGrid's own item heading is an
    // h4 with the same text, so disambiguate by heading level.
    expect(screen.getByRole('heading', { name: 'Party Pack', level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/Jollof Rice/)).toBeInTheDocument();
    expect(screen.getByText(formatNaira(5000))).toBeInTheDocument();
  });

  test('the GroupDetailsModal closes when its close button is clicked', async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.click(screen.getByRole('button', { name: 'View details' }));
    expect(screen.getByRole('heading', { name: 'Party Pack', level: 3 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Party Pack', level: 3 })).not.toBeInTheDocument();
  });

  test('shows "Start ordering" links for items and groups by default (showOrderLinks)', () => {
    renderGrid();

    const orderLinks = screen.getAllByRole('link', { name: /Start ordering/ });
    expect(orderLinks.length).toBe(2); // one for the item, one for the group
    orderLinks.forEach((link) => expect(link).toHaveAttribute('href', '/order'));
  });

  test('hides "Start ordering" links when showOrderLinks is false', () => {
    renderGrid({ showOrderLinks: false });

    expect(screen.queryByRole('link', { name: /Start ordering/ })).not.toBeInTheDocument();
  });

  test('clicking the bulk-request button calls sendChatPrompt with the expected message', async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.click(screen.getByRole('button', { name: /Chat with us to request it/ }));

    expect(sendChatPrompt).toHaveBeenCalledWith("I'd like to make a bulk/custom request");
    expect(screen.getByRole('status')).toHaveTextContent('Sending your request to our assistant…');
  });

  test('the bulk-request toast disappears again after a few seconds', () => {
    vi.useFakeTimers();
    renderGrid();

    // fireEvent (synchronous) instead of userEvent here — userEvent's
    // internal pointer/timer handling doesn't play well with fake timers.
    fireEvent.click(screen.getByRole('button', { name: /Chat with us to request it/ }));
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});

describe('MenuGrid — limit (preview mode)', () => {
  const manyItems = Array.from({ length: 5 }, (_, i) => ({
    id: `item${i}`,
    type: 'item',
    category: 'Soups',
    name: `Item ${i}`,
    description: '',
    icon: '🍲',
    options: [{ id: `o${i}`, size: '1L' }],
  }));
  const oneGroup = {
    id: 'group1',
    type: 'group',
    category: 'Combos',
    name: 'Party Pack',
    description: 'Feeds 4',
    icon: '🎉',
    total: 9000,
    items: [],
  };
  const bigMenu = [...manyItems, oneGroup]; // 6 entries total: 5 items + 1 group

  function renderWithLimit(menuOverride, limit, extraProps = {}) {
    return render(
      <MemoryRouter>
        <MenuGrid menu={menuOverride} categories={['Soups', 'Combos']} limit={limit} {...extraProps} />
      </MemoryRouter>
    );
  }

  test('prioritizes groups (combos) first, then items, up to the limit', () => {
    renderWithLimit(bigMenu, 3);

    // The group is last in the source array but should be the highlighted
    // first entry in the flat preview, followed by items up to the limit.
    expect(screen.getByText('Party Pack')).toBeInTheDocument();
    expect(screen.getByText('Item 0')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.queryByText('Item 2')).not.toBeInTheDocument();
  });

  test('does not render category column headers in preview mode', () => {
    renderWithLimit(bigMenu, 3);
    expect(screen.queryByText('Soups')).not.toBeInTheDocument();
    expect(screen.queryByText('Combos')).not.toBeInTheDocument();
  });

  test('shows a "View full menu" link when there are more entries than the limit', () => {
    renderWithLimit(bigMenu, 3);
    expect(screen.getByRole('link', { name: /View full menu/ })).toHaveAttribute('href', '/menu');
  });

  test('uses a custom menuPageHref when given', () => {
    renderWithLimit(bigMenu, 3, { menuPageHref: '/custom-menu' });
    expect(screen.getByRole('link', { name: /View full menu/ })).toHaveAttribute('href', '/custom-menu');
  });

  test('hides the "View full menu" link when everything already fits within the limit', () => {
    renderWithLimit(bigMenu, bigMenu.length);
    expect(screen.queryByRole('link', { name: /View full menu/ })).not.toBeInTheDocument();
  });

  test('omitting limit preserves the full category-grouped behavior', () => {
    render(
      <MemoryRouter>
        <MenuGrid menu={bigMenu} categories={['Soups', 'Combos']} />
      </MemoryRouter>
    );
    expect(screen.getByText('Soups')).toBeInTheDocument();
    expect(screen.getByText('Combos')).toBeInTheDocument();
    expect(screen.getByText('Item 4')).toBeInTheDocument(); // nothing truncated
    expect(screen.queryByRole('link', { name: /View full menu/ })).not.toBeInTheDocument();
  });
});
