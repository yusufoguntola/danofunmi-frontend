import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminLocations from '../../../src/pages/admin/AdminLocations';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { fakeJwt } from '../../helpers/fakeJwt';

vi.mock('../../../src/lib/api', () => ({
  api: { adminListLocations: vi.fn(), adminCreateLocation: vi.fn(), adminUpdateLocation: vi.fn() },
}));

const STORAGE_KEY = 'danofunmi_admin_session';

function seedSession() {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { name: 'Ada Admin' } }));
}

function renderPage() {
  return render(
    <AdminAuthProvider>
      <AdminLocations />
    </AdminAuthProvider>
  );
}

function makeLocation(overrides = {}) {
  return { id: 'l1', name: 'Bodija, Ibadan', logisticsFee: 800, active: true, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  seedSession();
});

describe('AdminLocations', () => {
  test('renders the location list', async () => {
    api.adminListLocations.mockResolvedValue([makeLocation()]);
    renderPage();
    expect(await screen.findByDisplayValue('Bodija, Ibadan')).toBeInTheDocument();
  });

  test('shows the empty state when there are no locations', async () => {
    api.adminListLocations.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No locations yet — add one below.')).toBeInTheDocument();
  });

  test('an untouched row shows no Save button', async () => {
    api.adminListLocations.mockResolvedValue([makeLocation()]);
    renderPage();
    await screen.findByDisplayValue('Bodija, Ibadan');

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  test('editing a field reveals the Save button for that row', async () => {
    const user = userEvent.setup();
    api.adminListLocations.mockResolvedValue([makeLocation()]);
    renderPage();
    const nameInput = await screen.findByDisplayValue('Bodija, Ibadan');

    await user.type(nameInput, ' Extra');

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  test('Save sends just that row’s full draft (preserving fields untouched by this edit) to adminUpdateLocation', async () => {
    // Regression test for a real bug: draftFor() used to fall back to a
    // synthetic {id, ...prevDraft} object instead of the row's real fetched
    // values, so editing only the name field on its first edit wiped the
    // logisticsFee/active fields in the draft to undefined. Fixed in
    // AdminLocations.jsx by having draftFor(id) look up the original row
    // from `locations` instead.
    const user = userEvent.setup();
    api.adminListLocations.mockResolvedValue([makeLocation({ name: 'Bodija, Ibadan', logisticsFee: 800, active: true })]);
    api.adminUpdateLocation.mockResolvedValue({});
    renderPage();
    const nameInput = await screen.findByDisplayValue('Bodija, Ibadan');

    // A single character edit — the first-ever edit to this row's draft.
    await user.type(nameInput, '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.adminUpdateLocation).toHaveBeenCalledWith(expect.any(String), 'l1', {
      name: 'Bodija, Ibadan!',
      logisticsFee: 800,
      active: true,
    });
  });

  test('Save clears the draft and reloads, hiding the Save button again', async () => {
    const user = userEvent.setup();
    api.adminListLocations
      .mockResolvedValueOnce([makeLocation()])
      .mockResolvedValueOnce([makeLocation({ name: 'Bodija, Ibadan Extra' })]);
    api.adminUpdateLocation.mockResolvedValue({});
    renderPage();
    const nameInput = await screen.findByDisplayValue('Bodija, Ibadan');

    await user.type(nameInput, ' Extra');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByDisplayValue('Bodija, Ibadan Extra')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  test('creating a new location submits the form and reloads the list', async () => {
    const user = userEvent.setup();
    api.adminListLocations.mockResolvedValue([]);
    api.adminCreateLocation.mockResolvedValue({});
    renderPage();
    await screen.findByText('No locations yet — add one below.');

    api.adminListLocations.mockResolvedValue([makeLocation({ name: 'Challenge, Ibadan', logisticsFee: 500 })]);

    await user.type(screen.getByLabelText('Name'), 'Challenge, Ibadan');
    await user.type(screen.getByLabelText(/Logistics fee/), '500');
    await user.click(screen.getByRole('button', { name: 'Add location' }));

    expect(api.adminCreateLocation).toHaveBeenCalledWith(expect.any(String), {
      name: 'Challenge, Ibadan',
      logisticsFee: 500,
    });
    expect(await screen.findByDisplayValue('Challenge, Ibadan')).toBeInTheDocument();
  });

  test('blocks creating a location with no name or fee', async () => {
    const user = userEvent.setup();
    api.adminListLocations.mockResolvedValue([]);
    renderPage();
    await screen.findByText('No locations yet — add one below.');

    await user.click(screen.getByRole('button', { name: 'Add location' }));

    expect(screen.getByText('Name and logistics fee are required.')).toBeInTheDocument();
    expect(api.adminCreateLocation).not.toHaveBeenCalled();
  });
});
