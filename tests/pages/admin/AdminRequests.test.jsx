import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminRequests from '../../../src/pages/admin/AdminRequests';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import { api } from '../../../src/lib/api';
import { confirmDelete } from '../../../src/lib/confirm';
import { fakeJwt } from '../../helpers/fakeJwt';

const STORAGE_KEY = 'danofunmi_admin_session';

const mockRefreshUnreadRequests = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useOutletContext: () => ({ refreshUnreadRequests: mockRefreshUnreadRequests }),
}));

vi.mock('../../../src/lib/api', () => ({
  api: {
    adminListRequests: vi.fn(),
    getLocations: vi.fn(),
    adminMarkAllRequestsRead: vi.fn(),
    adminMarkRequestRead: vi.fn(),
    adminDeleteRequest: vi.fn(),
  },
}));

vi.mock('../../../src/lib/confirm', () => ({
  confirmDelete: vi.fn(),
}));

vi.mock('../../../src/pages/admin/CreateOrderFromRequestModal', () => ({
  default: vi.fn(() => <div>Create Order Modal</div>),
}));

import CreateOrderFromRequestModal from '../../../src/pages/admin/CreateOrderFromRequestModal';

function seedSession() {
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { email: 'admin@test.com' } }));
  return token;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminAuthProvider>
        <AdminRequests />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

const LOCATIONS = [{ id: 'loc1', name: 'Lekki', logisticsFee: 1000 }];

function baseRequests() {
  return [
    {
      id: 'req1',
      createdAt: '2026-09-01T10:00:00Z',
      requestType: 'item_request',
      customerName: 'Jane Doe',
      customerPhone: '08011111111',
      message: 'Can I get 2 extra portions of jollof?',
      orderNarration: 'Order #100',
      orderId: null,
      readAt: null,
    },
    {
      id: 'req2',
      createdAt: '2026-09-02T10:00:00Z',
      requestType: 'discount_request',
      customerName: 'John Smith',
      customerPhone: '08022222222',
      message: 'Any discount for bulk?',
      orderNarration: null,
      orderId: null,
      readAt: '2026-09-02T11:00:00Z',
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.getLocations.mockResolvedValue(LOCATIONS);
  api.adminMarkAllRequestsRead.mockResolvedValue({});
});

describe('AdminRequests', () => {
  test('renders the request list with type label and customer info', async () => {
    seedSession();
    api.adminListRequests.mockResolvedValue(baseRequests());

    renderPage();

    expect(await screen.findByText('Item request')).toBeInTheDocument();
    expect(screen.getByText('Discount request')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe · 08011111111')).toBeInTheDocument();
    expect(screen.getByText('John Smith · 08022222222')).toBeInTheDocument();
  });

  test('shows a loading state while the fetch is in flight', () => {
    seedSession();
    api.adminListRequests.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('shows an empty state when there are no requests', async () => {
    seedSession();
    api.adminListRequests.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('No requests logged yet.')).toBeInTheDocument();
  });

  test('marks all requests read on mount and notifies the layout', async () => {
    const token = seedSession();
    api.adminListRequests.mockResolvedValue(baseRequests());

    renderPage();

    await waitFor(() => expect(api.adminMarkAllRequestsRead).toHaveBeenCalledWith(token));
    await waitFor(() => expect(mockRefreshUnreadRequests).toHaveBeenCalled());
  });

  test('toggles a request between read and unread', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    const requests = baseRequests();
    api.adminListRequests.mockResolvedValue(requests);
    // Visiting the page optimistically marks everything read locally (see the
    // mount effect below), so by the time we can interact with the row it
    // already reads as "read" — toggling from there flips it back to unread.
    api.adminMarkRequestRead.mockResolvedValue({ ...requests[0], readAt: null });

    renderPage();
    await screen.findByText('Item request');
    await waitFor(() => expect(mockRefreshUnreadRequests).toHaveBeenCalled());

    await user.click(screen.getByText('Item request'));
    const markUnreadBtn = await screen.findByRole('button', { name: 'Mark unread' });
    await user.click(markUnreadBtn);

    expect(api.adminMarkRequestRead).toHaveBeenCalledWith(token, 'req1', false);
    await screen.findByRole('button', { name: 'Mark read' });
  });

  test('deletes a request after confirming', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    const requests = baseRequests();
    api.adminListRequests.mockResolvedValue(requests);
    confirmDelete.mockResolvedValue(true);
    api.adminDeleteRequest.mockResolvedValue({});

    renderPage();
    await screen.findByText('Item request');

    await user.click(screen.getByText('Item request'));
    const deleteBtn = await screen.findByRole('button', { name: 'Delete' });
    await user.click(deleteBtn);

    expect(confirmDelete).toHaveBeenCalledWith('this request');
    await waitFor(() => expect(api.adminDeleteRequest).toHaveBeenCalledWith(token, 'req1'));
    await waitFor(() => expect(screen.queryByText('Jane Doe · 08011111111')).not.toBeInTheDocument());
  });

  test('does not delete when the confirm dialog is cancelled', async () => {
    const user = userEvent.setup();
    seedSession();
    const requests = baseRequests();
    api.adminListRequests.mockResolvedValue(requests);
    confirmDelete.mockResolvedValue(false);

    renderPage();
    await screen.findByText('Item request');

    await user.click(screen.getByText('Item request'));
    const deleteBtn = await screen.findByRole('button', { name: 'Delete' });
    await user.click(deleteBtn);

    expect(confirmDelete).toHaveBeenCalled();
    expect(api.adminDeleteRequest).not.toHaveBeenCalled();
    expect(screen.getByText('Jane Doe · 08011111111')).toBeInTheDocument();
  });

  test('opening "Create order" passes the right request and locations to the modal', async () => {
    const user = userEvent.setup();
    const token = seedSession();
    const requests = baseRequests();
    api.adminListRequests.mockResolvedValue(requests);

    renderPage();
    await screen.findByText('Item request');

    await user.click(screen.getByText('Item request'));
    const createOrderBtn = await screen.findByRole('button', { name: 'Create order' });
    await user.click(createOrderBtn);

    expect(await screen.findByText('Create Order Modal')).toBeInTheDocument();
    const lastCall = CreateOrderFromRequestModal.mock.calls.at(-1)[0];
    expect(lastCall.request.id).toBe('req1');
    expect(lastCall.token).toBe(token);
    expect(lastCall.locations).toEqual(LOCATIONS);
  });

  test('does not show "Create order" for a request that already has an order', async () => {
    const user = userEvent.setup();
    seedSession();
    const requests = baseRequests();
    requests[1].orderId = 'order-9';
    api.adminListRequests.mockResolvedValue(requests);

    renderPage();
    await screen.findByText('Discount request');

    await user.click(screen.getByText('Discount request'));
    expect(screen.queryByRole('button', { name: 'Create order' })).not.toBeInTheDocument();
  });
});
