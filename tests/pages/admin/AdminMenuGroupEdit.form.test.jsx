import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminMenuGroupEdit from '../../../src/pages/admin/AdminMenuGroupEdit';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api, ApiError } from '../../../src/lib/api';
import { confirmAction } from '../../../src/lib/confirm';
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

const CATEGORIES = [
  { id: 'cat1', name: 'Combos' },
  { id: 'cat2', name: 'Specials' },
];

const MENU_ITEMS = [
  {
    id: 'i1',
    name: 'Jollof Rice',
    options: [{ id: 'o1', size: '1L', price: 4500 }],
  },
];

function baseGroup(overrides = {}) {
  return {
    id: 'group1',
    name: 'Family Combo',
    categoryId: 'cat1',
    description: 'Feeds the whole family',
    icon: '🎁',
    active: true,
    discount: { type: 'PERCENTAGE', value: 10, amount: 1500 },
    grossTotal: 15000,
    total: 13500,
    items: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.adminListCategories.mockResolvedValue(CATEGORIES);
  api.adminListMenu.mockResolvedValue(MENU_ITEMS);
});

describe('AdminMenuGroupEdit form', () => {
  test('loads and pre-fills the form from the existing group', async () => {
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());

    renderPage();

    expect(await screen.findByDisplayValue('Family Combo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Feeds the whole family')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('cat1');
    expect(screen.getByRole('checkbox', { name: /Active \(visible to customers\)/ })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Discount' })).toHaveValue('PERCENTAGE');
    expect(screen.getByLabelText('Percent (%)')).toHaveValue(10);
  });

  test('pre-fills discountValue as empty when the group has no discount', async () => {
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup({ discount: null }));

    renderPage();

    await screen.findByDisplayValue('Family Combo');
    expect(screen.getByRole('combobox', { name: 'Discount' })).toHaveValue('');
    // No discount type selected -> the discount-value field isn't rendered at all.
    expect(screen.queryByLabelText('Percent (%)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
  });

  test('shows a load error instead of the form when the fetch fails', async () => {
    seedSession();
    api.adminGetGroup.mockRejectedValue(new ApiError('Combo not found', 404, null));

    renderPage();

    expect(await screen.findByText('Combo not found')).toBeInTheDocument();
  });

  test('shows gross total, discount amount, and net total from the loaded group', async () => {
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    expect(screen.getByText('₦15,000')).toBeInTheDocument();
    expect(screen.getByText('−₦1,500')).toBeInTheDocument();
    expect(screen.getByText('₦13,500')).toBeInTheDocument();
  });

  test('hides the discount line in the totals summary when there is no discount', async () => {
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup({ discount: null, total: 15000 }));

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    // The form's own "Discount" <select> label is always present — only the
    // totals-summary discount line is conditional on group.discount.
    expect(screen.getByRole('combobox', { name: 'Discount' })).toHaveValue('');
    expect(screen.queryByText('−₦', { exact: false })).not.toBeInTheDocument();
  });

  test('editing a field and saving calls adminUpdateGroup with the new form', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());
    api.adminUpdateGroup.mockResolvedValue({});

    renderPage();
    const nameInput = await screen.findByDisplayValue('Family Combo');

    await user.clear(nameInput);
    await user.type(nameInput, 'Mega Combo');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(api.adminUpdateGroup).toHaveBeenCalledWith(token, 'group1', {
        name: 'Mega Combo',
        categoryId: 'cat1',
        description: 'Feeds the whole family',
        icon: '🎁',
        active: true,
        discountType: 'PERCENTAGE',
        discountValue: 10,
      })
    );
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  test('clearing the discount type sends null discountType/discountValue', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());
    api.adminUpdateGroup.mockResolvedValue({});

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Discount' }), 'No discount');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(api.adminUpdateGroup).toHaveBeenCalledWith(token, 'group1', {
        name: 'Family Combo',
        categoryId: 'cat1',
        description: 'Feeds the whole family',
        icon: '🎁',
        active: true,
        discountType: null,
        discountValue: null,
      })
    );
  });

  test('blocks save with a validation error when a discount type is set but the value is blank', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    const valueInput = screen.getByLabelText('Percent (%)');
    await user.clear(valueInput);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Enter a discount value, or clear the discount type.')
    ).toBeInTheDocument();
    expect(api.adminUpdateGroup).not.toHaveBeenCalled();
  });

  test('switching discount type to FLAT relabels the value field to Amount', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Discount' }), 'Flat fee off');

    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.queryByLabelText('Percent (%)')).not.toBeInTheDocument();
  });

  test('shows a save error without crashing', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());
    api.adminUpdateGroup.mockRejectedValue(new ApiError('Name already in use', 400, null));

    renderPage();
    await screen.findByDisplayValue('Family Combo');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Name already in use')).toBeInTheDocument();
  });

  test('deleting the whole combo navigates away after confirming', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());
    confirmAction.mockResolvedValue(true);
    api.adminDeleteGroup.mockResolvedValue({});

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    await user.click(screen.getByRole('button', { name: 'Delete combo' }));

    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Delete "Family Combo"?', danger: true })
    );
    await waitFor(() => expect(api.adminDeleteGroup).toHaveBeenCalledWith(token, 'group1'));
    expect(mockNavigate).toHaveBeenCalledWith('/restricted-path/menu/groups');
  });

  test('does not delete the whole combo when confirm is cancelled', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());
    confirmAction.mockResolvedValue(false);

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    await user.click(screen.getByRole('button', { name: 'Delete combo' }));

    expect(api.adminDeleteGroup).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('shows a delete error without navigating when deletion fails', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminGetGroup.mockResolvedValue(baseGroup());
    confirmAction.mockResolvedValue(true);
    api.adminDeleteGroup.mockRejectedValue(new ApiError('Combo still has active orders', 400, null));
    window.alert = vi.fn();

    renderPage();
    await screen.findByDisplayValue('Family Combo');

    await user.click(screen.getByRole('button', { name: 'Delete combo' }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Combo still has active orders'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
