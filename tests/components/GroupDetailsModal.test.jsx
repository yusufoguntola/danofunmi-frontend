import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupDetailsModal from '../../src/components/GroupDetailsModal';
import { formatNaira } from '../../src/lib/format';

const baseGroup = {
  name: 'Party Combo',
  description: 'Feeds 4 people',
  items: [
    { id: 'i1', name: 'Jollof Rice', size: '2L', quantity: 1, unitPrice: 5000, icon: '🍚', isBonus: false },
    { id: 'i2', name: 'Chicken', size: 'Large', quantity: 2, unitPrice: 2000, icon: '🍗', isBonus: false },
    { id: 'i3', name: 'Zobo', size: '1L', quantity: 1, unitPrice: 0, icon: '🥤', isBonus: true },
  ],
  grossTotal: 11000,
  discount: { type: 'PERCENTAGE', value: 10, amount: 1100 },
  total: 9900,
};

describe('GroupDetailsModal', () => {
  test('renders the group name as the modal title and its description', () => {
    render(<GroupDetailsModal group={baseGroup} onClose={() => {}} />);

    expect(screen.getByText('Party Combo')).toBeInTheDocument();
    expect(screen.getByText('Feeds 4 people')).toBeInTheDocument();
  });

  test('renders every item with its size, and a ×quantity suffix only when quantity > 1', () => {
    render(<GroupDetailsModal group={baseGroup} onClose={() => {}} />);

    expect(screen.getByText(/Jollof Rice/)).toBeInTheDocument();
    expect(screen.getByText(/2L/)).toBeInTheDocument();
    expect(screen.getByText(/×2/)).toBeInTheDocument(); // Chicken, quantity 2
    expect(screen.queryByText(/Jollof Rice.*×1/)).not.toBeInTheDocument();
  });

  test('shows a priced line for regular items and a bonus tag (no price) for bonus items', () => {
    render(<GroupDetailsModal group={baseGroup} onClose={() => {}} />);

    expect(screen.getByText(formatNaira(5000))).toBeInTheDocument(); // Jollof Rice unit price
    expect(screen.getByText(formatNaira(4000))).toBeInTheDocument(); // Chicken: 2000 * 2
    expect(screen.getByText('Bonus · free')).toBeInTheDocument();
  });

  test('renders the items total, discount line, and grand total', () => {
    render(<GroupDetailsModal group={baseGroup} onClose={() => {}} />);

    expect(screen.getByText(formatNaira(11000))).toBeInTheDocument();
    expect(screen.getByText('Discount (10%)')).toBeInTheDocument();
    expect(screen.getByText(`−${formatNaira(1100)}`)).toBeInTheDocument();
    expect(screen.getByText(formatNaira(9900))).toBeInTheDocument();
  });

  test('omits the discount line entirely when the group has no discount', () => {
    const noDiscountGroup = { ...baseGroup, discount: null };
    render(<GroupDetailsModal group={noDiscountGroup} onClose={() => {}} />);

    expect(screen.queryByText(/Discount/)).not.toBeInTheDocument();
  });

  test('renders an optional footer when given', () => {
    render(<GroupDetailsModal group={baseGroup} onClose={() => {}} footer={<button>Add to order</button>} />);

    expect(screen.getByRole('button', { name: 'Add to order' })).toBeInTheDocument();
  });

  test('is built on the shared Modal and calls onClose via its close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<GroupDetailsModal group={baseGroup} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });
});
