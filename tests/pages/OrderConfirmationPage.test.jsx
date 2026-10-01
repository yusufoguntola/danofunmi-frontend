import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OrderConfirmationPage from '../../src/pages/OrderConfirmationPage';
import { api } from '../../src/lib/api';

vi.mock('../../src/lib/api', () => ({
  api: { getOrder: vi.fn() },
}));

function renderPage({ id = 'order1', state } = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/order/${id}/confirmation`, state }]}>
      <Routes>
        <Route path="/order/:id/confirmation" element={<OrderConfirmationPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = vi.fn();
});

describe('OrderConfirmationPage', () => {
  test('scrolls to top on mount', () => {
    renderPage({ state: { orderNumber: 'DFM-000123', narration: 'DFM-ABCDEF' } });
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  test('renders order details from router location.state without calling the API', async () => {
    api.getOrder.mockResolvedValue({ orderNumber: 'DFM-999', narration: 'DFM-ZZZZZZ' });

    renderPage({ state: { orderNumber: 'DFM-000123', narration: 'DFM-ABCDEF' } });

    expect(await screen.findByText(/#DFM-000123/)).toBeInTheDocument();
    expect(screen.getByText(/DFM-ABCDEF/)).toBeInTheDocument();
    expect(api.getOrder).not.toHaveBeenCalled();
  });

  test('falls back to fetching the order by id when there is no location.state (e.g. a direct refresh)', async () => {
    api.getOrder.mockResolvedValue({ orderNumber: 'DFM-555', narration: 'DFM-REFRESH', id: 'order1' });

    renderPage({ id: 'order1' });

    expect(await screen.findByText(/#DFM-555/)).toBeInTheDocument();
    expect(screen.getByText(/DFM-REFRESH/)).toBeInTheDocument();
    expect(api.getOrder).toHaveBeenCalledWith('order1');
  });

  test('shows the generic message (no order number) if the fallback fetch fails', async () => {
    api.getOrder.mockRejectedValue(new Error('network down'));

    renderPage({ id: 'order1' });

    await vi.waitFor(() => expect(api.getOrder).toHaveBeenCalled());
    expect(screen.getByText(/We've got your payment info\./)).toBeInTheDocument();
  });

  test('renders the Track this order and Back home links', async () => {
    renderPage({ id: 'order1', state: { orderNumber: 'DFM-1', narration: 'DFM-AAAAAA' } });

    expect(await screen.findByRole('link', { name: 'Track this order' })).toHaveAttribute('href', '/order/order1');
    expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/');
  });
});
