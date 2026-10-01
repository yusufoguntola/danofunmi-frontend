import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ChatWidget from '../../../src/components/chat/ChatWidget';
import { api } from '../../../src/lib/api';
import { db } from '../../../src/lib/db';
import { pushSupported, subscribeToPush, unsubscribeFromPush } from '../../../src/lib/push';
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
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await user.click(screen.getByRole('button', { name: 'Open chat' }));
  return user;
}

// Gets `meta.customerPhone` populated via the real send() path, for tests
// of enableOrderNotifs (which requires it).
async function setupWithCustomerPhone(user, phone = '08030000000') {
  api.sendChatMessage.mockResolvedValueOnce({
    messages: [{ role: 'user', content: 'track my order' }],
    meta: { customerPhone: phone },
  });
  await user.type(screen.getByPlaceholderText('Type a message…'), 'track my order');
  await user.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(api.sendChatMessage).toHaveBeenCalled());
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem(AUTO_OPEN_KEY, '1');
  api.getPaymentInfo.mockResolvedValue({});
  db.chat.get.mockResolvedValue(undefined);
  db.chat.put.mockResolvedValue(undefined);
  db.chat.delete.mockResolvedValue(undefined);
  db.cart.get.mockResolvedValue(undefined);
  db.cart.put.mockResolvedValue(undefined);
  db.cart.delete.mockResolvedValue(undefined);
  db.orderHistory.put.mockResolvedValue(undefined);
  pushSupported.mockReturnValue(true);
  useCustomerAuth.mockReturnValue({ session: null });
  onChatPromptRequest.mockReturnValue(vi.fn());
  // pushSupported() true makes the mount effect reach navigator.serviceWorker.ready
  // to check for an existing subscription — stub it so that doesn't throw.
  navigator.serviceWorker = {
    ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockResolvedValue(null) } }),
  };
  global.Notification = { permission: 'default' };
});

describe('ChatWidget — the notif bell is gated on pushSupported()', () => {
  test('is not rendered at all when push is unsupported', async () => {
    pushSupported.mockReturnValue(false);
    await renderOpenWidget();
    expect(screen.queryByTitle('Notify me about new menus')).not.toBeInTheDocument();
  });

  test('is rendered, off by default, when push is supported', async () => {
    await renderOpenWidget();
    expect(screen.getByTitle('Notify me about new menus')).toHaveTextContent('🔕');
  });
});

describe('ChatWidget — toggleMenuNotifs', () => {
  test('subscribing turns the bell on (no customerPhone yet, so orderNotifs stays off)', async () => {
    subscribeToPush.mockResolvedValue(true);
    const user = await renderOpenWidget();

    await user.click(screen.getByTitle('Notify me about new menus'));

    expect(subscribeToPush).toHaveBeenCalledWith(null);
    await waitFor(() => expect(screen.getByTitle('Turn off menu update notifications')).toHaveTextContent('🔔'));
  });

  test('subscribing with a known customerPhone also turns orderNotifs on', async () => {
    subscribeToPush.mockResolvedValue(true);
    const user = await renderOpenWidget();
    await setupWithCustomerPhone(user, '08030000000');

    await user.click(screen.getByTitle('Notify me about new menus'));

    expect(subscribeToPush).toHaveBeenCalledWith('08030000000');
    // orderNotifsOn now true, so the separate "notify me about this order" CTA disappears.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Notify me when this order's status changes/i })).not.toBeInTheDocument()
    );
  });

  test('unsubscribing (from an on state) turns both flags off again', async () => {
    subscribeToPush.mockResolvedValue(true);
    unsubscribeFromPush.mockResolvedValue(undefined);
    const user = await renderOpenWidget();

    await user.click(screen.getByTitle('Notify me about new menus'));
    await waitFor(() => expect(screen.getByTitle('Turn off menu update notifications')).toBeInTheDocument());

    await user.click(screen.getByTitle('Turn off menu update notifications'));

    expect(unsubscribeFromPush).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTitle('Notify me about new menus')).toHaveTextContent('🔕'));
  });

  test('a failed subscribe attempt leaves the bell off', async () => {
    subscribeToPush.mockResolvedValue(false);
    const user = await renderOpenWidget();

    await user.click(screen.getByTitle('Notify me about new menus'));

    await waitFor(() => expect(subscribeToPush).toHaveBeenCalled());
    expect(screen.getByTitle('Notify me about new menus')).toHaveTextContent('🔕');
  });

  test('the bell is disabled while the toggle request is in flight', async () => {
    let resolveSubscribe;
    subscribeToPush.mockReturnValue(
      new Promise((resolve) => {
        resolveSubscribe = resolve;
      })
    );
    const user = await renderOpenWidget();

    await user.click(screen.getByTitle('Notify me about new menus'));

    expect(screen.getByTitle('Notify me about new menus')).toBeDisabled();

    await act(async () => {
      resolveSubscribe(true);
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTitle('Turn off menu update notifications')).not.toBeDisabled());
  });
});

describe('ChatWidget — enableOrderNotifs', () => {
  test('the order-notif CTA only appears once meta.customerPhone is known', async () => {
    const user = await renderOpenWidget();
    expect(screen.queryByRole('button', { name: /Notify me when this order's status changes/i })).not.toBeInTheDocument();

    await setupWithCustomerPhone(user, '08030000000');

    expect(screen.getByRole('button', { name: /Notify me when this order's status changes/i })).toBeInTheDocument();
  });

  test('clicking it subscribes with the customer phone and turns both notif flags on', async () => {
    subscribeToPush.mockResolvedValue(true);
    const user = await renderOpenWidget();
    await setupWithCustomerPhone(user, '08030000000');

    await user.click(screen.getByRole('button', { name: /Notify me when this order's status changes/i }));

    expect(subscribeToPush).toHaveBeenCalledWith('08030000000');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Notify me when this order's status changes/i })).not.toBeInTheDocument()
    );
    expect(screen.getByTitle('Turn off menu update notifications')).toBeInTheDocument();
  });

  test('a failed subscribe leaves the CTA visible and both flags off', async () => {
    subscribeToPush.mockResolvedValue(false);
    const user = await renderOpenWidget();
    await setupWithCustomerPhone(user, '08030000000');

    await user.click(screen.getByRole('button', { name: /Notify me when this order's status changes/i }));

    await waitFor(() => expect(subscribeToPush).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /Notify me when this order's status changes/i })).toBeInTheDocument();
    expect(screen.getByTitle('Notify me about new menus')).toBeInTheDocument();
  });
});
