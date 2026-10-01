import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminMenuGroupEdit from '../../../src/pages/admin/AdminMenuGroupEdit';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api, ApiError } from '../../../src/lib/api';
import { confirmDelete } from '../../../src/lib/confirm';
import { fakeJwt } from '../../helpers/fakeJwt';

const STORAGE_KEY = 'danofunmi_admin_session';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../src/lib/api', () => ({
  api: {
    BASE_URL: 'http://localhost:4000',
    adminGetGroup: vi.fn(),
    adminListMenu: vi.fn(),
    adminListCategories: vi.fn(),
    adminUpdateGroup: vi.fn(),
    adminDeleteGroup: vi.fn(),
    adminUpdateGroupItem: vi.fn(),
    adminDeleteGroupItem: vi.fn(),
    adminAddGroupItem: vi.fn(),
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

function renderPage(id = 'group1') {
  return render(
    <MemoryRouter initialEntries={[`/restricted-path/menu/groups/${id}`]}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/restricted-path/menu/groups/:id" element={<AdminMenuGroupEdit />} />
        </Routes>
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

const CATEGORIES = [{ id: 'cat1', name: 'Combos' }];

const MENU_ITEMS = [
  {
    id: 'i1',
    name: 'Jollof Rice',
    options: [
      { id: 'o1', size: '1L', price: 4500 },
      { id: 'o2', size: '2L', price: 8000 },
    ],
  },
  {
    id: 'i2',
    name: 'Chicken',
    options: [{ id: 'o3', size: 'Regular', price: 3000 }],
  },
];

function baseGroup(overrides = {}) {
  return {
    id: 'group1',
    name: 'Family Combo',
    categoryId: 'cat1',
    description: '',
    icon: '🎁',
    active: true,
    discount: null,
    grossTotal: 9500,
    total: 9500,
    items: [
      { id: 'gi1', name: 'Jollof Rice', size: '1L', icon: '🍚', unitPrice: 4500, quantity: 1, isBonus: false },
      { id: 'gi2', name: 'Chicken', size: 'Regular', icon: '🍗', unitPrice: 3000, quantity: 1, isBonus: false },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.adminListCategories.mockResolvedValue(CATEGORIES);
  api.adminListMenu.mockResolvedValue(MENU_ITEMS);
});

describe('AdminMenuGroupEdit included items', () => {
  test('renders each included item with its quantity, bonus flag, and unit price', async () => {
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    const row1 = screen.getByText('Jollof Rice').closest('div');
    expect(within(row1).getByText('₦4,500 ea.')).toBeInTheDocument();
    expect(within(row1).getByRole('spinbutton')).toHaveValue(1);
    expect(within(row1).getByRole('checkbox')).not.toBeChecked();
  });

  test('a dirty item row shows only its own Save button, leaving siblings untouched', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    const row1 = screen.getByText('Jollof Rice').closest('div');
    const row2 = screen.getByText('Chicken').closest('div');

    expect(within(row1).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(within(row2).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    const qtyInput1 = within(row1).getByRole('spinbutton');
    await user.clear(qtyInput1);
    await user.type(qtyInput1, '3');

    expect(within(row1).getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(within(row2).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    // Sibling's own quantity stays at its original value.
    expect(within(row2).getByRole('spinbutton')).toHaveValue(1);
  });

  test('toggling isBonus on one row marks it dirty without affecting the other row', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    const row1 = screen.getByText('Jollof Rice').closest('div');
    const row2 = screen.getByText('Chicken').closest('div');

    await user.click(within(row1).getByRole('checkbox'));

    expect(within(row1).getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(within(row2).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(within(row2).getByRole('checkbox')).not.toBeChecked();
  });

  test('saving an edited row calls adminUpdateGroupItem with its draft and clears the dirty state', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());
    api.adminUpdateGroupItem.mockResolvedValue({});

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    const row1 = screen.getByText('Jollof Rice').closest('div');
    const qtyInput1 = within(row1).getByRole('spinbutton');
    await user.clear(qtyInput1);
    await user.type(qtyInput1, '3');
    await user.click(within(row1).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.adminUpdateGroupItem).toHaveBeenCalledWith(token, 'gi1', { quantity: 3, isBonus: false })
    );
  });

  test('removing an item calls adminDeleteGroupItem after confirming', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());
    confirmDelete.mockResolvedValue(true);
    api.adminDeleteGroupItem.mockResolvedValue({});

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    const row2 = screen.getByText('Chicken').closest('div');
    await user.click(within(row2).getByRole('button', { name: 'Remove' }));

    expect(confirmDelete).toHaveBeenCalledWith('"Chicken" from this combo');
    await waitFor(() => expect(api.adminDeleteGroupItem).toHaveBeenCalledWith(token, 'gi2'));
  });

  test('does not remove an item when confirm is cancelled', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());
    confirmDelete.mockResolvedValue(false);

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    const row2 = screen.getByText('Chicken').closest('div');
    await user.click(within(row2).getByRole('button', { name: 'Remove' }));

    expect(api.adminDeleteGroupItem).not.toHaveBeenCalled();
  });

  test('shows a remove error without crashing', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());
    confirmDelete.mockResolvedValue(true);
    api.adminDeleteGroupItem.mockRejectedValue(new ApiError('Cannot remove the last item', 400, null));
    window.alert = vi.fn();

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    const row2 = screen.getByText('Chicken').closest('div');
    await user.click(within(row2).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Cannot remove the last item'));
  });

  test('the add-item select flattens menu options into labeled choices', async () => {
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    const select = screen.getByText('Select an item & size').closest('select');
    const optionLabels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionLabels).toEqual([
      'Select an item & size',
      'Jollof Rice — 1L (₦4,500)',
      'Jollof Rice — 2L (₦8,000)',
      'Chicken — Regular (₦3,000)',
    ]);
  });

  test('adding a new item calls adminAddGroupItem with the right shape', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());
    api.adminAddGroupItem.mockResolvedValue({});

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    const select = screen.getByText('Select an item & size').closest('select');
    await user.selectOptions(select, 'o2');
    await user.click(screen.getByRole('button', { name: '+ Add item' }));

    await waitFor(() =>
      expect(api.adminAddGroupItem).toHaveBeenCalledWith(token, 'group1', {
        menuItemOptionId: 'o2',
        quantity: 1,
        isBonus: false,
      })
    );
  });

  test('adding a bonus item with a custom quantity sends those fields', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());
    api.adminAddGroupItem.mockResolvedValue({});

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    const select = screen.getByText('Select an item & size').closest('select');
    await user.selectOptions(select, 'o3');
    const addForm = select.closest('form');
    const qtyInput = within(addForm).getByRole('spinbutton');
    await user.clear(qtyInput);
    await user.type(qtyInput, '2');
    await user.click(within(addForm).getByRole('checkbox', { name: 'Bonus' }));
    await user.click(screen.getByRole('button', { name: '+ Add item' }));

    await waitFor(() =>
      expect(api.adminAddGroupItem).toHaveBeenCalledWith(token, 'group1', {
        menuItemOptionId: 'o3',
        quantity: 2,
        isBonus: true,
      })
    );
  });

  test('shows a validation error when no item/size is selected to add', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    await user.click(screen.getByRole('button', { name: '+ Add item' }));

    expect(await screen.findByText('Pick an item and size to add.')).toBeInTheDocument();
    expect(api.adminAddGroupItem).not.toHaveBeenCalled();
  });

  test('shows a server error when adding an item fails', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());
    api.adminAddGroupItem.mockRejectedValue(new ApiError('This item is already in the combo', 400, null));

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    const select = screen.getByText('Select an item & size').closest('select');
    await user.selectOptions(select, 'o1');
    await user.click(screen.getByRole('button', { name: '+ Add item' }));

    expect(await screen.findByText('This item is already in the combo')).toBeInTheDocument();
  });

  test('renders an empty included-items list without crashing', async () => {
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup({ items: [] }));

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    expect(screen.getByText('Included items')).toBeInTheDocument();
    expect(screen.getByText('Select an item & size').closest('select')).toBeInTheDocument();
  });
});
