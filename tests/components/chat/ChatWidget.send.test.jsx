import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ChatWidget from '../../../src/components/chat/ChatWidget';
import { api, ApiError } from '../../../src/lib/api';
import { db } from '../../../src/lib/db';
import { pushSupported } from '../../../src/lib/push';
import { useCustomerAuth } from '../../../src/context/CustomerAuthContext';
import { onChatPromptRequest } from '../../../src/lib/chatBridge';

vi.mock('../../../src/lib/api', () => ({
  api: {
    getPaymentInfo: vi.fn(),
    sendChatMessage: vi.fn(),
    uploadReceipt: vi.fn(),
    submitPaymentDetails: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(message, status, body) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
  bustOrderCache: vi.fn(),
}));

vi.mock('../../../src/lib/db', () => ({
  db: {
    chat: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    cart: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    orderHistory: { put: vi.fn() },
  },
}));

vi.mock('../../../src/lib/push', () => ({
  pushSupported: vi.fn(),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}));

vi.mock('../../../src/context/CustomerAuthContext', () => ({
  useCustomerAuth: vi.fn(),
}));

vi.mock('../../../src/lib/chatBridge', () => ({
  onChatPromptRequest: vi.fn(),
}));

const AUTO_OPEN_KEY = 'dfm-chat-auto-opened';

async function renderOpenWidget() {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <ChatWidget />
    </MemoryRouter>
  );
  // Flush the async hydration effect before interacting.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await user.click(screen.getByRole('button', { name: 'Open chat' }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem(AUTO_OPEN_KEY, '1'); // keep the auto-open timer from interfering
  api.getPaymentInfo.mockResolvedValue({});
  db.chat.get.mockResolvedValue(undefined);
  db.chat.put.mockResolvedValue(undefined);
  db.chat.delete.mockResolvedValue(undefined);
  db.cart.get.mockResolvedValue(undefined);
  db.cart.put.mockResolvedValue(undefined);
  db.cart.delete.mockResolvedValue(undefined);
  db.orderHistory.put.mockResolvedValue(undefined);
  pushSupported.mockReturnValue(false);
  useCustomerAuth.mockReturnValue({ session: null });
  onChatPromptRequest.mockReturnValue(vi.fn());
});

describe('ChatWidget — send flow', () => {
  test('appends the user message, calls api.sendChatMessage, and renders the reply', async () => {
    api.sendChatMessage.mockResolvedValue({
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello! How can I help?' },
      ],
    });
    const user = await renderOpenWidget();

    await user.type(screen.getByPlaceholderText('Type a message…'), 'Hi');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(api.sendChatMessage).toHaveBeenCalledWith([{ role: 'user', content: 'Hi' }], undefined);
    expect(await screen.findByText('Hello! How can I help?')).toBeInTheDocument();
  });

  test('passes the signed-in customer token through to api.sendChatMessage', async () => {
    useCustomerAuth.mockReturnValue({ session: { token: 'tok-123' } });
    api.sendChatMessage.mockResolvedValue({ messages: [{ role: 'user', content: 'Hi' }] });
    const user = await renderOpenWidget();

    await user.type(screen.getByPlaceholderText('Type a message…'), 'Hi');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(api.sendChatMessage).toHaveBeenCalledWith([{ role: 'user', content: 'Hi' }], 'tok-123')
    );
  });

  test('the Send button is disabled while the input is blank and enabled once text is typed', async () => {
    const user = await renderOpenWidget();

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Type a message…'), 'Hi');

    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  test('the Send button is disabled while a send is in flight, then re-enabled', async () => {
    let resolveSend;
    api.sendChatMessage.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      })
    );
    const user = await renderOpenWidget();

    await user.type(screen.getByPlaceholderText('Type a message…'), 'Hi');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByPlaceholderText('Type a message…')).toBeDisabled();

    await act(async () => {
      resolveSend({ messages: [{ role: 'user', content: 'Hi' }] });
      await Promise.resolve();
    });

    // `sending` flips back to false once the request settles — the input
    // re-enables (the Send button itself stays disabled too, since the
    // composer was cleared on submit and is now blank again).
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message…')).not.toBeDisabled());
  });

  test('writes an orderHistory row when the response meta includes an orderId', async () => {
    api.sendChatMessage.mockResolvedValue({
      messages: [{ role: 'user', content: 'order please' }],
      meta: { orderId: 'order-9', narration: 'Jollof combo', orderNumber: 'ON-009' },
    });
    const user = await renderOpenWidget();

    await user.type(screen.getByPlaceholderText('Type a message…'), 'order please');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(db.orderHistory.put).toHaveBeenCalledWith({
        orderId: 'order-9',
        narration: 'Jollof combo',
        orderNumber: 'ON-009',
        createdAt: expect.any(String),
      })
    );
  });

  test('does not write an orderHistory row when meta has no orderId', async () => {
    api.sendChatMessage.mockResolvedValue({
      messages: [{ role: 'user', content: 'hi' }],
      meta: { customerPhone: '08030000000' },
    });
    const user = await renderOpenWidget();

    await user.type(screen.getByPlaceholderText('Type a message…'), 'hi');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(api.sendChatMessage).toHaveBeenCalled());
    expect(db.orderHistory.put).not.toHaveBeenCalled();
  });

  describe('syncCartFromChat (via meta.cart)', () => {
    test('deletes the draft cart when the cart is empty and there is no existing customer info', async () => {
      db.cart.get.mockResolvedValue(undefined);
      api.sendChatMessage.mockResolvedValue({
        messages: [{ role: 'user', content: 'hi' }],
        meta: { cart: { items: [] } },
      });
      const user = await renderOpenWidget();

      await user.type(screen.getByPlaceholderText('Type a message…'), 'hi');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => expect(db.cart.delete).toHaveBeenCalledWith('draft'));
      expect(db.cart.put).not.toHaveBeenCalled();
    });

    test('keeps (puts) the draft cart when empty but there is existing saved customer info', async () => {
      db.cart.get.mockResolvedValue({ id: 'draft', items: [], customerName: 'Ada' });
      api.sendChatMessage.mockResolvedValue({
        messages: [{ role: 'user', content: 'hi' }],
        meta: { cart: { items: [] } },
      });
      const user = await renderOpenWidget();

      await user.type(screen.getByPlaceholderText('Type a message…'), 'hi');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => expect(db.cart.put).toHaveBeenCalled());
      expect(db.cart.delete).not.toHaveBeenCalled();
      expect(db.cart.put).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'draft', customerName: 'Ada', items: [] })
      );
    });

    test('puts the mapped items when the cart from chat is non-empty', async () => {
      db.cart.get.mockResolvedValue(undefined);
      api.sendChatMessage.mockResolvedValue({
        messages: [{ role: 'user', content: 'hi' }],
        meta: {
          cart: {
            items: [
              {
                menuItemOptionId: 'opt-1',
                menuGroupId: undefined,
                itemName: 'Jollof Rice',
                icon: '🍚',
                size: '1L',
                unitPrice: 2500,
                quantity: 2,
              },
            ],
          },
        },
      });
      const user = await renderOpenWidget();

      await user.type(screen.getByPlaceholderText('Type a message…'), 'hi');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() =>
        expect(db.cart.put).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'draft',
            items: [
              {
                optionId: 'opt-1',
                groupId: undefined,
                itemName: 'Jollof Rice',
                icon: '🍚',
                size: '1L',
                unitPrice: 2500,
                quantity: 2,
              },
            ],
            updatedAt: expect.any(String),
          })
        )
      );
    });
  });

  describe('error branches', () => {
    test('shows the ApiError message verbatim when the request fails with an ApiError', async () => {
      api.sendChatMessage.mockRejectedValue(new ApiError('The assistant is temporarily unavailable', 503, null));
      const user = await renderOpenWidget();

      await user.type(screen.getByPlaceholderText('Type a message…'), 'Hi');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      expect(await screen.findByText('The assistant is temporarily unavailable')).toBeInTheDocument();
      // The optimistic user bubble stays even though the request failed.
      expect(screen.getByText('Hi')).toBeInTheDocument();
    });

    test('shows a generic fallback message for a non-ApiError failure', async () => {
      api.sendChatMessage.mockRejectedValue(new Error('network boom'));
      const user = await renderOpenWidget();

      await user.type(screen.getByPlaceholderText('Type a message…'), 'Hi');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      expect(
        await screen.findByText('Could not reach the assistant. Please try again.')
      ).toBeInTheDocument();
    });
  });
});
