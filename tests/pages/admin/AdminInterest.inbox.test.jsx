import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminInterest from '../../../src/pages/admin/AdminInterest';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { confirmAction, confirmDelete, confirmWithSelect, alertError } from '../../../src/lib/confirm';
import { fakeJwt } from '../../helpers/fakeJwt';

const STORAGE_KEY = 'danofunmi_admin_session';

const mockRefreshUnreadInterest = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useOutletContext: () => ({ refreshUnreadInterest: mockRefreshUnreadInterest }),
}));

vi.mock('../../../src/lib/api', () => ({
  api: {
    adminListInterest: vi.fn(),
    adminGetInterestSettings: vi.fn(),
    getLocations: vi.fn(),
    adminMarkAllInterestRead: vi.fn(),
    adminMarkInterestRead: vi.fn(),
    adminSetInterestShortlisted: vi.fn(),
    adminSetInterestClaimedSlot: vi.fn(),
    adminCreateFirstTasteOrder: vi.fn(),
    adminDeleteInterest: vi.fn(),
    adminUpdateInterestSettings: vi.fn(),
    adminSendShortlistEmails: vi.fn(),
  },
}));

vi.mock('../../../src/lib/confirm', () => ({
  confirmAction: vi.fn(),
  confirmDelete: vi.fn(),
  confirmWithSelect: vi.fn(),
  alertError: vi.fn(),
}));

function seedSession() {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { email: 'admin@test.com' } }));
  return token;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminAuthProvider>
        <AdminInterest />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

const LOCATIONS = [
  { id: 'loc1', name: 'Lekki' },
  { id: 'loc2', name: 'Akobo' },
];

function makeRow(overrides = {}) {
  return {
    id: 'r1',
    createdAt: '2026-09-01T10:00:00Z',
    name: 'Ada Lovelace',
    email: 'ada@test.com',
    phone: '08011111111',
    address: '12 Main St',
    landmark: null,
    excites: 'The jollof!',
    readAt: null,
    shortlisted: false,
    claimedSlot: false,
    orderId: null,
    finalEmailSentAt: null,
    ...overrides,
  };
}

const SETTINGS = { slotsTotal: 10, slotsClaimed: 3, slotsRemaining: 7 };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.getLocations.mockResolvedValue(LOCATIONS);
  api.adminGetInterestSettings.mockResolvedValue(SETTINGS);
  api.adminMarkAllInterestRead.mockResolvedValue({});
});

describe('AdminInterest — list + read toggle', () => {
  test('renders the registration list with contact info', async () => {
    seedSession();
    api.adminListInterest.mockResolvedValue([makeRow()]);

    renderPage();

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@test.com')).toBeInTheDocument();
    expect(screen.getByText('08011111111')).toBeInTheDocument();
    expect(screen.getByText('12 Main St')).toBeInTheDocument();
  });

  test('shows an empty state when nobody has registered', async () => {
    seedSession();
    api.adminListInterest.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('No one has registered interest yet.')).toBeInTheDocument();
  });

  test('marks everything read on mount and notifies the layout', async () => {
    const token = seedSession();
    api.adminListInterest.mockResolvedValue([makeRow()]);

    renderPage();

    await waitFor(() => expect(api.adminMarkAllInterestRead).toHaveBeenCalledWith(token));
    await waitFor(() => expect(mockRefreshUnreadInterest).toHaveBeenCalled());
  });

  test('toggles a row between read and unread', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    const row = makeRow();
    api.adminListInterest.mockResolvedValue([row]);
    // The mount effect optimistically marks everything read locally, so by
    // the time we can interact, the row already reads as read — toggling
    // flips it back to unread.
    api.adminMarkInterestRead.mockResolvedValue({ ...row, readAt: null });

    renderPage();
    await screen.findByText('Ada Lovelace');
    await waitFor(() => expect(mockRefreshUnreadInterest).toHaveBeenCalled());

    await user.click(screen.getByText('Ada Lovelace'));
    const markUnreadBtn = await screen.findByRole('button', { name: 'Mark unread' });
    await user.click(markUnreadBtn);

    expect(api.adminMarkInterestRead).toHaveBeenCalledWith(token, 'r1', false);
    await screen.findByRole('button', { name: 'Mark read' });
  });
});

describe('AdminInterest — shortlist toggle', () => {
  test('shortlisting a not-yet-ordered row opens the location picker and creates the order', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    const row = makeRow();
    api.adminListInterest.mockResolvedValue([row]);
    confirmWithSelect.mockResolvedValue('loc2');
    api.adminSetInterestShortlisted.mockResolvedValue({ ...row, shortlisted: true });

    renderPage();
    await screen.findByText('Ada Lovelace');

    await user.click(screen.getByRole('button', { name: 'Shortlist' }));

    expect(confirmWithSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Shortlist Ada Lovelace?',
        options: [{ value: 'loc1', label: 'Lekki' }, { value: 'loc2', label: 'Akobo' }],
      })
    );
    await waitFor(() =>
      expect(api.adminSetInterestShortlisted).toHaveBeenCalledWith(token, 'r1', true, 'loc2')
    );
    expect(await screen.findByRole('button', { name: 'Shortlisted ✓' })).toBeInTheDocument();
  });

  test('cancelling the location picker makes no API call', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminListInterest.mockResolvedValue([makeRow()]);
    confirmWithSelect.mockResolvedValue(null);

    renderPage();
    await screen.findByText('Ada Lovelace');

    await user.click(screen.getByRole('button', { name: 'Shortlist' }));

    expect(api.adminSetInterestShortlisted).not.toHaveBeenCalled();
  });

  test('un-shortlisting an already-shortlisted row skips the location picker entirely', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    const row = makeRow({ shortlisted: true });
    api.adminListInterest.mockResolvedValue([row]);
    api.adminSetInterestShortlisted.mockResolvedValue({ ...row, shortlisted: false });

    renderPage();
    await screen.findByText('Ada Lovelace');

    await user.click(screen.getByRole('button', { name: 'Shortlisted ✓' }));

    expect(confirmWithSelect).not.toHaveBeenCalled();
    expect(api.adminSetInterestShortlisted).toHaveBeenCalledWith(token, 'r1', false);
    expect(await screen.findByRole('button', { name: 'Shortlist' })).toBeInTheDocument();
  });

  test('order-creation failure during shortlisting alerts and re-loads from the server', async () => {
    const user = userEvent.setup();
    seedSession();
    const row = makeRow();
    // First load (mount) returns the pristine row; after the failed
    // shortlist+order-creation call, the component re-`load()`s — simulate
    // the server having actually saved shortlisted=true despite the order
    // creation failing, which is exactly the inconsistency this recovery
    // path exists for.
    api.adminListInterest
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ ...row, shortlisted: true }]);
    confirmWithSelect.mockResolvedValue('loc1');
    api.adminSetInterestShortlisted.mockRejectedValue(new Error('order creation failed'));
    alertError.mockResolvedValue(undefined);

    renderPage();
    await screen.findByText('Ada Lovelace');

    await user.click(screen.getByRole('button', { name: 'Shortlist' }));

    await waitFor(() => expect(alertError).toHaveBeenCalledWith('Could not create their order', 'order creation failed'));
    await waitFor(() => expect(api.adminListInterest).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Shortlisted ✓' })).toBeInTheDocument();
  });
});

describe('AdminInterest — claimed-slot toggle', () => {
  test('toggling claimed-slot updates the row and refreshes the slots settings card', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    const row = makeRow();
    api.adminListInterest.mockResolvedValue([row]);
    api.adminSetInterestClaimedSlot.mockResolvedValue({ ...row, claimedSlot: true });

    renderPage();
    await screen.findByText('Ada Lovelace');
    await waitFor(() => expect(api.adminGetInterestSettings).toHaveBeenCalledTimes(1));

    await user.click(screen.getByText('Ada Lovelace'));
    await user.click(screen.getByRole('button', { name: 'General' }));

    expect(api.adminSetInterestClaimedSlot).toHaveBeenCalledWith(token, 'r1', true);
    expect(await screen.findByRole('button', { name: 'First taste ✓' })).toBeInTheDocument();
    await waitFor(() => expect(api.adminGetInterestSettings).toHaveBeenCalledTimes(2));
  });
});

describe('AdminInterest — manual create-order action', () => {
  test('a shortlisted row without an order shows a location picker + "Create order"', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    const row = makeRow({ shortlisted: true });
    api.adminListInterest.mockResolvedValue([row]);
    confirmAction.mockResolvedValue(true);
    api.adminCreateFirstTasteOrder.mockResolvedValue({ order: { id: 'order-9' } });

    renderPage();
    await screen.findByText('Ada Lovelace');
    await user.click(screen.getByText('Ada Lovelace'));

    await user.click(screen.getByRole('button', { name: 'Create order' }));

    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Create their first-taste order?' })
    );
    await waitFor(() =>
      expect(api.adminCreateFirstTasteOrder).toHaveBeenCalledWith(token, 'r1', 'loc1')
    );
    expect(await screen.findByText('Order created')).toBeInTheDocument();
  });

  test('a row that already has an order shows "Order created" with no picker', async () => {
    const user = userEvent.setup();
    seedSession();
    const row = makeRow({ shortlisted: true, orderId: 'order-1' });
    api.adminListInterest.mockResolvedValue([row]);

    renderPage();
    await screen.findByText('Ada Lovelace');
    await user.click(screen.getByText('Ada Lovelace'));

    expect(screen.getByText('Order created')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create order' })).not.toBeInTheDocument();
  });

  test('declining the create-order confirmation makes no API call', async () => {
    const user = userEvent.setup();
    seedSession();
    const row = makeRow({ shortlisted: true });
    api.adminListInterest.mockResolvedValue([row]);
    confirmAction.mockResolvedValue(false);

    renderPage();
    await screen.findByText('Ada Lovelace');
    await user.click(screen.getByText('Ada Lovelace'));
    await user.click(screen.getByRole('button', { name: 'Create order' }));

    expect(api.adminCreateFirstTasteOrder).not.toHaveBeenCalled();
  });
});

describe('AdminInterest — delete', () => {
  test('deleting a row confirms, calls the API, and removes it', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    const row = makeRow();
    api.adminListInterest.mockResolvedValue([row]);
    confirmDelete.mockResolvedValue(true);
    api.adminDeleteInterest.mockResolvedValue({});

    renderPage();
    await screen.findByText('Ada Lovelace');
    await user.click(screen.getByText('Ada Lovelace'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirmDelete).toHaveBeenCalledWith("Ada Lovelace's interest registration");
    await waitFor(() => expect(api.adminDeleteInterest).toHaveBeenCalledWith(token, 'r1'));
    expect(await screen.findByText('No one has registered interest yet.')).toBeInTheDocument();
  });

  test('cancelling the delete confirmation leaves the row intact', async () => {
    const user = userEvent.setup();
    seedSession();
    const row = makeRow();
    api.adminListInterest.mockResolvedValue([row]);
    confirmDelete.mockResolvedValue(false);

    renderPage();
    await screen.findByText('Ada Lovelace');
    await user.click(screen.getByText('Ada Lovelace'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(api.adminDeleteInterest).not.toHaveBeenCalled();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });
});
