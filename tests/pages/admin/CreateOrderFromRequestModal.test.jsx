import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateOrderFromRequestModal from '../../../src/pages/admin/CreateOrderFromRequestModal';
import { api, ApiError } from '../../../src/lib/api';

vi.mock('../../../src/lib/api', () => ({
  api: {
    adminSuggestRequestItems: vi.fn(),
    adminCreateOrderFromRequest: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(message, status, body) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
}));

const LOCATIONS = [
  { id: 'loc1', name: 'Lekki', logisticsFee: 1000 },
  { id: 'loc2', name: 'Ikeja', logisticsFee: 1500 },
];

function baseRequest(overrides = {}) {
  return {
    id: 'req1',
    customerName: 'Jane Doe',
    customerPhone: '08011111111',
    message: 'Can I get 2 portions of jollof rice?',
    ...overrides,
  };
}

function renderModal(overrides = {}) {
  const request = overrides.request || baseRequest();
  const locations = overrides.locations || LOCATIONS;
  const onClose = overrides.onClose || vi.fn();
  const onCreated = overrides.onCreated || vi.fn();
  const token = overrides.token || 'tok1';
  const utils = render(
    <CreateOrderFromRequestModal request={request} token={token} locations={locations} onClose={onClose} onCreated={onCreated} />
  );
  return { ...utils, request, locations, onClose, onCreated, token };
}

function totalInput() {
  return screen.getByRole('spinbutton', { name: /Total/ });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateOrderFromRequestModal', () => {
  test('shows a "asking the assistant" indicator while suggestions are loading', () => {
    api.adminSuggestRequestItems.mockReturnValue(new Promise(() => {}));
    renderModal();
    expect(screen.getByText(/asking the assistant for a guess/)).toBeInTheDocument();
  });

  test('pre-fills items from the AI suggestion once it resolves', async () => {
    api.adminSuggestRequestItems.mockResolvedValue({
      items: [{ itemName: 'Jollof Rice', size: '1L', quantity: 2, unitPrice: 2500 }],
    });

    renderModal();

    expect(await screen.findByDisplayValue('Jollof Rice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1L')).toBeInTheDocument();
    expect(screen.queryByText(/asking the assistant for a guess/)).not.toBeInTheDocument();
  });

  test('shows a suggestion error but still allows manual item entry', async () => {
    api.adminSuggestRequestItems.mockRejectedValue(new ApiError('AI is unavailable', 503, null));

    renderModal();

    expect(await screen.findByText(/AI is unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/You can still add items manually/)).toBeInTheDocument();
    // Falls back to a single empty item row.
    expect(screen.getByPlaceholderText('Item name')).toHaveValue('');
  });

  test('total auto-syncs to subtotal + logistics fee as items/location change, before being touched', async () => {
    api.adminSuggestRequestItems.mockResolvedValue({
      items: [{ itemName: 'Jollof Rice', size: '1L', quantity: 2, unitPrice: 2500 }],
    });
    const user = userEvent.setup();

    renderModal();
    await screen.findByDisplayValue('Jollof Rice');

    // subtotal = 2 * 2500 = 5000, + Lekki's 1000 fee = 6000
    await waitFor(() => expect(totalInput()).toHaveValue(6000));

    // Editing a line item recomputes the auto total.
    const qtyInput = screen.getByPlaceholderText('Qty');
    await user.clear(qtyInput);
    await user.type(qtyInput, '3');

    // subtotal = 3 * 2500 = 7500, + 1000 = 8500
    await waitFor(() => expect(totalInput()).toHaveValue(8500));
  });

  test('once the admin types a custom total, further line-item edits do not overwrite it', async () => {
    api.adminSuggestRequestItems.mockResolvedValue({
      items: [{ itemName: 'Jollof Rice', size: '1L', quantity: 2, unitPrice: 2500 }],
    });
    const user = userEvent.setup();

    renderModal();
    await screen.findByDisplayValue('Jollof Rice');
    await waitFor(() => expect(totalInput()).toHaveValue(6000));

    // Admin types their own quoted total.
    await user.clear(totalInput());
    await user.type(totalInput(), '9999');
    await waitFor(() => expect(totalInput()).toHaveValue(9999));

    // Further item edits must NOT overwrite the manually-typed total.
    const qtyInput = screen.getByPlaceholderText('Qty');
    await user.clear(qtyInput);
    await user.type(qtyInput, '5');

    // subtotal would now be 5*2500+1000=13500 if still auto-syncing — assert it's NOT that.
    await waitFor(() => expect(screen.getByPlaceholderText('Qty')).toHaveValue(5));
    expect(totalInput()).toHaveValue(9999);
  });

  test('adding and removing an item row updates the computed subtotal', async () => {
    api.adminSuggestRequestItems.mockResolvedValue({ items: [] });
    const user = userEvent.setup();

    renderModal();
    await waitFor(() => expect(api.adminSuggestRequestItems).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: '+ Add item' }));
    expect(screen.getAllByPlaceholderText('Item name')).toHaveLength(2);

    const removeButtons = screen.getAllByRole('button', { name: 'Remove item' });
    await user.click(removeButtons[1]);
    expect(screen.getAllByPlaceholderText('Item name')).toHaveLength(1);
  });

  test('validates required customer/delivery fields before submitting', async () => {
    api.adminSuggestRequestItems.mockResolvedValue({
      items: [{ itemName: 'Jollof Rice', size: '1L', quantity: 2, unitPrice: 2500 }],
    });
    const user = userEvent.setup();

    renderModal();
    await screen.findByDisplayValue('Jollof Rice');

    // A whitespace-only address satisfies the <textarea required> HTML
    // constraint (so the native validation lets the submit through) but
    // fails the component's own .trim() check — exercising the custom
    // validation message rather than the browser's built-in one.
    await user.type(screen.getByLabelText('Delivery address'), ' ');
    await user.click(screen.getByRole('button', { name: 'Create order' }));

    expect(
      await screen.findByText('Customer name, phone, delivery address, and location are all required.')
    ).toBeInTheDocument();
    expect(api.adminCreateOrderFromRequest).not.toHaveBeenCalled();
  });

  test('requires at least one item', async () => {
    api.adminSuggestRequestItems.mockResolvedValue({ items: [] });
    const user = userEvent.setup();

    renderModal();
    await waitFor(() => expect(api.adminSuggestRequestItems).toHaveBeenCalled());

    await user.type(screen.getByLabelText('Delivery address'), '12 Marina Street');
    await user.click(screen.getByRole('button', { name: 'Create order' }));

    expect(await screen.findByText('Add at least one item.')).toBeInTheDocument();
    expect(api.adminCreateOrderFromRequest).not.toHaveBeenCalled();
  });

  test('submits with the right shape and calls onCreated with the new order', async () => {
    api.adminSuggestRequestItems.mockResolvedValue({
      items: [{ itemName: 'Jollof Rice', size: '1L', quantity: 2, unitPrice: 2500 }],
    });
    const order = { id: 'order1', narration: 'Jollof Rice x2' };
    api.adminCreateOrderFromRequest.mockResolvedValue(order);
    const user = userEvent.setup();

    const { onCreated, token, request } = renderModal();
    await screen.findByDisplayValue('Jollof Rice');
    await waitFor(() => expect(totalInput()).toHaveValue(6000));

    await user.type(screen.getByLabelText('Delivery address'), '12 Marina Street');
    await user.click(screen.getByRole('button', { name: 'Create order' }));

    await waitFor(() => expect(api.adminCreateOrderFromRequest).toHaveBeenCalled());
    expect(api.adminCreateOrderFromRequest).toHaveBeenCalledWith(token, request.id, {
      customerName: 'Jane Doe',
      customerPhone: '08011111111',
      deliveryAddress: '12 Marina Street',
      landmark: undefined,
      locationId: 'loc1',
      items: [{ itemName: 'Jollof Rice', size: '1L', quantity: 2, unitPrice: 2500 }],
      total: 6000,
      notes: undefined,
    });
    expect(onCreated).toHaveBeenCalledWith(order);
  });

  test('shows an error message when submission fails', async () => {
    api.adminSuggestRequestItems.mockResolvedValue({
      items: [{ itemName: 'Jollof Rice', size: '1L', quantity: 2, unitPrice: 2500 }],
    });
    api.adminCreateOrderFromRequest.mockRejectedValue(new ApiError('Could not reach the server', 500, null));
    const user = userEvent.setup();

    const { onCreated } = renderModal();
    await screen.findByDisplayValue('Jollof Rice');

    await user.type(screen.getByLabelText('Delivery address'), '12 Marina Street');
    await user.click(screen.getByRole('button', { name: 'Create order' }));

    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  test('clicking the close button calls onClose', async () => {
    api.adminSuggestRequestItems.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await waitFor(() => expect(api.adminSuggestRequestItems).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });
});
