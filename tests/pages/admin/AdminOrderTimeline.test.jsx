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
    adminGetOrderTimelineHistory: vi.fn(),
    adminSaveOrderTimeline: vi.fn(),
  },
}));

const TIMELINE = {
  id: 'tl_1',
  opensOn: '2026-10-25',
  closesOn: '2026-11-13',
  deliveryStartsOn: '2026-11-16',
  deliveryEndsOn: '2026-11-18',
  createdByName: 'Ada Admin',
  createdAt: '2026-10-26T09:00:00.000Z',
};

const OLDER = {
  id: 'tl_0',
  opensOn: '2026-09-24',
  closesOn: '2026-10-11',
  deliveryStartsOn: '2026-10-14',
  deliveryEndsOn: '2026-10-16',
  createdByName: null,
  createdAt: '2026-09-20T09:00:00.000Z',
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
    api.adminGetOrderTimelineHistory.mockResolvedValue([TIMELINE, OLDER]);
    renderPage();

    expect(await screen.findByLabelText('Ordering opens')).toHaveValue('2026-10-25');
    expect(screen.getByLabelText('Ordering closes')).toHaveValue('2026-11-13');
    expect(screen.getByLabelText('Delivery starts')).toHaveValue('2026-11-16');
    expect(screen.getByLabelText('Delivery ends')).toHaveValue('2026-11-18');
    // In the preview line and the history table's current row.
    expect(screen.getAllByText('16th – 18th of November').length).toBeGreaterThan(0);
  });

  test('lists past timelines, newest first, marking the current one', async () => {
    seedSession();
    api.adminGetOrderTimelineHistory.mockResolvedValue([TIMELINE, OLDER]);
    renderPage();

    const rows = (await screen.findAllByRole('row')).slice(1); // skip the header row
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Current');
    expect(rows[0]).toHaveTextContent('Ada Admin');
    expect(rows[1]).toHaveTextContent('14th – 16th of October');
    expect(rows[1]).not.toHaveTextContent('Current');
  });

  test('"Use these dates" copies a past timeline into the form', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetOrderTimelineHistory.mockResolvedValue([TIMELINE, OLDER]);
    renderPage();
    await screen.findByLabelText('Ordering opens');

    await user.click(screen.getByRole('button', { name: 'Use these dates' }));
    expect(screen.getByLabelText('Ordering opens')).toHaveValue('2026-09-24');
    expect(screen.getByLabelText('Delivery ends')).toHaveValue('2026-10-16');
  });

  test('saves the edited timeline', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetOrderTimelineHistory.mockResolvedValue([TIMELINE, OLDER]);
    api.adminSaveOrderTimeline.mockResolvedValue({ ...TIMELINE, id: 'tl_2', deliveryEndsOn: '2026-11-19' });
    renderPage();
    await screen.findByLabelText('Ordering opens');

    await setDate(user, 'Delivery ends', '2026-11-19');
    await user.click(screen.getByRole('button', { name: 'Save timeline' }));

    expect(api.adminSaveOrderTimeline).toHaveBeenCalledWith(token, {
      opensOn: '2026-10-25',
      closesOn: '2026-11-13',
      deliveryStartsOn: '2026-11-16',
      deliveryEndsOn: '2026-11-19',
    });
    expect(await screen.findByText('Order timeline saved.')).toBeInTheDocument();
    // The new timeline joins the top of the history; the previous one stays.
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('16th – 19th of November');
    expect(rows[0]).toHaveTextContent('Current');
  });

  test('blocks saving when delivery starts before ordering closes', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetOrderTimelineHistory.mockResolvedValue([TIMELINE, OLDER]);
    renderPage();
    await screen.findByLabelText('Ordering opens');

    await setDate(user, 'Delivery starts', '2026-11-10');
    await user.click(screen.getByRole('button', { name: 'Save timeline' }));

    expect(screen.getByText('Delivery must start after ordering closes.')).toBeInTheDocument();
    expect(api.adminSaveOrderTimeline).not.toHaveBeenCalled();
  });

  test('shows a server error', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetOrderTimelineHistory.mockResolvedValue([TIMELINE, OLDER]);
    api.adminSaveOrderTimeline.mockRejectedValue(new Error('Server says no'));
    renderPage();
    await screen.findByLabelText('Ordering opens');

    await user.click(screen.getByRole('button', { name: 'Save timeline' }));
    expect(await screen.findByText('Server says no')).toBeInTheDocument();
  });

  test('starts empty, with no history, when no timeline has been set yet', async () => {
    seedSession();
    api.adminGetOrderTimelineHistory.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByLabelText('Ordering opens')).toHaveValue('');
    expect(screen.queryByText('History')).not.toBeInTheDocument();
  });
});
