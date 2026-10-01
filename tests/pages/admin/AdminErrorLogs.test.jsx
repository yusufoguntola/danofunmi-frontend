import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminErrorLogs from '../../../src/pages/admin/AdminErrorLogs';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { confirmAction, confirmDelete } from '../../../src/lib/confirm';
import { fakeJwt } from '../../helpers/fakeJwt';

vi.mock('../../../src/lib/api', () => ({
  api: { adminListErrorLogs: vi.fn(), adminDeleteErrorLog: vi.fn(), adminClearErrorLogs: vi.fn() },
}));

vi.mock('../../../src/lib/confirm', () => ({ confirmAction: vi.fn(), confirmDelete: vi.fn() }));

const STORAGE_KEY = 'danofunmi_admin_session';

function seedSession() {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { name: 'Ada Admin' } }));
}

function renderPage() {
  return render(
    <AdminAuthProvider>
      <AdminErrorLogs />
    </AdminAuthProvider>
  );
}

function makeLog(overrides = {}) {
  return {
    id: 'e1',
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'order-create',
    message: 'Something broke',
    context: { orderId: 'o1' },
    stack: 'Error: Something broke\n  at handler (app.js:1:1)',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  seedSession();
});

describe('AdminErrorLogs', () => {
  test('renders the error log list', async () => {
    api.adminListErrorLogs.mockResolvedValue([makeLog()]);
    renderPage();

    expect(await screen.findByText('Something broke')).toBeInTheDocument();
    expect(screen.getByText('order-create')).toBeInTheDocument();
  });

  test('shows the empty state when there are no logs', async () => {
    api.adminListErrorLogs.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No errors logged — good sign.')).toBeInTheDocument();
  });

  test('no "Clear all" button is shown when the list is empty', async () => {
    api.adminListErrorLogs.mockResolvedValue([]);
    renderPage();
    await screen.findByText('No errors logged — good sign.');
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
  });

  test('expanding a row shows the stack trace and context JSON detail', async () => {
    const user = userEvent.setup();
    api.adminListErrorLogs.mockResolvedValue([makeLog()]);
    renderPage();
    await screen.findByText('Something broke');

    await user.click(screen.getByText('order-create'));

    expect(screen.getByText(/Error: Something broke/)).toBeInTheDocument();
    expect(screen.getByText(/"orderId": "o1"/)).toBeInTheDocument();
  });

  test('deleting a row confirms, calls the API, and removes it from the list', async () => {
    const user = userEvent.setup();
    confirmDelete.mockResolvedValue(true);
    api.adminListErrorLogs.mockResolvedValue([makeLog()]);
    api.adminDeleteErrorLog.mockResolvedValue({});
    renderPage();
    await screen.findByText('Something broke');

    await user.click(screen.getByText('order-create'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirmDelete).toHaveBeenCalledWith('this error log');
    expect(api.adminDeleteErrorLog).toHaveBeenCalledWith(expect.any(String), 'e1');
    expect(await screen.findByText('No errors logged — good sign.')).toBeInTheDocument();
  });

  test('"Clear all" confirms, calls the batch API, and empties the list', async () => {
    const user = userEvent.setup();
    confirmAction.mockResolvedValue(true);
    api.adminListErrorLogs.mockResolvedValue([
      makeLog({ id: 'e1', message: 'First error' }),
      makeLog({ id: 'e2', message: 'Second error' }),
    ]);
    api.adminClearErrorLogs.mockResolvedValue({});
    renderPage();
    await screen.findByText('First error');
    await screen.findByText('Second error');

    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Clear all error logs?', confirmButtonText: 'Clear all', danger: true })
    );
    expect(api.adminClearErrorLogs).toHaveBeenCalledWith(expect.any(String));
    expect(await screen.findByText('No errors logged — good sign.')).toBeInTheDocument();
  });

  test('cancelling "Clear all" leaves the list intact', async () => {
    const user = userEvent.setup();
    confirmAction.mockResolvedValue(false);
    api.adminListErrorLogs.mockResolvedValue([makeLog()]);
    renderPage();
    await screen.findByText('Something broke');

    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(api.adminClearErrorLogs).not.toHaveBeenCalled();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });
});
