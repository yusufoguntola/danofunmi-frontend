import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ChatWidget from '../../../src/components/chat/ChatWidget';
import { api } from '../../../src/lib/api';
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

function renderWidget() {
  return render(
    <MemoryRouter>
      <ChatWidget />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
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

afterEach(() => {
  vi.useRealTimers();
});

describe('ChatWidget — launcher open/close', () => {
  test('starts closed, with the launcher labeled "Open chat"', async () => {
    localStorage.setItem(AUTO_OPEN_KEY, '1'); // prevent the auto-open timer from firing
    renderWidget();
    await waitFor(() => expect(db.chat.get).toHaveBeenCalledWith('default'));

    expect(screen.getByRole('button', { name: 'Open chat' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Type a message…')).not.toBeInTheDocument();
  });

  test('clicking the launcher opens the panel and relabels the launcher "Close chat"', async () => {
    localStorage.setItem(AUTO_OPEN_KEY, '1');
    const user = userEvent.setup();
    renderWidget();
    await waitFor(() => expect(db.chat.get).toHaveBeenCalledWith('default'));

    await user.click(screen.getByRole('button', { name: 'Open chat' }));

    expect(screen.getByRole('button', { name: 'Close chat' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a message…')).toBeInTheDocument();
  });

  test('clicking the header close (×) button closes the panel', async () => {
    localStorage.setItem(AUTO_OPEN_KEY, '1');
    const user = userEvent.setup();
    renderWidget();
    await waitFor(() => expect(db.chat.get).toHaveBeenCalledWith('default'));

    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await user.click(screen.getByTitle('Close'));

    expect(screen.getByRole('button', { name: 'Open chat' })).toBeInTheDocument();
  });
});

describe('ChatWidget — hydration from db.chat', () => {
  test('hydrates messages and meta from the stored row on mount', async () => {
    localStorage.setItem(AUTO_OPEN_KEY, '1');
    db.chat.get.mockResolvedValue({
      messages: [{ role: 'user', content: 'What is on the menu?' }],
      meta: { orderId: 'order-1' },
    });
    const user = userEvent.setup();
    renderWidget();
    await waitFor(() => expect(db.chat.get).toHaveBeenCalledWith('default'));

    await user.click(screen.getByRole('button', { name: 'Open chat' }));

    expect(await screen.findByText('What is on the menu?')).toBeInTheDocument();
    // The welcome/greeting bubbles only show when there's no prior history.
    expect(screen.queryByText(/Welcome to dánọ́fúnmi/)).not.toBeInTheDocument();
  });

  test('shows the welcome greeting when there is no stored row', async () => {
    localStorage.setItem(AUTO_OPEN_KEY, '1');
    db.chat.get.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWidget();
    await waitFor(() => expect(db.chat.get).toHaveBeenCalledWith('default'));

    await user.click(screen.getByRole('button', { name: 'Open chat' }));

    expect(await screen.findByText(/Welcome to dánọ́fúnmi/)).toBeInTheDocument();
  });
});

describe('ChatWidget — write-back effect gating', () => {
  test('does not call db.chat.put before hydration resolves', async () => {
    localStorage.setItem(AUTO_OPEN_KEY, '1');
    let resolveGet;
    db.chat.get.mockReturnValue(
      new Promise((resolve) => {
        resolveGet = resolve;
      })
    );

    renderWidget();
    await waitFor(() => expect(db.chat.get).toHaveBeenCalled());

    // Still pending — the write-back effect must not have fired yet.
    expect(db.chat.put).not.toHaveBeenCalled();

    await act(async () => {
      resolveGet(undefined);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(db.chat.put).toHaveBeenCalledWith({ id: 'default', messages: [], meta: null }));
  });
});

describe('ChatWidget — auto-open-once effect', () => {
  test('opens itself after 900ms when there is no existing conversation and no prior auto-open flag', async () => {
    vi.useFakeTimers();
    db.chat.get.mockResolvedValue(undefined);
    localStorage.removeItem(AUTO_OPEN_KEY);

    renderWidget();

    // Flush the hydration microtasks without advancing the fake timer.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Open chat' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(localStorage.getItem(AUTO_OPEN_KEY)).toBe('1');
    expect(screen.getByRole('button', { name: 'Close chat' })).toBeInTheDocument();
  });

  test('does not auto-open when a conversation already has messages', async () => {
    vi.useFakeTimers();
    db.chat.get.mockResolvedValue({ messages: [{ role: 'user', content: 'hi' }], meta: null });
    localStorage.removeItem(AUTO_OPEN_KEY);

    renderWidget();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(screen.getByRole('button', { name: 'Open chat' })).toBeInTheDocument();
    expect(localStorage.getItem(AUTO_OPEN_KEY)).toBeNull();
  });

  test('does not auto-open when the flag was already set', async () => {
    vi.useFakeTimers();
    db.chat.get.mockResolvedValue(undefined);
    localStorage.setItem(AUTO_OPEN_KEY, '1');

    renderWidget();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(screen.getByRole('button', { name: 'Open chat' })).toBeInTheDocument();
  });
});

describe('ChatWidget — push subscription check on mount', () => {
  test('reflects an existing granted push subscription in the notif bell on mount', async () => {
    localStorage.setItem(AUTO_OPEN_KEY, '1');
    pushSupported.mockReturnValue(true);
    navigator.serviceWorker = {
      ready: Promise.resolve({
        pushManager: { getSubscription: vi.fn().mockResolvedValue({ endpoint: 'https://example.com/sub' }) },
      }),
    };
    global.Notification = { permission: 'granted' };

    const user = userEvent.setup();
    renderWidget();
    await waitFor(() => expect(db.chat.get).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Open chat' }));

    await waitFor(() => expect(screen.getByTitle('Turn off menu update notifications')).toBeInTheDocument());
  });
});

describe('ChatWidget — startNewConversation', () => {
  test('clears messages/meta and deletes the stored row', async () => {
    localStorage.setItem(AUTO_OPEN_KEY, '1');
    db.chat.get.mockResolvedValue({ messages: [{ role: 'user', content: 'hello there' }], meta: { orderId: 'o1' } });
    const user = userEvent.setup();
    renderWidget();
    await waitFor(() => expect(db.chat.get).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(await screen.findByText('hello there')).toBeInTheDocument();

    await user.click(screen.getByTitle('Start a new conversation'));

    expect(screen.queryByText('hello there')).not.toBeInTheDocument();
    expect(await screen.findByText(/Welcome to dánọ́fúnmi/)).toBeInTheDocument();
    expect(db.chat.delete).toHaveBeenCalledWith('default');
  });
});

describe('ChatWidget — chatBridge subscription', () => {
  test('opens the widget and sends the prompt when onChatPromptRequest fires', async () => {
    localStorage.setItem(AUTO_OPEN_KEY, '1');
    let bridgeCallback;
    onChatPromptRequest.mockImplementation((cb) => {
      bridgeCallback = cb;
      return vi.fn();
    });
    api.sendChatMessage.mockResolvedValue({
      messages: [
        { role: 'user', content: 'I need a bulk order' },
        { role: 'assistant', content: 'Sure, how many portions?' },
      ],
    });

    renderWidget();
    await waitFor(() => expect(db.chat.get).toHaveBeenCalled());
    expect(bridgeCallback).toBeInstanceOf(Function);

    await act(async () => {
      bridgeCallback('I need a bulk order');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Close chat' })).toBeInTheDocument();
    expect(api.sendChatMessage).toHaveBeenCalledWith(
      [{ role: 'user', content: 'I need a bulk order' }],
      undefined
    );
    expect(await screen.findByText('Sure, how many portions?')).toBeInTheDocument();
  });
});
