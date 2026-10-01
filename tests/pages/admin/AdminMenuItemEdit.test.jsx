import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminMenuItemEdit from '../../../src/pages/admin/AdminMenuItemEdit';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api, ApiError } from '../../../src/lib/api';
import { confirmAction, confirmDelete } from '../../../src/lib/confirm';
import { fakeJwt } from '../../helpers/fakeJwt';

const STORAGE_KEY = 'danofunmi_admin_session';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../src/lib/api', () => ({
  api: {
    adminGetMenuItem: vi.fn(),
    adminListCategories: vi.fn(),
    adminUpdateMenuItem: vi.fn(),
    adminDeleteMenuItem: vi.fn(),
    adminUpdateMenuOption: vi.fn(),
    adminDeleteMenuOption: vi.fn(),
    adminAddMenuOption: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(message, status, body) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
}));

vi.mock('../../../src/lib/confirm', () => ({
  confirmAction: vi.fn(),
  confirmDelete: vi.fn(),
}));

vi.mock('../../../src/components/IconPicker', () => ({
  default: () => <div>Icon Picker</div>,
}));

function seedSession() {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { email: 'admin@test.com' } }));
  return token;
}

function renderPage(id = 'item1') {
  return render(
    <MemoryRouter initialEntries={[`/restricted-path/menu/${id}`]}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/restricted-path/menu/:id" element={<AdminMenuItemEdit />} />
        </Routes>
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

const CATEGORIES = [
  { id: 'cat1', name: 'Soups' },
  { id: 'cat2', name: 'Proteins' },
];

function baseItem(overrides = {}) {
  return {
    id: 'item1',
    name: 'Egusi Soup',
    categoryId: 'cat1',
    description: 'Rich and hearty',
    icon: '🍲',
    active: true,
    options: [
      { id: 'opt1', size: '1L', price: 4000, active: true },
      { id: 'opt2', size: '2L', price: 7000, active: true },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.adminListCategories.mockResolvedValue(CATEGORIES);
});

describe('AdminMenuItemEdit', () => {
  test('loads and pre-fills the form from the existing item', async () => {
    seedSession();
    api.adminGetMenuItem.mockResolvedValue(baseItem());

    renderPage();

    expect(await screen.findByDisplayValue('Egusi Soup')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Rich and hearty')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('cat1');
    expect(screen.getByRole('checkbox', { name: /Active \(visible to customers\)/ })).toBeChecked();
    expect(screen.getByText('1L')).toBeInTheDocument();
    expect(screen.getByText('2L')).toBeInTheDocument();
  });

  test('shows a load error instead of the form when the fetch fails', async () => {
    seedSession();
    api.adminGetMenuItem.mockRejectedValue(new ApiError('Item not found', 404, null));

    renderPage();

    expect(await screen.findByText('Item not found')).toBeInTheDocument();
  });

  test('editing a top-level field and saving calls adminUpdateMenuItem with the new form', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetMenuItem.mockResolvedValue(baseItem());
    api.adminUpdateMenuItem.mockResolvedValue({});

    renderPage();
    const nameInput = await screen.findByDisplayValue('Egusi Soup');

    await user.clear(nameInput);
    await user.type(nameInput, 'Egusi Deluxe');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(api.adminUpdateMenuItem).toHaveBeenCalledWith(token, 'item1', {
        name: 'Egusi Deluxe',
        categoryId: 'cat1',
        description: 'Rich and hearty',
        icon: '🍲',
        active: true,
      })
    );
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  test('shows a save error without crashing', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetMenuItem.mockResolvedValue(baseItem());
    api.adminUpdateMenuItem.mockRejectedValue(new ApiError('Name already in use', 400, null));

    renderPage();
    await screen.findByDisplayValue('Egusi Soup');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Name already in use')).toBeInTheDocument();
  });

  test('editing one option row shows only its own Save button', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetMenuItem.mockResolvedValue(baseItem());

    renderPage();
    await screen.findByDisplayValue('Egusi Soup');

    const row1 = screen.getByText('1L').closest('div');
    const row2 = screen.getByText('2L').closest('div');

    expect(within(row1).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(within(row2).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    const priceInput1 = within(row1).getByRole('spinbutton');
    await user.clear(priceInput1);
    await user.type(priceInput1, '5000');

    expect(within(row1).getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(within(row2).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  test('saving an edited option row calls adminUpdateMenuOption with its draft', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetMenuItem.mockResolvedValue(baseItem());
    api.adminUpdateMenuOption.mockResolvedValue({});

    renderPage();
    await screen.findByDisplayValue('Egusi Soup');

    const row1 = screen.getByText('1L').closest('div');
    const priceInput1 = within(row1).getByRole('spinbutton');
    await user.clear(priceInput1);
    await user.type(priceInput1, '5000');
    await user.click(within(row1).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.adminUpdateMenuOption).toHaveBeenCalledWith(token, 'opt1', { price: '5000', active: true })
    );
  });

  test('deleting an option row calls adminDeleteMenuOption after confirming', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetMenuItem.mockResolvedValue(baseItem());
    confirmDelete.mockResolvedValue(true);
    api.adminDeleteMenuOption.mockResolvedValue({});

    renderPage();
    await screen.findByDisplayValue('Egusi Soup');

    const row2 = screen.getByText('2L').closest('div');
    await user.click(within(row2).getByRole('button', { name: 'Remove' }));

    expect(confirmDelete).toHaveBeenCalledWith('the 2L size');
    await waitFor(() => expect(api.adminDeleteMenuOption).toHaveBeenCalledWith(token, 'opt2'));
  });

  test('does not delete an option row when confirm is cancelled', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetMenuItem.mockResolvedValue(baseItem());
    confirmDelete.mockResolvedValue(false);

    renderPage();
    await screen.findByDisplayValue('Egusi Soup');

    const row2 = screen.getByText('2L').closest('div');
    await user.click(within(row2).getByRole('button', { name: 'Remove' }));

    expect(api.adminDeleteMenuOption).not.toHaveBeenCalled();
  });

  test('adding a new option row calls adminAddMenuOption with the right shape', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetMenuItem.mockResolvedValue(baseItem());
    api.adminAddMenuOption.mockResolvedValue({});

    renderPage();
    await screen.findByDisplayValue('Egusi Soup');

    await user.type(screen.getByPlaceholderText('e.g. 3L'), '3L');
    await user.type(screen.getByPlaceholderText('Price'), '9000');
    await user.click(screen.getByRole('button', { name: '+ Add size' }));

    await waitFor(() =>
      expect(api.adminAddMenuOption).toHaveBeenCalledWith(token, 'item1', { size: '3L', price: 9000 })
    );
  });

  test('deleting the whole item navigates away after confirming', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetMenuItem.mockResolvedValue(baseItem());
    confirmAction.mockResolvedValue(true);
    api.adminDeleteMenuItem.mockResolvedValue({});

    renderPage();
    await screen.findByDisplayValue('Egusi Soup');

    await user.click(screen.getByRole('button', { name: 'Delete item' }));

    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Delete "Egusi Soup"?', danger: true })
    );
    await waitFor(() => expect(api.adminDeleteMenuItem).toHaveBeenCalledWith(token, 'item1'));
    expect(mockNavigate).toHaveBeenCalledWith('/restricted-path/menu');
  });

  test('does not delete the whole item when confirm is cancelled', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetMenuItem.mockResolvedValue(baseItem());
    confirmAction.mockResolvedValue(false);

    renderPage();
    await screen.findByDisplayValue('Egusi Soup');

    await user.click(screen.getByRole('button', { name: 'Delete item' }));

    expect(api.adminDeleteMenuItem).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
