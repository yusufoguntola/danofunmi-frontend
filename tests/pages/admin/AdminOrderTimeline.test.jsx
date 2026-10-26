import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminOrderTimeline from '../../../src/pages/admin/AdminOrderTimeline';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { fakeJwt } from '../../helpers/fakeJwt';

const STORAGE_KEY = 'danofunmi_admin_session';

vi.mock('../../../src/lib/api', () => ({
  api: {
    adminGetOrderTimeline: vi.fn(),
    adminUpdateOrderTimeline: vi.fn(),
  },
}));

const TIMELINE = {
  opensOn: '2026-10-25',
  closesOn: '2026-11-13',
  deliveryStartsOn: '2026-11-16',
  deliveryEndsOn: '2026-11-18',
  updatedAt: '2026-10-26T09:00:00.000Z',
};

function seedSession() {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { email: 'admin@test.com' } }));
  return token;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminAuthProvider>
        <AdminOrderTimeline />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

async function setDate(user, label, value) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, value);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AdminOrderTimeline', () => {
  test('loads the current timeline into the form, with a customer-facing preview', async () => {
    seedSession();
    api.adminGetOrderTimeline.mockResolvedValue(TIMELINE);
    renderPage();

    expect(await screen.findByLabelText('Ordering opens')).toHaveValue('2026-10-25');
    expect(screen.getByLabelText('Ordering closes')).toHaveValue('2026-11-13');
    expect(screen.getByLabelText('Delivery starts')).toHaveValue('2026-11-16');
    expect(screen.getByLabelText('Delivery ends')).toHaveValue('2026-11-18');
    expect(screen.getByText('16th – 18th of November')).toBeInTheDocument();
  });

  test('saves the edited timeline', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetOrderTimeline.mockResolvedValue(TIMELINE);
    api.adminUpdateOrderTimeline.mockResolvedValue(TIMELINE);
    renderPage();
    await screen.findByLabelText('Ordering opens');

    await setDate(user, 'Delivery ends', '2026-11-19');
    await user.click(screen.getByRole('button', { name: 'Save timeline' }));

    expect(api.adminUpdateOrderTimeline).toHaveBeenCalledWith(token, {
      opensOn: '2026-10-25',
      closesOn: '2026-11-13',
      deliveryStartsOn: '2026-11-16',
      deliveryEndsOn: '2026-11-19',
    });
    expect(await screen.findByText('Order timeline saved.')).toBeInTheDocument();
  });

  test('blocks saving when delivery starts before ordering closes', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetOrderTimeline.mockResolvedValue(TIMELINE);
    renderPage();
    await screen.findByLabelText('Ordering opens');

    await setDate(user, 'Delivery starts', '2026-11-10');
    await user.click(screen.getByRole('button', { name: 'Save timeline' }));

    expect(screen.getByText('Delivery must start after ordering closes.')).toBeInTheDocument();
    expect(api.adminUpdateOrderTimeline).not.toHaveBeenCalled();
  });

  test('shows a server error', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetOrderTimeline.mockResolvedValue(TIMELINE);
    api.adminUpdateOrderTimeline.mockRejectedValue(new Error('Server says no'));
    renderPage();
    await screen.findByLabelText('Ordering opens');

    await user.click(screen.getByRole('button', { name: 'Save timeline' }));
    expect(await screen.findByText('Server says no')).toBeInTheDocument();
  });

  test('starts empty when no timeline has been set yet', async () => {
    seedSession();
    api.adminGetOrderTimeline.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByLabelText('Ordering opens')).toHaveValue('');
  });
});
