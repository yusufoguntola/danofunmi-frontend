import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderScheduleNotice from '../../src/components/OrderScheduleNotice';

describe('OrderScheduleNotice', () => {
  test('shows the generic monthly timeline rather than specific dates', () => {
    render(<OrderScheduleNotice />);
    expect(
      screen.getByText(/Ordering opens in the last week of every month and closes in the second week of the following month/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Delivery begins shortly after ordering closes/)).toBeInTheDocument();
    expect(screen.queryByText(/\d+(st|nd|rd|th)\b/)).not.toBeInTheDocument();
  });
});
