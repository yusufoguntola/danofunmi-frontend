import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminMenu from '../../../src/pages/admin/AdminMenu';
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
    adminListMenu: vi.fn(),
    adminListCategories: vi.fn(),
    adminCreateCategory: vi.fn(),
    adminUpdateCategory: vi.fn(),
    adminDeleteCategory: vi.fn(),
    adminUpdateMenuItem: vi.fn(),
    adminDeleteMenuItem: vi.fn(),
    adminCreateMenuItem: vi.fn(),
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

// The expanded item's "Edit"/"Delete" action buttons share labels with the
// categories table's own per-row Edit/Delete buttons — scope to the
// ExpandableRow's detail panel (class `detail-row`, see ExpandableRow.jsx)
// to disambiguate.
function detailPanel() {
  return document.querySelector('.detail-row');
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminAuthProvider>
        <AdminMenu />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

const CATEGORIES = [
  { id: 'cat1', name: 'Soups' },
  { id: 'cat2', name: 'Drinks' },
];

function baseItems() {
  return [
    {
      id: 'item1',
      name: 'Egusi Soup',
      category: 'Soups',
      categoryId: 'cat1',
      icon: '🍲',
      active: true,
      options: [
        { id: 'opt1', size: '1L', price: 4000 },
        { id: 'opt2', size: '2L', price: 7000 },
      ],
    },
    {
      id: 'item2',
      name: 'Zobo',
      category: 'Drinks',
      categoryId: 'cat2',
      icon: '🥤',
      active: false,
      options: [{ id: 'opt3', size: '50cl', price: 1000 }],
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.adminListCategories.mockResolvedValue(CATEGORIES);
  api.adminListMenu.mockResolvedValue(baseItems());
});

describe('AdminMenu items', () => {
  test('renders the menu items list with price range and category', async () => {
    seedSession();
    renderPage();

    expect(await screen.findByText('Egusi Soup')).toBeInTheDocument();
    expect(screen.getByText('Zobo')).toBeInTheDocument();
    // Egusi has two differently-priced options -> a range.
    expect(screen.getByText('₦4,000 – ₦7,000')).toBeInTheDocument();
    // Zobo has a single option -> a single price, no range dash.
    expect(screen.getByText('₦1,000')).toBeInTheDocument();
  });

  test('shows an empty state when there are no menu items', async () => {
    seedSession();
    api.adminListMenu.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No menu items yet — add one above.')).toBeInTheDocument();
  });

  test('toggling an item calls adminUpdateMenuItem with the flipped active flag', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminUpdateMenuItem.mockResolvedValue({});
    renderPage();
    await screen.findByText('Egusi Soup');

    const row = screen.getByText('Egusi Soup').closest('tr');
    await user.click(within(row).getByRole('checkbox'));

    await waitFor(() =>
      expect(api.adminUpdateMenuItem).toHaveBeenCalledWith(token, 'item1', { active: false })
    );
  });

  test('toggling the inactive item flips it back to active', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminUpdateMenuItem.mockResolvedValue({});
    renderPage();
    await screen.findByText('Zobo');

    const row = screen.getByText('Zobo').closest('tr');
    await user.click(within(row).getByRole('checkbox'));

    await waitFor(() =>
      expect(api.adminUpdateMenuItem).toHaveBeenCalledWith(token, 'item2', { active: true })
    );
  });

  test('expanding a row shows its size count and edit/delete actions', async () => {
    const user = userEvent.setup();
    seedSession();
    renderPage();
    await screen.findByText('Egusi Soup');

    await user.click(screen.getByText('Egusi Soup'));

    const sizesField = screen.getByText('Sizes').closest('.detail-field');
    expect(within(sizesField).getByText('2')).toBeInTheDocument();
    expect(within(detailPanel()).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(detailPanel()).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  test('clicking Edit on an expanded item navigates to its edit page', async () => {
    const user = userEvent.setup();
    seedSession();
    renderPage();
    await screen.findByText('Egusi Soup');

    await user.click(screen.getByText('Egusi Soup'));
    await user.click(within(detailPanel()).getByRole('button', { name: 'Edit' }));

    expect(mockNavigate).toHaveBeenCalledWith('/restricted-path/menu/item1');
  });

  test('deleting an item calls adminDeleteMenuItem after confirming', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    confirmAction.mockResolvedValue(true);
    api.adminDeleteMenuItem.mockResolvedValue({});
    renderPage();
    await screen.findByText('Egusi Soup');

    await user.click(screen.getByText('Egusi Soup'));
    await user.click(within(detailPanel()).getByRole('button', { name: 'Delete' }));

    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Delete "Egusi Soup"?', danger: true })
    );
    await waitFor(() => expect(api.adminDeleteMenuItem).toHaveBeenCalledWith(token, 'item1'));
  });

  test('does not delete an item when confirm is cancelled', async () => {
    const user = userEvent.setup();
    seedSession();
    confirmAction.mockResolvedValue(false);
    renderPage();
    await screen.findByText('Egusi Soup');

    await user.click(screen.getByText('Egusi Soup'));
    await user.click(within(detailPanel()).getByRole('button', { name: 'Delete' }));

    expect(api.adminDeleteMenuItem).not.toHaveBeenCalled();
  });

  test('shows a delete error without crashing', async () => {
    const user = userEvent.setup();
    seedSession();
    confirmAction.mockResolvedValue(true);
    api.adminDeleteMenuItem.mockRejectedValue(new ApiError('Item is used in a combo', 400, null));
    window.alert = vi.fn();
    renderPage();
    await screen.findByText('Egusi Soup');

    await user.click(screen.getByText('Egusi Soup'));
    await user.click(within(detailPanel()).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Item is used in a combo'));
  });

  test('"+ Add menu item" is disabled when there are no categories yet', async () => {
    seedSession();
    api.adminListCategories.mockResolvedValue([]);
    renderPage();
    // baseItems() (the default mocked item list) still has items here — only
    // categories are empty — so wait for those to render rather than an
    // empty-items state that won't appear.
    await screen.findByText('Egusi Soup');

    expect(screen.getByRole('button', { name: '+ Add menu item' })).toBeDisabled();
  });

  test('creating a menu item sends name/category/description/icon + one starting option, and navigates to its edit page', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminCreateMenuItem.mockResolvedValue({ id: 'item-new' });
    renderPage();
    await screen.findByText('Egusi Soup');

    await user.click(screen.getByRole('button', { name: '+ Add menu item' }));
    await user.type(screen.getByLabelText('Name'), 'Ofada Stew');
    await user.selectOptions(screen.getByLabelText('Category'), 'cat1');
    await user.type(screen.getByLabelText('Description'), 'Spicy and rich');
    await user.type(screen.getByLabelText('Starting size'), '1L');
    await user.type(screen.getByLabelText(/Price/), '5000');
    await user.click(screen.getByRole('button', { name: 'Add menu item' }));

    await waitFor(() =>
      expect(api.adminCreateMenuItem).toHaveBeenCalledWith(token, {
        name: 'Ofada Stew',
        categoryId: 'cat1',
        description: 'Spicy and rich',
        icon: '',
        options: [{ size: '1L', price: 5000 }],
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/restricted-path/menu/item-new');
  });

  test('shows a validation error when required new-item fields are missing', async () => {
    const user = userEvent.setup();
    seedSession();
    renderPage();
    await screen.findByText('Egusi Soup');

    await user.click(screen.getByRole('button', { name: '+ Add menu item' }));
    // Name/size/price left blank.
    await user.click(screen.getByRole('button', { name: 'Add menu item' }));

    expect(
      await screen.findByText('Name, category, and an initial size + price are required.')
    ).toBeInTheDocument();
    expect(api.adminCreateMenuItem).not.toHaveBeenCalled();
  });

  test('shows a server error when menu item creation fails', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminCreateMenuItem.mockRejectedValue(new ApiError('An item with this name already exists', 400, null));
    renderPage();
    await screen.findByText('Egusi Soup');

    await user.click(screen.getByRole('button', { name: '+ Add menu item' }));
    await user.type(screen.getByLabelText('Name'), 'Egusi Soup');
    await user.type(screen.getByLabelText('Starting size'), '1L');
    await user.type(screen.getByLabelText(/Price/), '4000');
    await user.click(screen.getByRole('button', { name: 'Add menu item' }));

    expect(await screen.findByText('An item with this name already exists')).toBeInTheDocument();
  });

  test('items pagination is independent from the categories table', async () => {
    seedSession();
    const manyItems = Array.from({ length: 12 }, (_, i) => ({
      id: `item${i}`,
      name: `Item ${i}`,
      category: 'Soups',
      categoryId: 'cat1',
      icon: '🍲',
      active: true,
      options: [{ id: `opt${i}`, size: '1L', price: 1000 }],
    }));
    api.adminListMenu.mockResolvedValue(manyItems);
    renderPage();

    await screen.findByText('Item 0');
    // Default page size is 10 — page 2 content not shown yet.
    expect(screen.queryByText('Item 10')).not.toBeInTheDocument();
    // Categories table (only 2 categories) still renders fully, unaffected —
    // "Drinks" has no items in this test, so it's unambiguous.
    expect(screen.getByText('Drinks')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });
});
