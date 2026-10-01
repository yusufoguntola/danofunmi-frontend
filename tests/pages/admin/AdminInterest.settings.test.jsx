import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminInterest from '../../../src/pages/admin/AdminInterest';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { confirmAction } from '../../../src/lib/confirm';
import { fakeJwt } from '../../helpers/fakeJwt';

const STORAGE_KEY = 'danofunmi_admin_session';

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useOutletContext: () => ({ refreshUnreadInterest: vi.fn() }),
}));

vi.mock('../../../src/lib/api', () => ({
  api: {
    adminListInterest: vi.fn(),
    adminGetInterestSettings: vi.fn(),
    getLocations: vi.fn(),
    adminMarkAllInterestRead: vi.fn(),
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

function makeRow(overrides = {}) {
  return {
    id: 'r1',
    createdAt: '2026-09-01T10:00:00Z',
    name: 'Ada Lovelace',
    email: 'ada@test.com',
    phone: '08011111111',
    address: '12 Main St',
    landmark: null,
    excites: null,
    readAt: '2026-09-01T10:05:00Z',
    shortlisted: false,
    claimedSlot: false,
    orderId: null,
    finalEmailSentAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.getLocations.mockResolvedValue([]);
  api.adminMarkAllInterestRead.mockResolvedValue({});
  api.adminListInterest.mockResolvedValue([]);
});

describe('AdminInterest — slots settings', () => {
  test('renders the current slots summary', async () => {
    seedSession();
    api.adminGetInterestSettings.mockResolvedValue({ slotsTotal: 10, slotsClaimed: 3, slotsRemaining: 7 });

    renderPage();

    expect(await screen.findByText('3 of 10 claimed · 7 left')).toBeInTheDocument();
  });

  test('submitting a new slot total saves it and refreshes the summary', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetInterestSettings.mockResolvedValue({ slotsTotal: 10, slotsClaimed: 3, slotsRemaining: 7 });
    api.adminUpdateInterestSettings.mockResolvedValue({ slotsTotal: 20, slotsClaimed: 3, slotsRemaining: 17 });

    renderPage();
    await screen.findByText('3 of 10 claimed · 7 left');

    const input = screen.getByDisplayValue('10');
    await user.clear(input);
    await user.type(input, '20');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.adminUpdateInterestSettings).toHaveBeenCalledWith(token, 20));
    expect(await screen.findByText('3 of 20 claimed · 17 left')).toBeInTheDocument();
  });

  test('rejects a negative slot total without calling the API', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetInterestSettings.mockResolvedValue({ slotsTotal: 10, slotsClaimed: 3, slotsRemaining: 7 });

    renderPage();
    await screen.findByText('3 of 10 claimed · 7 left');

    const input = screen.getByDisplayValue('10');
    await user.clear(input);
    await user.type(input, '-5');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.adminUpdateInterestSettings).not.toHaveBeenCalled();
  });
});

describe('AdminInterest — send shortlist emails', () => {
  test('is disabled with a "none waiting" message when nothing is pending', async () => {
    seedSession();
    api.adminGetInterestSettings.mockResolvedValue({ slotsTotal: 10, slotsClaimed: 0, slotsRemaining: 10 });
    api.adminListInterest.mockResolvedValue([makeRow({ shortlisted: true, finalEmailSentAt: '2026-09-02T00:00:00Z' })]);

    renderPage();

    expect(await screen.findByText('None waiting on the "you made the list" email.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send email to shortlisted' })).toBeDisabled();
  });

  test('shows the pending count and sends on confirmation, then reloads the list', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetInterestSettings.mockResolvedValue({ slotsTotal: 10, slotsClaimed: 0, slotsRemaining: 10 });
    const pendingRow = makeRow({ shortlisted: true, finalEmailSentAt: null });
    api.adminListInterest.mockResolvedValueOnce([pendingRow]).mockResolvedValueOnce([
      { ...pendingRow, finalEmailSentAt: '2026-09-03T00:00:00Z' },
    ]);
    confirmAction.mockResolvedValue(true);
    api.adminSendShortlistEmails.mockResolvedValue({ sent: 1, failed: [] });

    renderPage();
    expect(await screen.findByText('1 not yet emailed.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send email to shortlisted' }));

    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Send the "you made the list" email?' })
    );
    await waitFor(() => expect(api.adminSendShortlistEmails).toHaveBeenCalled());
    expect(await screen.findByText('Sent 1')).toBeInTheDocument();
    await waitFor(() => expect(api.adminListInterest).toHaveBeenCalledTimes(2));
  });

  test('shows failures alongside the sent count', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetInterestSettings.mockResolvedValue({ slotsTotal: 10, slotsClaimed: 0, slotsRemaining: 10 });
    api.adminListInterest.mockResolvedValue([makeRow({ shortlisted: true, finalEmailSentAt: null })]);
    confirmAction.mockResolvedValue(true);
    api.adminSendShortlistEmails.mockResolvedValue({ sent: 0, failed: ['ada@test.com'] });

    renderPage();
    await screen.findByText('1 not yet emailed.');
    await user.click(screen.getByRole('button', { name: 'Send email to shortlisted' }));

    expect(await screen.findByText(/Sent 0 — failed for: ada@test.com/)).toBeInTheDocument();
  });

  test('declining the confirmation sends no email', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetInterestSettings.mockResolvedValue({ slotsTotal: 10, slotsClaimed: 0, slotsRemaining: 10 });
    api.adminListInterest.mockResolvedValue([makeRow({ shortlisted: true, finalEmailSentAt: null })]);
    confirmAction.mockResolvedValue(false);

    renderPage();
    await screen.findByText('1 not yet emailed.');
    await user.click(screen.getByRole('button', { name: 'Send email to shortlisted' }));

    expect(api.adminSendShortlistEmails).not.toHaveBeenCalled();
  });
});
