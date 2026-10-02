import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminMenuGroups from '../../../src/pages/admin/AdminMenuGroups';
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
    adminListGroups: vi.fn(),
    adminListMenu: vi.fn(),
    adminListCategories: vi.fn(),
    adminUpdateGroup: vi.fn(),
    adminDeleteGroup: vi.fn(),
    adminCreateGroup: vi.fn(),
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
}));

vi.mock('../../../src/components/IconPicker', () => ({
  default: () => <div>Icon Picker</div>,
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
        <AdminMenuGroups />
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

function baseGroups() {
  return [
    {
      id: 'g1',
      name: 'Family Combo',
      icon: '🎁',
      category: 'Combos',
      total: 15000,
      active: true,
      items: [{ isBonus: false }, { isBonus: false }],
      discount: { type: 'PERCENTAGE', value: 10 },
    },
    {
      id: 'g2',
      name: 'Date Night',
      icon: '🎁',
      category: 'Combos',
      total: 9000,
      active: false,
      items: [{ isBonus: false }],
      discount: null,
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.adminListCategories.mockResolvedValue(CATEGORIES);
  api.adminListMenu.mockResolvedValue(MENU_ITEMS);
});

describe('AdminMenuGroups', () => {
  test('renders the combo list', async () => {
    seedSession();
    api.adminListGroups.mockResolvedValue(baseGroups());

    renderPage();

    expect(await screen.findByText('Family Combo')).toBeInTheDocument();
    expect(screen.getByText('Date Night')).toBeInTheDocument();
    expect(screen.getByText('₦15,000')).toBeInTheDocument();
  });

  test('shows an empty state when there are no combos', async () => {
    seedSession();
    api.adminListGroups.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('No combos yet — add one above.')).toBeInTheDocument();
  });

  test('"+ Add combo" is disabled when there are no option choices yet', async () => {
    seedSession();
    api.adminListGroups.mockResolvedValue([]);
    api.adminListMenu.mockResolvedValue([]);

    renderPage();
    await screen.findByText('No combos yet — add one above.');

    expect(screen.getByRole('button', { name: '+ Add combo' })).toBeDisabled();
  });

  test('the create-combo modal flattens menu options into labeled choices', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminListGroups.mockResolvedValue([]);

    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Add combo' })).not.toBeDisabled());

    await user.click(screen.getByRole('button', { name: '+ Add combo' }));

    const select = screen.getByLabelText('Starting item');
    const optionLabels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionLabels).toEqual([
      'Select an item & size',
      'Jollof Rice — 1L (₦4,500)',
      'Jollof Rice — 2L (₦8,000)',
      'Chicken — Regular (₦3,000)',
    ]);
  });

  // "Promotions" is just an ordinary category now — visibility is per-item
  // (hiddenFromCatalog), not category-wide — so defaulting a new combo's
  // category to whatever the API returns first (even "Promotions") is fine.
  test('defaults the new-combo category to whatever the API returns first', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminListGroups.mockResolvedValue([]);
    api.adminListCategories.mockResolvedValue([
      { id: 'cat-promo', name: 'Promotions' },
      { id: 'cat-combos', name: 'Combos' },
    ]);

    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Add combo' })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: '+ Add combo' }));

    expect(screen.getByLabelText('Category')).toHaveValue('cat-promo');
  });

  test('creating a combo calls adminCreateGroup and navigates to its edit page', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminListGroups.mockResolvedValue([]);
    api.adminCreateGroup.mockResolvedValue({ id: 'g-new' });

    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Add combo' })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: '+ Add combo' }));

    await user.type(screen.getByLabelText('Name'), 'Birthday Bundle');
    await user.selectOptions(screen.getByLabelText('Starting item'), 'o1');
    await user.click(screen.getByRole('button', { name: 'Add combo' }));

    await waitFor(() =>
      expect(api.adminCreateGroup).toHaveBeenCalledWith(token, {
        name: 'Birthday Bundle',
        categoryId: 'cat1',
        description: '',
        icon: '',
        items: [{ menuItemOptionId: 'o1', quantity: 1 }],
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/restricted-path/menu/groups/g-new');
  });

  test('shows a validation error when required combo fields are missing', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminListGroups.mockResolvedValue([]);

    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Add combo' })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: '+ Add combo' }));

    // Name and starting item left blank.
    await user.click(screen.getByRole('button', { name: 'Add combo' }));

    expect(await screen.findByText('Name, category, and a starting item are required.')).toBeInTheDocument();
    expect(api.adminCreateGroup).not.toHaveBeenCalled();
  });

  test('shows a server error when combo creation fails', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminListGroups.mockResolvedValue([]);
    api.adminCreateGroup.mockRejectedValue(new ApiError('A combo with this name already exists', 400, null));

    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Add combo' })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: '+ Add combo' }));

    await user.type(screen.getByLabelText('Name'), 'Birthday Bundle');
    await user.selectOptions(screen.getByLabelText('Starting item'), 'o1');
    await user.click(screen.getByRole('button', { name: 'Add combo' }));

    expect(await screen.findByText('A combo with this name already exists')).toBeInTheDocument();
  });

  test('toggling a combo active/inactive calls adminUpdateGroup', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminListGroups.mockResolvedValue(baseGroups());
    api.adminUpdateGroup.mockResolvedValue({});

    renderPage();
    await screen.findByText('Family Combo');

    const row = screen.getByText('Family Combo').closest('tr');
    await user.click(within(row).getByRole('checkbox'));

    await waitFor(() => expect(api.adminUpdateGroup).toHaveBeenCalledWith(token, 'g1', { active: false }));
    // Reloads the list after the toggle.
    await waitFor(() => expect(api.adminListGroups).toHaveBeenCalledTimes(2));
  });

  test('deleting a combo calls adminDeleteGroup after confirming', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminListGroups.mockResolvedValue(baseGroups());
    confirmAction.mockResolvedValue(true);
    api.adminDeleteGroup.mockResolvedValue({});

    renderPage();
    await screen.findByText('Date Night');

    await user.click(screen.getByText('Date Night'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Delete "Date Night"?', danger: true })
    );
    await waitFor(() => expect(api.adminDeleteGroup).toHaveBeenCalledWith(token, 'g2'));
  });

  test('does not delete a combo when confirm is cancelled', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminListGroups.mockResolvedValue(baseGroups());
    confirmAction.mockResolvedValue(false);

    renderPage();
    await screen.findByText('Date Night');

    await user.click(screen.getByText('Date Night'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(api.adminDeleteGroup).not.toHaveBeenCalled();
  });

  test('expanding a row shows its item count and discount', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminListGroups.mockResolvedValue(baseGroups());

    renderPage();
    await screen.findByText('Family Combo');

    await user.click(screen.getByText('Family Combo'));

    expect(screen.getByText('2 item(s)')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
  });
});
