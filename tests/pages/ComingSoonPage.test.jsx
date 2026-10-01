import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComingSoonPage from '../../src/pages/ComingSoonPage';
import { api } from '../../src/lib/api';

// ComingSoonPage renders the real InterestModal as a child (not re-testing
// its internals, already covered by InterestModal.test.jsx) — registerInterest
// is mocked here only so the module doesn't error if a test happens to submit.
vi.mock('../../src/lib/api', () => ({
  api: { getInterestStatus: vi.fn(), registerInterest: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ComingSoonPage', () => {
  test('defaults to slots-open (optimistic) while the status fetch is pending', () => {
    api.getInterestStatus.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ComingSoonPage />);

    expect(screen.getByRole('button', { name: 'Lock in your slot' })).toBeInTheDocument();
  });

  test('when slots are open, the CTA opens InterestModal with variant="slot"', async () => {
    api.getInterestStatus.mockResolvedValue({ slotsTotal: 10, slotsClaimed: 4, slotsRemaining: 6 });
    const user = userEvent.setup();
    render(<ComingSoonPage />);

    await screen.findByText('6 of 10 first-taste slots left');
    await user.click(screen.getByRole('button', { name: 'Lock in your slot' }));

    expect(screen.getByRole('heading', { name: 'Lock in your slot' })).toBeInTheDocument();
    // variant="slot" uniquely renders the landmark field and no "excites" field.
    expect(screen.getByLabelText('Popular landmark near you')).toBeInTheDocument();
    expect(screen.queryByLabelText('What excites you the most?')).not.toBeInTheDocument();
  });

  test('when slots are full, the "basket full" state shows and its CTA opens InterestModal with variant="general"', async () => {
    api.getInterestStatus.mockResolvedValue({ slotsTotal: 10, slotsClaimed: 10, slotsRemaining: 0 });
    const user = userEvent.setup();
    render(<ComingSoonPage />);

    expect(await screen.findByText('The basket is now full!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lock in your slot' })).not.toBeInTheDocument();

    // The page's own CTA renders a curly apostrophe (&rsquo;) — match loosely.
    await user.click(screen.getByRole('button', { name: /interested/i }));

    expect(screen.getByRole('heading', { name: "I'm interested" })).toBeInTheDocument();
    expect(screen.getByLabelText('What excites you the most?')).toBeInTheDocument();
    expect(screen.queryByLabelText('Popular landmark near you')).not.toBeInTheDocument();
  });

  test('closing the modal re-fetches the interest status', async () => {
    api.getInterestStatus.mockResolvedValue({ slotsTotal: 10, slotsClaimed: 4, slotsRemaining: 6 });
    const user = userEvent.setup();
    render(<ComingSoonPage />);

    await screen.findByText('6 of 10 first-taste slots left');
    await user.click(screen.getByRole('button', { name: 'Lock in your slot' }));
    expect(api.getInterestStatus).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('heading', { name: 'Lock in your slot' })).not.toBeInTheDocument();
    expect(api.getInterestStatus).toHaveBeenCalledTimes(2);
  });

  test('silently ignores a failed status fetch instead of crashing', async () => {
    api.getInterestStatus.mockRejectedValue(new Error('network down'));
    render(<ComingSoonPage />);

    await vi.waitFor(() => expect(api.getInterestStatus).toHaveBeenCalled());
    // Still optimistically open since status never resolved to a value.
    expect(screen.getByRole('button', { name: 'Lock in your slot' })).toBeInTheDocument();
  });
});
