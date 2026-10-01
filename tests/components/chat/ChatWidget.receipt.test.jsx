import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ChatWidget from '../../../src/components/chat/ChatWidget';
import { api, ApiError, bustOrderCache } from '../../../src/lib/api';
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
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await user.click(screen.getByRole('button', { name: 'Open chat' }));
  return user;
}

// Drives the widget into a state where `meta` carries an orderId + an
// uploadable status, via the real send() path (api.sendChatMessage once),
// then returns the meta used so tests can reference it.
async function setupWithUploadableMeta(user, metaOverrides = {}) {
  const meta = {
    orderId: 'order-1',
    orderNumber: 'ON-001',
    narration: 'Jollof combo',
    status: 'PENDING_PAYMENT',
    total: 5000,
    ...metaOverrides,
  };
  api.sendChatMessage.mockResolvedValueOnce({
    messages: [
      { role: 'user', content: 'I placed an order' },
      { role: 'assistant', content: 'Please complete payment' },
    ],
    meta,
  });

  await user.type(screen.getByPlaceholderText('Type a message…'), 'I placed an order');
  await user.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText('Please complete payment');

  return meta;
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
  pushSupported.mockReturnValue(false);
  useCustomerAuth.mockReturnValue({ session: null });
  onChatPromptRequest.mockReturnValue(vi.fn());
});

describe('ChatWidget — receipt UI visibility', () => {
  test('is hidden when there is no meta at all', async () => {
    const user = await renderOpenWidget();
    expect(screen.queryByText(/Confirm payment for order/)).not.toBeInTheDocument();
    void user;
  });

  test('is shown once meta carries an orderId with an uploadable status (PENDING_PAYMENT)', async () => {
    const user = await renderOpenWidget();
    const meta = await setupWithUploadableMeta(user);

    expect(
      screen.getByText(`Confirm payment for order #${meta.orderNumber} (${meta.narration})`, { exact: false })
    ).toBeInTheDocument();
    // "Upload receipt" appears twice: the mode chip and the form's submit button.
    expect(screen.getAllByText('Upload receipt').length).toBe(2);
    expect(screen.getByRole('button', { name: 'Provide payment details' })).toBeInTheDocument();
  });

  test('is shown for the other uploadable status (PAYMENT_SUBMITTED)', async () => {
    const user = await renderOpenWidget();
    await setupWithUploadableMeta(user, { status: 'PAYMENT_SUBMITTED' });

    expect(screen.getByText(/Confirm payment for order/)).toBeInTheDocument();
  });

  test('is hidden when the order status is not in the uploadable list', async () => {
    const user = await renderOpenWidget();
    await setupWithUploadableMeta(user, { status: 'DELIVERED' });

    expect(screen.queryByText(/Confirm payment for order/)).not.toBeInTheDocument();
  });

  test('shows the max file size pulled from api.getPaymentInfo', async () => {
    api.getPaymentInfo.mockResolvedValue({ maxReceiptFileSizeKB: 500 });
    const user = await renderOpenWidget();
    await setupWithUploadableMeta(user);

    expect(await screen.findByText('Max 500KB')).toBeInTheDocument();
  });
});

describe('ChatWidget — receipt upload', () => {
  test('rejects an oversized file with the exact receiptFileError message, leaving the submit button disabled', async () => {
    const user = await renderOpenWidget();
    await setupWithUploadableMeta(user); // default max is 15360KB

    const fileInput = screen.getByLabelText(/Max \d+KB/);
    const oversized = new File([new Uint8Array(16 * 1024 * 1024)], 'receipt.png', { type: 'image/png' });
    await user.upload(fileInput, oversized);

    expect(
      await screen.findByText('That photo is too large (max 15360KB). Please try a smaller photo or a screenshot instead.')
    ).toBeInTheDocument();
    const form = fileInput.closest('form');
    expect(within(form).getByRole('button', { name: 'Upload receipt' })).toBeDisabled();
  });

  test('successfully uploads: calls uploadReceipt, busts the order cache, hides the form, and sends an auto-message', async () => {
    const user = await renderOpenWidget();
    await setupWithUploadableMeta(user);
    api.uploadReceipt.mockResolvedValue({});
    // The post-upload auto-message resolves with no meta, so receiptSubmitted stays true.
    api.sendChatMessage.mockResolvedValueOnce({
      messages: [{ role: 'user', content: '[Uploaded my payment receipt]' }, { role: 'assistant', content: 'Thanks, confirming now.' }],
    });

    const fileInput = screen.getByLabelText(/Max \d+KB/);
    const goodFile = new File(['tiny'], 'receipt.png', { type: 'image/png' });
    await user.upload(fileInput, goodFile);
    const form = fileInput.closest('form');
    await user.click(within(form).getByRole('button', { name: 'Upload receipt' }));

    await waitFor(() => expect(api.uploadReceipt).toHaveBeenCalledWith('order-1', goodFile));
    expect(bustOrderCache).toHaveBeenCalledWith('order-1');
    await waitFor(() =>
      expect(api.sendChatMessage).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ role: 'user', content: '[Uploaded my payment receipt]' })]),
        undefined
      )
    );
    await waitFor(() => expect(screen.queryByText(/Confirm payment for order/)).not.toBeInTheDocument());
  });

  test('shows the ApiError message on upload failure and never busts the cache', async () => {
    const user = await renderOpenWidget();
    await setupWithUploadableMeta(user);
    api.uploadReceipt.mockRejectedValue(new ApiError('Receipt upload rejected', 400, null));

    const fileInput = screen.getByLabelText(/Max \d+KB/);
    await user.upload(fileInput, new File(['tiny'], 'receipt.png', { type: 'image/png' }));
    const form = fileInput.closest('form');
    await user.click(within(form).getByRole('button', { name: 'Upload receipt' }));

    expect(await screen.findByText('Receipt upload rejected')).toBeInTheDocument();
    expect(bustOrderCache).not.toHaveBeenCalled();
    // The form stays visible — receiptSubmitted was never set.
    expect(screen.getByText(/Confirm payment for order/)).toBeInTheDocument();
  });

  test('shows a generic fallback message on a non-ApiError upload failure', async () => {
    const user = await renderOpenWidget();
    await setupWithUploadableMeta(user);
    api.uploadReceipt.mockRejectedValue(new Error('boom'));

    const fileInput = screen.getByLabelText(/Max \d+KB/);
    await user.upload(fileInput, new File(['tiny'], 'receipt.png', { type: 'image/png' }));
    const form = fileInput.closest('form');
    await user.click(within(form).getByRole('button', { name: 'Upload receipt' }));

    expect(await screen.findByText('Could not upload receipt. Please try again.')).toBeInTheDocument();
  });
});

describe('ChatWidget — payment details form', () => {
  async function switchToDetailsMode(user) {
    await user.click(screen.getByRole('button', { name: 'Provide payment details' }));
  }

  test('submit is disabled until both sender name and bank are filled', async () => {
    const user = await renderOpenWidget();
    await setupWithUploadableMeta(user);
    await switchToDetailsMode(user);

    expect(screen.getByRole('button', { name: 'Submit details' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Sender name'), 'Ada Lovelace');
    expect(screen.getByRole('button', { name: 'Submit details' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Sender bank'), 'GTBank');
    expect(screen.getByRole('button', { name: 'Submit details' })).toBeEnabled();
  });

  test('successfully submits: calls submitPaymentDetails, busts the cache, hides the form, sends an auto-message', async () => {
    const user = await renderOpenWidget();
    await setupWithUploadableMeta(user);
    await switchToDetailsMode(user);
    api.submitPaymentDetails.mockResolvedValue({});
    api.sendChatMessage.mockResolvedValueOnce({
      messages: [
        { role: 'user', content: '[Submitted my payment details]' },
        { role: 'assistant', content: 'Got it, confirming now.' },
      ],
    });

    await user.type(screen.getByPlaceholderText('Sender name'), 'Ada Lovelace');
    await user.type(screen.getByPlaceholderText('Sender bank'), 'GTBank');
    await user.click(screen.getByRole('button', { name: 'Submit details' }));

    await waitFor(() =>
      expect(api.submitPaymentDetails).toHaveBeenCalledWith('order-1', {
        senderName: 'Ada Lovelace',
        senderBank: 'GTBank',
      })
    );
    expect(bustOrderCache).toHaveBeenCalledWith('order-1');
    await waitFor(() =>
      expect(api.sendChatMessage).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ role: 'user', content: '[Submitted my payment details]' })]),
        undefined
      )
    );
    await waitFor(() => expect(screen.queryByText(/Confirm payment for order/)).not.toBeInTheDocument());
  });

  test('shows the ApiError message on submit failure', async () => {
    const user = await renderOpenWidget();
    await setupWithUploadableMeta(user);
    await switchToDetailsMode(user);
    api.submitPaymentDetails.mockRejectedValue(new ApiError('Could not verify those details', 422, null));

    await user.type(screen.getByPlaceholderText('Sender name'), 'Ada Lovelace');
    await user.type(screen.getByPlaceholderText('Sender bank'), 'GTBank');
    await user.click(screen.getByRole('button', { name: 'Submit details' }));

    expect(await screen.findByText('Could not verify those details')).toBeInTheDocument();
  });

  test('shows a generic fallback message on a non-ApiError submit failure', async () => {
    const user = await renderOpenWidget();
    await setupWithUploadableMeta(user);
    await switchToDetailsMode(user);
    api.submitPaymentDetails.mockRejectedValue(new Error('boom'));

    await user.type(screen.getByPlaceholderText('Sender name'), 'Ada Lovelace');
    await user.type(screen.getByPlaceholderText('Sender bank'), 'GTBank');
    await user.click(screen.getByRole('button', { name: 'Submit details' }));

    expect(await screen.findByText('Could not submit payment details. Please try again.')).toBeInTheDocument();
  });
});
