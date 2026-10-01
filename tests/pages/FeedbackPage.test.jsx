import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import FeedbackPage from '../../src/pages/FeedbackPage';
import { api, ApiError } from '../../src/lib/api';

vi.mock('../../src/lib/api', () => {
  class ApiError extends Error {
    constructor(message, status, body) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  return { api: { getOrderFeedback: vi.fn(), submitOrderFeedback: vi.fn() }, ApiError };
});

function renderPage(id = 'order1') {
  return render(
    <MemoryRouter initialEntries={[`/feedback/${id}`]}>
      <Routes>
        <Route path="/feedback/:id" element={<FeedbackPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FeedbackPage', () => {
  test('shows a loading state, then the order-scoped heading once loaded', async () => {
    api.getOrderFeedback.mockResolvedValue({
      narration: 'DFM-ABCDEF',
      status: 'DELIVERED',
      customerName: 'Ada Eze',
    });

    renderPage();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByText('How was it, Ada?')).toBeInTheDocument();
    expect(screen.getByText('Order DFM-ABCDEF')).toBeInTheDocument();
    expect(api.getOrderFeedback).toHaveBeenCalledWith('order1');
  });

  test('shows an error if the order lookup fails', async () => {
    api.getOrderFeedback.mockRejectedValue(new ApiError('Order not found', 404));

    renderPage();

    expect(await screen.findByText('Order not found')).toBeInTheDocument();
  });

  test('shows a generic error message for a non-ApiError failure', async () => {
    api.getOrderFeedback.mockRejectedValue(new Error('boom'));

    renderPage();

    expect(await screen.findByText('Could not load this order.')).toBeInTheDocument();
  });

  test('an order not yet delivered shows its current status instead of a form', async () => {
    api.getOrderFeedback.mockResolvedValue({
      narration: 'DFM-ABCDEF',
      status: 'OUT_FOR_DELIVERY',
      customerName: 'Ada Eze',
    });

    renderPage();

    expect(await screen.findByText(/out for delivery/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit feedback' })).not.toBeInTheDocument();
  });

  test('an order with existing feedback shows the thank-you state immediately with no form', async () => {
    api.getOrderFeedback.mockResolvedValue({
      narration: 'DFM-ABCDEF',
      status: 'DELIVERED',
      customerName: 'Ada Eze',
      existingFeedback: { rating: 4, comment: 'Great jollof' },
    });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Thanks for your feedback!' })).toBeInTheDocument();
    expect(screen.getByText(/Great jollof/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit feedback' })).not.toBeInTheDocument();
  });

  test('a successful first-time submission shows the thank-you state', async () => {
    api.getOrderFeedback.mockResolvedValue({
      narration: 'DFM-ABCDEF',
      status: 'DELIVERED',
      customerName: 'Ada Eze',
    });
    api.submitOrderFeedback.mockResolvedValue({ rating: 5, comment: 'Amazing' });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('How was it, Ada?');

    await user.click(screen.getByRole('button', { name: '5 stars' }));
    await user.type(screen.getByLabelText('Comment (optional)'), 'Amazing');
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

    expect(await screen.findByRole('heading', { name: 'Thanks for your feedback!' })).toBeInTheDocument();
    expect(screen.getByText(/Amazing/)).toBeInTheDocument();
    expect(api.submitOrderFeedback).toHaveBeenCalledWith('order1', { rating: 5, comment: 'Amazing' });
  });

  test('blocks submit and shows an error when no rating is picked', async () => {
    api.getOrderFeedback.mockResolvedValue({
      narration: 'DFM-ABCDEF',
      status: 'DELIVERED',
      customerName: 'Ada Eze',
    });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('How was it, Ada?');
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

    expect(await screen.findByText('Pick a star rating first.')).toBeInTheDocument();
    expect(api.submitOrderFeedback).not.toHaveBeenCalled();
  });

  // The 409 race: another tab/request already submitted feedback for this
  // order between page-load and this submit. The backend returns 409 with
  // the existing feedback attached — FeedbackPage treats that as success
  // (shows what's on file) rather than as an error.
  test('a 409 "already submitted" response shows the existing feedback instead of an error', async () => {
    api.getOrderFeedback.mockResolvedValue({
      narration: 'DFM-ABCDEF',
      status: 'DELIVERED',
      customerName: 'Ada Eze',
    });
    api.submitOrderFeedback.mockRejectedValue(
      new ApiError('Feedback already submitted', 409, { existingFeedback: { rating: 3, comment: 'Already in' } })
    );
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('How was it, Ada?');

    await user.click(screen.getByRole('button', { name: '2 stars' }));
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

    expect(await screen.findByRole('heading', { name: 'Thanks for your feedback!' })).toBeInTheDocument();
    expect(screen.getByText(/Already in/)).toBeInTheDocument();
    expect(screen.queryByText(/already submitted/i)).not.toBeInTheDocument();
  });

  test('a 409 without an existingFeedback body falls back to showing the error message', async () => {
    api.getOrderFeedback.mockResolvedValue({
      narration: 'DFM-ABCDEF',
      status: 'DELIVERED',
      customerName: 'Ada Eze',
    });
    api.submitOrderFeedback.mockRejectedValue(new ApiError('Something went wrong', 409, {}));
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('How was it, Ada?');

    await user.click(screen.getByRole('button', { name: '2 stars' }));
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  test('falls back to "there" when customerName is blank', async () => {
    api.getOrderFeedback.mockResolvedValue({
      narration: 'DFM-ABCDEF',
      status: 'DELIVERED',
      customerName: '',
    });

    renderPage();

    expect(await screen.findByText('How was it, there?')).toBeInTheDocument();
  });
});
