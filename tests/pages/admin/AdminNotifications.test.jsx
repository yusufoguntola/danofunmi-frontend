import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminNotifications from '../../../src/pages/admin/AdminNotifications';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { fakeJwt } from '../../helpers/fakeJwt';

vi.mock('../../../src/lib/api', () => ({
  api: { adminListPushSubscriptions: vi.fn(), adminSendBroadcast: vi.fn() },
}));

const STORAGE_KEY = 'danofunmi_admin_session';

function seedSession() {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { name: 'Ada Admin' } }));
}

function renderPage() {
  return render(
    <AdminAuthProvider>
      <AdminNotifications />
    </AdminAuthProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  seedSession();
  api.adminListPushSubscriptions.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
});

describe('AdminNotifications', () => {
  test('shows the subscriber count once loaded', async () => {
    renderPage();
    expect(await screen.findByText('2 devices subscribed to push notifications.')).toBeInTheDocument();
  });

  test('In-App and Email channels are enabled and checkable; SMS and WhatsApp are disabled', async () => {
    renderPage();
    await screen.findByText('2 devices subscribed to push notifications.');

    expect(screen.getByLabelText(/In-App/)).not.toBeDisabled();
    expect(screen.getByLabelText(/^Email/)).not.toBeDisabled();
    expect(screen.getByLabelText(/SMS/)).toBeDisabled();
    expect(screen.getByLabelText(/WhatsApp/)).toBeDisabled();
  });

  test('In-App starts checked by default; disabled channels cannot be toggled', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('2 devices subscribed to push notifications.');

    expect(screen.getByLabelText(/In-App/)).toBeChecked();

    await user.click(screen.getByLabelText(/SMS/));
    expect(screen.getByLabelText(/SMS/)).not.toBeChecked();
  });

  test('blocks submit when no channels are selected', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('2 devices subscribed to push notifications.');

    // Uncheck the only enabled-by-default channel.
    await user.click(screen.getByLabelText(/In-App/));
    await user.type(screen.getByLabelText('Title'), 'Menu is up');
    await user.type(screen.getByLabelText('Message'), 'Order now!');
    await user.click(screen.getByRole('button', { name: 'Send broadcast' }));

    expect(screen.getByText('Select at least one channel to send through.')).toBeInTheDocument();
    expect(api.adminSendBroadcast).not.toHaveBeenCalled();
  });

  test('blocks submit when title or body is blank', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('2 devices subscribed to push notifications.');

    await user.click(screen.getByRole('button', { name: 'Send broadcast' }));

    expect(screen.getByText('Title and message are required.')).toBeInTheDocument();
    expect(api.adminSendBroadcast).not.toHaveBeenCalled();
  });

  test('a successful send shows the result summary built from the response and resets the form', async () => {
    const user = userEvent.setup();
    api.adminSendBroadcast.mockResolvedValue({
      results: {
        in_app: { sent: 4 },
        email: { sent: 3, failed: ['a@test.com'] },
      },
    });
    renderPage();
    await screen.findByText('2 devices subscribed to push notifications.');

    await user.click(screen.getByLabelText(/^Email/));
    await user.type(screen.getByLabelText('Title'), 'Menu is up');
    await user.type(screen.getByLabelText('Message'), 'Order now!');
    await user.click(screen.getByRole('button', { name: 'Send broadcast' }));

    expect(await screen.findByText('In-App: sent to 4 devices. Email: sent to 3 (failed for 1).')).toBeInTheDocument();
    expect(api.adminSendBroadcast).toHaveBeenCalledWith(expect.any(String), {
      channels: ['in_app', 'email'],
      title: 'Menu is up',
      body: 'Order now!',
    });
    expect(screen.getByLabelText('Title')).toHaveValue('');
  });

  test('a failed send shows the server error message', async () => {
    const user = userEvent.setup();
    api.adminSendBroadcast.mockRejectedValue(new Error('Broadcast service unavailable'));
    renderPage();
    await screen.findByText('2 devices subscribed to push notifications.');

    await user.type(screen.getByLabelText('Title'), 'Menu is up');
    await user.type(screen.getByLabelText('Message'), 'Order now!');
    await user.click(screen.getByRole('button', { name: 'Send broadcast' }));

    expect(await screen.findByText('Broadcast service unavailable')).toBeInTheDocument();
  });
});
