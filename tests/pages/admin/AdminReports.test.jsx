import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminReports from '../../../src/pages/admin/AdminReports';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { fakeJwt } from '../../helpers/fakeJwt';

vi.mock('../../../src/lib/api', () => ({
  api: { adminGetPnl: vi.fn() },
}));

const STORAGE_KEY = 'danofunmi_admin_session';

function seedSession() {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { name: 'Ada Admin' } }));
}

function renderPage() {
  return render(
    <AdminAuthProvider>
      <AdminReports />
    </AdminAuthProvider>
  );
}

function makeReport(overrides = {}) {
  return {
    revenue: 500000,
    ordersCount: 10,
    totalCost: 200000,
    netProfit: 300000,
    foodRevenue: 450000,
    logisticsRevenue: 50000,
    costByCategory: { Ingredients: 150000, Packaging: 50000 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  seedSession();
});

describe('AdminReports', () => {
  test('loads the all-time report on mount with no date range', async () => {
    api.adminGetPnl.mockResolvedValue(makeReport());

    renderPage();

    expect(await screen.findByText('10 paid orders')).toBeInTheDocument();
    expect(api.adminGetPnl).toHaveBeenCalledWith(expect.any(String), {});
  });

  test('renders the figures from the report response', async () => {
    api.adminGetPnl.mockResolvedValue(makeReport());
    renderPage();

    await screen.findByText('10 paid orders');

    expect(screen.getByText('Ingredients')).toBeInTheDocument();
    expect(screen.getByText('Packaging')).toBeInTheDocument();
    expect(screen.getByText('Food sales')).toBeInTheDocument();
    expect(screen.getByText('Logistics collected')).toBeInTheDocument();
  });

  test('shows "no costs" message when costByCategory is empty', async () => {
    api.adminGetPnl.mockResolvedValue(makeReport({ costByCategory: {} }));
    renderPage();

    expect(await screen.findByText('No costs in this range.')).toBeInTheDocument();
  });

  test('changing the date range and applying re-fetches with the new range', async () => {
    const user = userEvent.setup();
    api.adminGetPnl.mockResolvedValue(makeReport());
    renderPage();
    await screen.findByText('10 paid orders');

    api.adminGetPnl.mockResolvedValue(makeReport({ ordersCount: 4 }));

    await user.type(screen.getByLabelText('From'), '2026-01-01');
    await user.type(screen.getByLabelText('To'), '2026-01-31');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('4 paid orders')).toBeInTheDocument();
    expect(api.adminGetPnl).toHaveBeenLastCalledWith(expect.any(String), { from: '2026-01-01', to: '2026-01-31' });
  });

  test('"All time" clears the date range and reloads with no filter', async () => {
    const user = userEvent.setup();
    api.adminGetPnl.mockResolvedValue(makeReport());
    renderPage();
    await screen.findByText('10 paid orders');

    await user.type(screen.getByLabelText('From'), '2026-01-01');
    await user.click(screen.getByRole('button', { name: 'All time' }));

    expect(api.adminGetPnl).toHaveBeenLastCalledWith(expect.any(String), {});
    expect(screen.getByLabelText('From')).toHaveValue('');
  });
});
