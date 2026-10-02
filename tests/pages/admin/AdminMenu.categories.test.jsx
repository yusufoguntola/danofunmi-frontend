import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminMenu from '../../../src/pages/admin/AdminMenu';
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

// "Soups" (and any other category name shared with an item's category label)
// appears both in the categories table and in the items table's category
// column — scope lookups to the categories table (the first <table>) to
// avoid ambiguous-match errors. Async because the table doesn't exist until
// the category fetch resolves.
async function categoriesTable() {
  return (await screen.findAllByRole('table'))[0];
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

const MENU_ITEMS = [
  {
    id: 'item1',
    name: 'Egusi Soup',
    category: 'Soups',
    categoryId: 'cat1',
    icon: '🍲',
    active: true,
    options: [{ id: 'opt1', size: '1L', price: 4000 }],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.adminListMenu.mockResolvedValue(MENU_ITEMS);
  api.adminListCategories.mockResolvedValue(CATEGORIES);
});

describe('AdminMenu categories', () => {
  test('renders the category list with item counts', async () => {
    seedSession();
    renderPage();

    await screen.findByText('Drinks');
    const table = await categoriesTable();
    const soupsRow = within(table).getByText('Soups').closest('tr');
    expect(soupsRow).toHaveTextContent('1'); // Soups has one item (Egusi Soup)
    const drinksRow = within(table).getByText('Drinks').closest('tr');
    expect(drinksRow).toHaveTextContent('0'); // Drinks has zero items
  });

  test('shows an empty state when there are no categories', async () => {
    seedSession();
    api.adminListCategories.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No categories yet — add one above.')).toBeInTheDocument();
  });

  test('creating a category calls adminCreateCategory and reloads', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminCreateCategory.mockResolvedValue({});
    renderPage();
    await screen.findByText('Drinks');

    await user.click(screen.getByRole('button', { name: '+ Add category' }));
    await user.type(screen.getByLabelText('Name'), 'Proteins');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    await waitFor(() =>
      expect(api.adminCreateCategory).toHaveBeenCalledWith(token, { name: 'Proteins' })
    );
    await waitFor(() => expect(api.adminListCategories).toHaveBeenCalledTimes(2));
  });

  test('shows a validation error when the new category name is blank', async () => {
    const user = userEvent.setup();
    seedSession();
    renderPage();
    await within(await categoriesTable()).findByText('Soups');

    await user.click(screen.getByRole('button', { name: '+ Add category' }));
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText('Give the category a name.')).toBeInTheDocument();
    expect(api.adminCreateCategory).not.toHaveBeenCalled();
  });

  test('shows a server error when category creation fails', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminCreateCategory.mockRejectedValue(new ApiError('Category already exists', 400, null));
    renderPage();
    await within(await categoriesTable()).findByText('Soups');

    await user.click(screen.getByRole('button', { name: '+ Add category' }));
    await user.type(screen.getByLabelText('Name'), 'Soups');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText('Category already exists')).toBeInTheDocument();
  });

  test('editing a category calls adminUpdateCategory with the trimmed name', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    api.adminUpdateCategory.mockResolvedValue({});
    renderPage();
    const table = await categoriesTable();
    await within(table).findByText('Soups');

    const row = within(table).getByText('Soups').closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));

    const input = screen.getByDisplayValue('Soups');
    await user.clear(input);
    await user.type(input, '  Hearty Soups  ');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(api.adminUpdateCategory).toHaveBeenCalledWith(token, 'cat1', { name: 'Hearty Soups' })
    );
  });

  test('shows a validation error when the edited category name is blank', async () => {
    const user = userEvent.setup();
    seedSession();
    renderPage();
    const table = await categoriesTable();
    await within(table).findByText('Soups');

    const row = within(table).getByText('Soups').closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));

    const input = screen.getByDisplayValue('Soups');
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Give the category a name.')).toBeInTheDocument();
    expect(api.adminUpdateCategory).not.toHaveBeenCalled();
  });

  test('shows a server error when category rename fails', async () => {
    const user = userEvent.setup();
    seedSession();
    api.adminUpdateCategory.mockRejectedValue(new ApiError('Name already in use', 400, null));
    renderPage();
    const table = await categoriesTable();
    await within(table).findByText('Soups');

    const row = within(table).getByText('Soups').closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Name already in use')).toBeInTheDocument();
  });

  test('deleting a category calls adminDeleteCategory after confirming', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    confirmDelete.mockResolvedValue(true);
    api.adminDeleteCategory.mockResolvedValue({});
    renderPage();
    await screen.findByText('Drinks');

    const row = screen.getByText('Drinks').closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Delete' }));

    expect(confirmDelete).toHaveBeenCalledWith('the "Drinks" category');
    await waitFor(() => expect(api.adminDeleteCategory).toHaveBeenCalledWith(token, 'cat2'));
  });

  test('does not delete a category when confirm is cancelled', async () => {
    const user = userEvent.setup();
    seedSession();
    confirmDelete.mockResolvedValue(false);
    renderPage();
    await screen.findByText('Drinks');

    const row = screen.getByText('Drinks').closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Delete' }));

    expect(api.adminDeleteCategory).not.toHaveBeenCalled();
  });

  test('shows a delete error without crashing', async () => {
    const user = userEvent.setup();
    seedSession();
    confirmDelete.mockResolvedValue(true);
    api.adminDeleteCategory.mockRejectedValue(new ApiError('Category still has items', 400, null));
    window.alert = vi.fn();
    renderPage();
    await screen.findByText('Drinks');

    const row = screen.getByText('Drinks').closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Category still has items'));
  });

  test('categories pagination is independent from the items table', async () => {
    seedSession();
    const manyCategories = Array.from({ length: 12 }, (_, i) => ({ id: `cat${i}`, name: `Category ${i}` }));
    api.adminListCategories.mockResolvedValue(manyCategories);
    renderPage();

    await screen.findByText('Category 0');
    // Default page size is 10 — page 2 content not shown yet.
    expect(screen.queryByText('Category 10')).not.toBeInTheDocument();
    // Menu items table (only 1 item) still renders its own row, unaffected.
    expect(screen.getByText('Egusi Soup')).toBeInTheDocument();
  });
});
