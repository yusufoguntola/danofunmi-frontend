import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminMobileNav from '../../../src/pages/admin/AdminMobileNav';

function renderNav({ initialEntries = ['/restricted-path'], ...props } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="*" element={<AdminMobileNav {...props} />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminMobileNav', () => {
  test('renders the top-level group tabs', () => {
    renderNav();
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Setup')).toBeInTheDocument();
    expect(screen.getByText('Inbox')).toBeInTheDocument();
  });

  test('tapping a single-item group (Orders) navigates straight there without opening a sheet', async () => {
    const user = userEvent.setup();
    renderNav({ initialEntries: ['/restricted-path/menu'] });

    await user.click(screen.getByText('Orders'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // The Orders tab is now the active one for the current route.
    expect(screen.getByText('Orders').closest('button')).toHaveClass('is-active');
  });

  test('tapping a multi-item group (Setup) opens its sheet with its sub-links', async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByText('Setup'));

    const sheet = screen.getByRole('menu');
    expect(sheet).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Locations' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Costs' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Error logs' })).toBeInTheDocument();
  });

  test('tapping the same group again closes the sheet', async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByText('Setup'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByText('Setup'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  test('tapping outside the nav closes an open sheet', async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByText('Setup'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  test('navigating to a sub-item closes the sheet', async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByText('Setup'));
    await user.click(screen.getByRole('menuitem', { name: 'Reports' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  test('the group matching the current route is highlighted active', () => {
    renderNav({ initialEntries: ['/restricted-path/costs'] });
    expect(screen.getByText('Setup').closest('button')).toHaveClass('is-active');
    expect(screen.getByText('Orders').closest('button')).not.toHaveClass('is-active');
  });

  test('shows the combined unread dot on Inbox when there are unread requests or interest', () => {
    renderNav({ unreadRequests: 2, unreadInterest: 0 });
    expect(screen.getByLabelText('2 unread')).toBeInTheDocument();
  });

  test('shows no unread dot on Inbox when both counts are 0', () => {
    renderNav({ unreadRequests: 0, unreadInterest: 0 });
    expect(screen.queryByLabelText(/unread/)).not.toBeInTheDocument();
  });
});
