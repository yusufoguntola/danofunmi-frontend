import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminFeedback from '../../../src/pages/admin/AdminFeedback';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { confirmDelete } from '../../../src/lib/confirm';
import { fakeJwt } from '../../helpers/fakeJwt';

vi.mock('../../../src/lib/api', () => ({
  api: { adminListFeedback: vi.fn(), adminDeleteFeedback: vi.fn(), adminSetFeedbackVisibility: vi.fn() },
}));

vi.mock('../../../src/lib/confirm', () => ({ confirmDelete: vi.fn() }));

const STORAGE_KEY = 'danofunmi_admin_session';

function seedSession() {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { name: 'Ada Admin' } }));
}

function renderPage() {
  return render(
    <AdminAuthProvider>
      <AdminFeedback />
    </AdminAuthProvider>
  );
}

function makeFeedback(overrides = {}) {
  return {
    id: 'f1',
    createdAt: '2026-01-01T00:00:00.000Z',
    rating: 4,
    comment: 'Great jollof!',
    visibleOnLanding: true,
    order: { narration: 'order-123', customer: { name: 'Ada' } },
    customerName: null,
    location: null,
    foodType: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  seedSession();
});

describe('AdminFeedback', () => {
  test('renders the feedback list with customer and order info', async () => {
    api.adminListFeedback.mockResolvedValue([makeFeedback()]);
    renderPage();

    expect(await screen.findByText('order-123')).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });

  test('shows empty state when there is no feedback', async () => {
    api.adminListFeedback.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No feedback yet.')).toBeInTheDocument();
  });

  test('does not show the "Hidden" badge when visibleOnLanding is true', async () => {
    api.adminListFeedback.mockResolvedValue([makeFeedback({ visibleOnLanding: true })]);
    renderPage();
    await screen.findByText('order-123');

    expect(screen.queryByText(/Hidden/)).not.toBeInTheDocument();
  });

  test('shows the "Hidden" badge next to the rating when visibleOnLanding is false', async () => {
    api.adminListFeedback.mockResolvedValue([makeFeedback({ visibleOnLanding: false })]);
    renderPage();
    await screen.findByText('order-123');

    expect(screen.getByText(/Hidden/)).toBeInTheDocument();
  });

  test('expanding a row and clicking "Hide from landing" calls the API and updates the badge', async () => {
    const user = userEvent.setup();
    const row = makeFeedback({ visibleOnLanding: true });
    api.adminListFeedback.mockResolvedValue([row]);
    api.adminSetFeedbackVisibility.mockResolvedValue({ ...row, visibleOnLanding: false });
    renderPage();
    await screen.findByText('order-123');

    await user.click(screen.getByText('order-123'));
    await user.click(screen.getByRole('button', { name: 'Hide from landing' }));

    expect(api.adminSetFeedbackVisibility).toHaveBeenCalledWith(expect.any(String), 'f1', false);
    expect(await screen.findByText(/Hidden/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Show on landing' })).toBeInTheDocument();
  });

  test('expanding a row and clicking "Show on landing" calls the API and clears the badge', async () => {
    const user = userEvent.setup();
    const row = makeFeedback({ visibleOnLanding: false });
    api.adminListFeedback.mockResolvedValue([row]);
    api.adminSetFeedbackVisibility.mockResolvedValue({ ...row, visibleOnLanding: true });
    renderPage();
    await screen.findByText('order-123');

    await user.click(screen.getByText('order-123'));
    await user.click(screen.getByRole('button', { name: 'Show on landing' }));

    expect(api.adminSetFeedbackVisibility).toHaveBeenCalledWith(expect.any(String), 'f1', true);
    expect(await screen.findByRole('button', { name: 'Hide from landing' })).toBeInTheDocument();
    expect(screen.queryByText(/Hidden/)).not.toBeInTheDocument();
  });

  test('deleting a row confirms, calls the API, and removes it from the list', async () => {
    const user = userEvent.setup();
    confirmDelete.mockResolvedValue(true);
    api.adminListFeedback.mockResolvedValue([makeFeedback()]);
    api.adminDeleteFeedback.mockResolvedValue({});
    renderPage();
    await screen.findByText('order-123');

    await user.click(screen.getByText('order-123'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirmDelete).toHaveBeenCalledWith('this feedback');
    expect(api.adminDeleteFeedback).toHaveBeenCalledWith(expect.any(String), 'f1');
    expect(await screen.findByText('No feedback yet.')).toBeInTheDocument();
  });

  test('cancelling the delete confirmation leaves the row intact', async () => {
    const user = userEvent.setup();
    confirmDelete.mockResolvedValue(false);
    api.adminListFeedback.mockResolvedValue([makeFeedback()]);
    renderPage();
    await screen.findByText('order-123');

    await user.click(screen.getByText('order-123'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(api.adminDeleteFeedback).not.toHaveBeenCalled();
    expect(screen.getByText('order-123')).toBeInTheDocument();
  });
});
