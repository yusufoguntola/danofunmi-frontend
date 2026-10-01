import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderScheduleNotice from '../../src/components/OrderScheduleNotice';
import { api } from '../../src/lib/api';

vi.mock('../../src/lib/api', () => ({
  api: { getOrderSchedule: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrderScheduleNotice', () => {
  test('renders nothing before the fetch resolves', () => {
    api.getOrderSchedule.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<OrderScheduleNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing if the fetch fails, rather than throwing', async () => {
    api.getOrderSchedule.mockRejectedValue(new Error('network down'));
    const { container } = render(<OrderScheduleNotice />);
    await vi.waitFor(() => expect(api.getOrderSchedule).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  test('shows the combined cutoff message when combo and item months match', async () => {
    api.getOrderSchedule.mockResolvedValue({
      itemCutoffDay: 15,
      comboCutoffDay: 10,
      itemOrderMonthLabel: 'October 2026',
      comboOrderMonthLabel: 'October 2026',
    });

    render(<OrderScheduleNotice />);

    expect(await screen.findByText(/Order individual items on or before the 15th/)).toBeInTheDocument();
    expect(screen.getByText(/combo deals on or before the\s*10th/)).toBeInTheDocument();
    expect(screen.getAllByText('October 2026')).toHaveLength(1);
  });

  test('shows the combo-closed nuance when combo and item months differ', async () => {
    api.getOrderSchedule.mockResolvedValue({
      itemCutoffDay: 15,
      comboCutoffDay: 10,
      itemOrderMonthLabel: 'October 2026',
      comboOrderMonthLabel: 'November 2026',
    });

    render(<OrderScheduleNotice />);

    expect(await screen.findByText(/Combo deals are now batched for/)).toBeInTheDocument();
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    expect(screen.getByText('October 2026')).toBeInTheDocument();
  });
});
