import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminCosts from '../../../src/pages/admin/AdminCosts';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { confirmDelete } from '../../../src/lib/confirm';
import { fakeJwt } from '../../helpers/fakeJwt';

vi.mock('../../../src/lib/api', () => ({
  api: { adminListCosts: vi.fn(), adminCreateCost: vi.fn(), adminDeleteCost: vi.fn() },
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
      <AdminCosts />
    </AdminAuthProvider>
  );
}

function makeCosts(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i + 1}`,
    description: `Cost ${i + 1}`,
    category: 'Ingredients',
    amount: 1000,
    incurredOn: '2026-01-01',
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  seedSession();
});

describe('AdminCosts', () => {
  test('renders the cost list', async () => {
    api.adminListCosts.mockResolvedValue(makeCosts(2));
    renderPage();

    expect(await screen.findByText('Cost 1')).toBeInTheDocument();
    expect(screen.getByText('Cost 2')).toBeInTheDocument();
  });

  test('shows the empty state when there are no costs, and no footer total row', async () => {
    api.adminListCosts.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No costs recorded yet.')).toBeInTheDocument();
    expect(screen.queryByText('Total (all pages)')).not.toBeInTheDocument();
  });

  test('creating a cost entry submits the form and reloads the list', async () => {
    const user = userEvent.setup();
    api.adminListCosts.mockResolvedValue([]);
    api.adminCreateCost.mockResolvedValue({});
    renderPage();
    await screen.findByText('No costs recorded yet.');

    api.adminListCosts.mockResolvedValue(makeCosts(1));

    await user.type(screen.getByLabelText('Description'), 'Rice & soup ingredients');
    await user.type(screen.getByLabelText('Amount'), '5000');
    // Leave Date at its default (today) — jsdom's <input type="date"> doesn't
    // support userEvent.type() typing a replacement value reliably, and the
    // default already satisfies the "date required" validation anyway.
    await user.click(screen.getByRole('button', { name: 'Add cost' }));

    const today = new Date().toISOString().slice(0, 10);
    expect(api.adminCreateCost).toHaveBeenCalledWith(expect.any(String), {
      description: 'Rice & soup ingredients',
      category: 'Ingredients',
      amount: 5000,
      incurredOn: today,
    });
    expect(await screen.findByText('Cost 1')).toBeInTheDocument();
  });

  test('blocks submit when description, amount, or date is missing', async () => {
    const user = userEvent.setup();
    api.adminListCosts.mockResolvedValue([]);
    renderPage();
    await screen.findByText('No costs recorded yet.');

    await user.click(screen.getByRole('button', { name: 'Add cost' }));

    expect(screen.getByText('Description, amount, and date are required.')).toBeInTheDocument();
    expect(api.adminCreateCost).not.toHaveBeenCalled();
  });

  test('deleting a cost confirms, calls the API, and reloads', async () => {
    const user = userEvent.setup();
    confirmDelete.mockResolvedValue(true);
    api.adminListCosts.mockResolvedValue(makeCosts(1));
    api.adminDeleteCost.mockResolvedValue({});
    renderPage();
    await screen.findByText('Cost 1');

    api.adminListCosts.mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirmDelete).toHaveBeenCalledWith('the cost entry "Cost 1"');
    expect(api.adminDeleteCost).toHaveBeenCalledWith(expect.any(String), 'c1');
    expect(await screen.findByText('No costs recorded yet.')).toBeInTheDocument();
  });

  test('the footer "Total (all pages)" sums every fetched entry, not just the current page', async () => {
    // Page size defaults to 10 — 12 entries of 1000 each means page 1 shows
    // only 10 rows (10,000) but the footer must reflect all 12 (12,000).
    api.adminListCosts.mockResolvedValue(makeCosts(12));
    renderPage();

    await screen.findByText('Cost 1');
    expect(screen.getByText('Cost 10')).toBeInTheDocument();
    expect(screen.queryByText('Cost 11')).not.toBeInTheDocument();

    expect(screen.getByText('Total (all pages)')).toBeInTheDocument();
    // formatNaira renders e.g. "₦12,000" — assert via a substring match so we
    // don't couple the test to Intl's exact currency symbol/spacing.
    expect(screen.getByText(/12,000/)).toBeInTheDocument();
  });
});
