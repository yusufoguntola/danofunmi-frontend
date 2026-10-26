import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderScheduleNotice from '../../src/components/OrderScheduleNotice';
import { api } from '../../src/lib/api';

vi.mock('../../src/lib/api', () => ({
  api: { getOrderTimeline: vi.fn() },
}));

const TIMELINE = {
  id: 'tl_1',
  opensOn: '2026-10-25',
  closesOn: '2026-11-13',
  deliveryStartsOn: '2026-11-16',
  deliveryEndsOn: '2026-11-18',
};

const GENERIC = /Ordering opens in the last week of every month and closes in the second week of the following month/;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrderScheduleNotice (generic, the default)', () => {
  test('shows the generic monthly timeline rather than specific dates, without fetching', () => {
    render(<OrderScheduleNotice />);
    expect(screen.getByText(GENERIC)).toBeInTheDocument();
    expect(screen.getByText(/Delivery begins shortly after ordering closes/)).toBeInTheDocument();
    expect(screen.queryByText(/\d+(st|nd|rd|th)\b/)).not.toBeInTheDocument();
    expect(api.getOrderTimeline).not.toHaveBeenCalled();
  });
});

describe('OrderScheduleNotice exact', () => {
  test('shows the current run\'s actual opening, closing and delivery dates', async () => {
    api.getOrderTimeline.mockResolvedValue(TIMELINE);
    const { container } = render(<OrderScheduleNotice exact />);

    expect(await screen.findByText('25th of October')).toBeInTheDocument();
    expect(screen.getByText('13th of November')).toBeInTheDocument();
    expect(screen.getByText('16th – 18th of November')).toBeInTheDocument();
    expect(container).toHaveTextContent(
      'Ordering opens 25th of October and closes 13th of November. Delivery: 16th – 18th of November.'
    );
  });

  test('renders nothing until the timeline arrives', () => {
    api.getOrderTimeline.mockReturnValue(new Promise(() => {}));
    const { container } = render(<OrderScheduleNotice exact />);
    expect(container).toBeEmptyDOMElement();
  });

  test('falls back to the generic timeline when none is set', async () => {
    api.getOrderTimeline.mockResolvedValue(null);
    render(<OrderScheduleNotice exact />);
    expect(await screen.findByText(GENERIC)).toBeInTheDocument();
  });

  test('falls back to the generic timeline when the fetch fails', async () => {
    api.getOrderTimeline.mockRejectedValue(new Error('network down'));
    render(<OrderScheduleNotice exact />);
    expect(await screen.findByText(GENERIC)).toBeInTheDocument();
  });
});
