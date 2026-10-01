import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InterestModal from '../../src/components/InterestModal';
import { api, ApiError } from '../../src/lib/api';
import { getRecaptchaToken } from '../../src/lib/recaptcha';

vi.mock('../../src/lib/api', () => {
  class ApiError extends Error {
    constructor(message, status, body) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  return { api: { registerInterest: vi.fn() }, ApiError };
});

vi.mock('../../src/lib/recaptcha', () => ({ getRecaptchaToken: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  getRecaptchaToken.mockResolvedValue('recaptcha-token-123');
});

async function fillCommonFields(user, { name = 'Ada Eze', email = 'ada@test.com', phone = '08012345678', address = '12 Akobo Road' } = {}) {
  await user.type(screen.getByLabelText('Name'), name);
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Phone'), phone);
  await user.type(screen.getByLabelText('Address'), address);
}

describe('InterestModal — variant copy', () => {
  test('variant="general" (default) shows the waitlist copy, no landmark field, and the "excites" field', () => {
    render(<InterestModal onClose={() => {}} />);

    expect(screen.getByRole('heading', { name: "I'm interested" })).toBeInTheDocument();
    expect(screen.getByText(/the moment monthly ordering goes live/)).toBeInTheDocument();
    expect(screen.getByLabelText('What excites you the most?')).toBeInTheDocument();
    expect(screen.queryByLabelText('Popular landmark near you')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Count me in' })).toBeInTheDocument();
  });

  test('variant="slot" shows the first-taste copy, a landmark field, and no "excites" field', () => {
    render(<InterestModal onClose={() => {}} variant="slot" />);

    expect(screen.getByRole('heading', { name: 'Lock in your slot' })).toBeInTheDocument();
    expect(screen.getByText(/lock in a first-taste slot/)).toBeInTheDocument();
    expect(screen.getByLabelText('Popular landmark near you')).toBeInTheDocument();
    expect(screen.queryByLabelText('What excites you the most?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock in my slot' })).toBeInTheDocument();
  });
});

describe('InterestModal — submission', () => {
  test('fetches a recaptcha token and includes it, along with claimSlot:false and no landmark, for the general variant', async () => {
    api.registerInterest.mockResolvedValue({ claimedSlot: false, alreadyShortlisted: false });
    const user = userEvent.setup();
    render(<InterestModal onClose={() => {}} />);

    await fillCommonFields(user);
    await user.click(screen.getByRole('button', { name: 'Count me in' }));

    expect(getRecaptchaToken).toHaveBeenCalledWith('interest');
    expect(await screen.findByRole('heading', { name: "You're on the list" })).toBeInTheDocument();
    expect(api.registerInterest).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ada Eze',
        email: 'ada@test.com',
        phone: '08012345678',
        address: '12 Akobo Road',
        claimSlot: false,
        recaptchaToken: 'recaptcha-token-123',
      })
    );
    expect(api.registerInterest.mock.calls[0][0]).not.toHaveProperty('landmark');
  });

  test('a successful slot claim shows the "You\'re in!" result and sends claimSlot:true plus the landmark', async () => {
    api.registerInterest.mockResolvedValue({ claimedSlot: true, alreadyShortlisted: false });
    const user = userEvent.setup();
    render(<InterestModal onClose={() => {}} variant="slot" />);

    await fillCommonFields(user);
    await user.type(screen.getByLabelText('Popular landmark near you'), 'Opposite Ecobank');
    await user.click(screen.getByRole('button', { name: 'Lock in my slot' }));

    expect(await screen.findByRole('heading', { name: "You're in!" })).toBeInTheDocument();
    expect(screen.getByText(/your first-taste slot is locked in/)).toBeInTheDocument();
    expect(api.registerInterest).toHaveBeenCalledWith(
      expect.objectContaining({ claimSlot: true, landmark: 'Opposite Ecobank' })
    );
  });

  test('an already-shortlisted response shows the "already on the list" result', async () => {
    api.registerInterest.mockResolvedValue({ claimedSlot: false, alreadyShortlisted: true });
    const user = userEvent.setup();
    render(<InterestModal onClose={() => {}} variant="slot" />);

    await fillCommonFields(user);
    await user.type(screen.getByLabelText('Popular landmark near you'), 'Opposite Ecobank');
    await user.click(screen.getByRole('button', { name: 'Lock in my slot' }));

    expect(await screen.findByRole('heading', { name: "You're already on the list" })).toBeInTheDocument();
    expect(screen.getByText(/already on our first-taste list/)).toBeInTheDocument();
  });

  test('still submits successfully when getRecaptchaToken rejects (token becomes null)', async () => {
    getRecaptchaToken.mockRejectedValue(new Error('recaptcha unavailable'));
    api.registerInterest.mockResolvedValue({ claimedSlot: false, alreadyShortlisted: false });
    const user = userEvent.setup();
    render(<InterestModal onClose={() => {}} />);

    await fillCommonFields(user);
    await user.click(screen.getByRole('button', { name: 'Count me in' }));

    expect(await screen.findByRole('heading', { name: "You're on the list" })).toBeInTheDocument();
    expect(api.registerInterest).toHaveBeenCalledWith(expect.objectContaining({ recaptchaToken: null }));
  });

  test('a failed submission (ApiError) shows its message', async () => {
    api.registerInterest.mockRejectedValue(new ApiError('Email already registered', 409));
    const user = userEvent.setup();
    render(<InterestModal onClose={() => {}} />);

    await fillCommonFields(user);
    await user.click(screen.getByRole('button', { name: 'Count me in' }));

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
  });

  test('a failed submission (generic error) shows the fallback message', async () => {
    api.registerInterest.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<InterestModal onClose={() => {}} />);

    await fillCommonFields(user);
    await user.click(screen.getByRole('button', { name: 'Count me in' }));

    expect(await screen.findByText('Something went wrong — please try again.')).toBeInTheDocument();
  });

  test('clicking "Done" on the result screen calls onClose', async () => {
    api.registerInterest.mockResolvedValue({ claimedSlot: false, alreadyShortlisted: false });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<InterestModal onClose={onClose} />);

    await fillCommonFields(user);
    await user.click(screen.getByRole('button', { name: 'Count me in' }));
    await user.click(await screen.findByRole('button', { name: 'Done' }));

    expect(onClose).toHaveBeenCalled();
  });
});
