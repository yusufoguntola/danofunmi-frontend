import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OrderStatusPage from '../../src/pages/OrderStatusPage';
import { api, ApiError, bustOrderCache } from '../../src/lib/api';
import { pushSupported } from '../../src/lib/push';
import { useCustomerAuth } from '../../src/context/CustomerAuthContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../src/lib/api', () => ({
  api: {
    getOrder: vi.fn(),
    getPaymentInfo: vi.fn(),
    cancelOrder: vi.fn(),
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

vi.mock('../../src/lib/push', () => ({
  pushSupported: vi.fn(),
  subscribeToPush: vi.fn(),
}));

vi.mock('../../src/lib/confirm', () => ({
  confirmAction: vi.fn(),
}));

vi.mock('../../src/context/CustomerAuthContext', () => ({
  useCustomerAuth: vi.fn(),
}));

const baseOrder = {
  id: 'order-1',
  orderNumber: 'ON-1001',
  narration: 'Jollof Combo',
  status: 'PENDING_PAYMENT',
  orderMonth: null,
  siblingOrders: [],
  items: [{ id: 'it1', itemName: 'Jollof Rice', size: '1L', quantity: 2, lineTotal: 9000 }],
  subtotal: 9000,
  logisticsFee: 1000,
  total: 10000,
  location: { name: 'Akobo' },
  customer: { name: 'Ada', phone: '+2348012345678' },
  deliveryAddress: '123 Street',
  landmark: null,
  notes: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  receipts: [],
};

function renderPage(path = '/order/order-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/order/:id" element={<OrderStatusPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getPaymentInfo.mockResolvedValue({
    bankName: 'GTBank',
    accountName: 'Dano Funmi',
    accountNumber: '0123456789',
    maxReceiptFileSizeKB: 2000,
  });
  pushSupported.mockReturnValue(false);
  useCustomerAuth.mockReturnValue({ session: { token: 'cust-tok' } });
});

describe('OrderStatusPage — pay & confirm visibility', () => {
  test('is shown for PENDING_PAYMENT', async () => {
    api.getOrder.mockResolvedValue({ ...baseOrder, status: 'PENDING_PAYMENT' });
    renderPage();
    expect(await screen.findByText('Pay & confirm')).toBeInTheDocument();
  });

  test('is shown for PAYMENT_SUBMITTED', async () => {
    api.getOrder.mockResolvedValue({ ...baseOrder, status: 'PAYMENT_SUBMITTED' });
    renderPage();
    expect(await screen.findByText('Pay & confirm')).toBeInTheDocument();
  });

  test('is hidden for a later status like CONFIRMED', async () => {
    api.getOrder.mockResolvedValue({ ...baseOrder, status: 'CONFIRMED' });
    renderPage();
    await screen.findByText('Order #ON-1001');
    expect(screen.queryByText('Pay & confirm')).not.toBeInTheDocument();
  });

  test('shows bank details pulled from getPaymentInfo', async () => {
    api.getOrder.mockResolvedValue(baseOrder);
    renderPage();
    await screen.findByText('Pay & confirm');
    expect(screen.getByText('GTBank')).toBeInTheDocument();
    expect(screen.getByText('Dano Funmi')).toBeInTheDocument();
    expect(screen.getByText('0123456789')).toBeInTheDocument();
  });

  test('once PAYMENT_SUBMITTED with a PENDING receipt, the confirm form is replaced by a status message', async () => {
    api.getOrder.mockResolvedValue({
      ...baseOrder,
      status: 'PAYMENT_SUBMITTED',
      receipts: [{ status: 'PENDING' }],
    });
    renderPage();

    await screen.findByText('Pay & confirm');
    expect(screen.getByText(/we’re confirming your payment/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload receipt' })).not.toBeInTheDocument();
  });

  test('a REJECTED receipt shows the rejection message AND re-shows the form to retry', async () => {
    api.getOrder.mockResolvedValue({
      ...baseOrder,
      status: 'PAYMENT_SUBMITTED',
      receipts: [{ status: 'REJECTED' }],
    });
    renderPage();

    await screen.findByText('Pay & confirm');
    expect(screen.getByText(/couldn’t be verified/)).toBeInTheDocument();
    // "Upload receipt" appears twice: the mode chip and the form's submit button.
    expect(screen.getAllByText('Upload receipt')).toHaveLength(2);
  });
});

describe('OrderStatusPage — receipt upload', () => {
  test('oversized file shows the size-limit error immediately on selection', async () => {
    const user = userEvent.setup();
    api.getOrder.mockResolvedValue(baseOrder);
    renderPage();
    await screen.findByText('Pay & confirm');

    const fileInput = screen.getByLabelText(/Payment receipt/);
    const oversized = new File([new Uint8Array(3 * 1024 * 1024)], 'receipt.png', { type: 'image/png' });
    await user.upload(fileInput, oversized);

    expect(
      await screen.findByText('That photo is too large (max 2000KB). Please try a smaller photo or a screenshot instead.')
    ).toBeInTheDocument();
  });

  test('submitting with no file chosen shows a "choose a file" error and does not call the API', async () => {
    const user = userEvent.setup();
    api.getOrder.mockResolvedValue(baseOrder);
    renderPage();
    await screen.findByText('Pay & confirm');

    const submitForm = screen.getByText(/Payment receipt/).closest('form');
    await user.click(within(submitForm).getByRole('button', { name: 'Upload receipt' }));

    expect(await screen.findByText('Choose a screenshot or photo of your payment receipt.')).toBeInTheDocument();
    expect(api.uploadReceipt).not.toHaveBeenCalled();
  });

  test('successful upload calls uploadReceipt, busts the cache, and redirects to the confirmation page', async () => {
    const user = userEvent.setup();
    api.getOrder.mockResolvedValue(baseOrder);
    api.uploadReceipt.mockResolvedValue({});
    renderPage();
    await screen.findByText('Pay & confirm');

    const fileInput = screen.getByLabelText(/Payment receipt/);
    const goodFile = new File(['tiny'], 'receipt.png', { type: 'image/png' });
    await user.upload(fileInput, goodFile);
    await user.click(within(fileInput.closest('form')).getByRole('button', { name: 'Upload receipt' }));

    await waitFor(() => expect(api.uploadReceipt).toHaveBeenCalledWith('order-1', goodFile));
    expect(bustOrderCache).toHaveBeenCalledWith('order-1');
    expect(mockNavigate).toHaveBeenCalledWith('/order/order-1/confirmation', {
      state: { orderNumber: 'ON-1001', narration: 'Jollof Combo' },
    });
  });

  test('shows the ApiError message on upload failure, without navigating', async () => {
    const user = userEvent.setup();
    api.getOrder.mockResolvedValue(baseOrder);
    api.uploadReceipt.mockRejectedValue(new ApiError('Receipt upload rejected', 400, null));
    renderPage();
    await screen.findByText('Pay & confirm');

    const fileInput = screen.getByLabelText(/Payment receipt/);
    await user.upload(fileInput, new File(['tiny'], 'receipt.png', { type: 'image/png' }));
    await user.click(within(fileInput.closest('form')).getByRole('button', { name: 'Upload receipt' }));

    expect(await screen.findByText('Receipt upload rejected')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('shows a generic fallback message on a non-ApiError upload failure', async () => {
    const user = userEvent.setup();
    api.getOrder.mockResolvedValue(baseOrder);
    api.uploadReceipt.mockRejectedValue(new Error('boom'));
    renderPage();
    await screen.findByText('Pay & confirm');

    const fileInput = screen.getByLabelText(/Payment receipt/);
    await user.upload(fileInput, new File(['tiny'], 'receipt.png', { type: 'image/png' }));
    await user.click(within(fileInput.closest('form')).getByRole('button', { name: 'Upload receipt' }));

    expect(await screen.findByText('Could not upload receipt. Please try again.')).toBeInTheDocument();
  });
});

describe('OrderStatusPage — payment details form', () => {
  async function switchToDetailsMode(user) {
    await user.click(screen.getByRole('button', { name: 'Or provide payment details' }));
  }

  test('submitting with blank fields shows a validation error and does not call the API', async () => {
    const user = userEvent.setup();
    api.getOrder.mockResolvedValue(baseOrder);
    renderPage();
    await screen.findByText('Pay & confirm');
    await switchToDetailsMode(user);

    await user.click(screen.getByRole('button', { name: 'Submit payment details' }));

    expect(
      await screen.findByText('Enter the sender name and bank the transfer was made from.')
    ).toBeInTheDocument();
    expect(api.submitPaymentDetails).not.toHaveBeenCalled();
  });

  test('successful submit calls submitPaymentDetails, busts the cache, and redirects to confirmation', async () => {
    const user = userEvent.setup();
    api.getOrder.mockResolvedValue(baseOrder);
    api.submitPaymentDetails.mockResolvedValue({});
    renderPage();
    await screen.findByText('Pay & confirm');
    await switchToDetailsMode(user);

    await user.type(screen.getByLabelText('Sender name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Sender bank'), 'GTBank');
    await user.click(screen.getByRole('button', { name: 'Submit payment details' }));

    await waitFor(() =>
      expect(api.submitPaymentDetails).toHaveBeenCalledWith('order-1', {
        senderName: 'Ada Lovelace',
        senderBank: 'GTBank',
      })
    );
    expect(bustOrderCache).toHaveBeenCalledWith('order-1');
    expect(mockNavigate).toHaveBeenCalledWith('/order/order-1/confirmation', {
      state: { orderNumber: 'ON-1001', narration: 'Jollof Combo' },
    });
  });

  test('shows the ApiError message on submit failure', async () => {
    const user = userEvent.setup();
    api.getOrder.mockResolvedValue(baseOrder);
    api.submitPaymentDetails.mockRejectedValue(new ApiError('Could not verify those details', 422, null));
    renderPage();
    await screen.findByText('Pay & confirm');
    await switchToDetailsMode(user);

    await user.type(screen.getByLabelText('Sender name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Sender bank'), 'GTBank');
    await user.click(screen.getByRole('button', { name: 'Submit payment details' }));

    expect(await screen.findByText('Could not verify those details')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('shows a generic fallback message on a non-ApiError submit failure', async () => {
    const user = userEvent.setup();
    api.getOrder.mockResolvedValue(baseOrder);
    api.submitPaymentDetails.mockRejectedValue(new Error('boom'));
    renderPage();
    await screen.findByText('Pay & confirm');
    await switchToDetailsMode(user);

    await user.type(screen.getByLabelText('Sender name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Sender bank'), 'GTBank');
    await user.click(screen.getByRole('button', { name: 'Submit payment details' }));

    expect(
      await screen.findByText('Could not submit payment details. Please try again.')
    ).toBeInTheDocument();
  });
});
