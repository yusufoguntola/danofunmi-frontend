import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StarInput from '../../src/components/StarInput';

describe('StarInput', () => {
  test('renders 5 stars with the first `value` of them filled', () => {
    render(<StarInput value={3} onChange={() => {}} />);
    const stars = screen.getAllByRole('button');
    expect(stars).toHaveLength(5);
    expect(stars[0]).toHaveClass('is-filled');
    expect(stars[1]).toHaveClass('is-filled');
    expect(stars[2]).toHaveClass('is-filled');
    expect(stars[3]).not.toHaveClass('is-filled');
    expect(stars[4]).not.toHaveClass('is-filled');
  });

  test('clicking a star calls onChange with its number when interactive', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StarInput value={2} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '4 stars' }));

    expect(onChange).toHaveBeenCalledWith(4);
  });

  test('is read-only (disabled, no radiogroup role) when no onChange is given', () => {
    render(<StarInput value={3} />);
    const stars = screen.getAllByRole('button');
    stars.forEach((star) => expect(star).toBeDisabled());
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  test('clicking a disabled star does not throw and has no onChange to call', async () => {
    const user = userEvent.setup();
    render(<StarInput value={3} />);
    await user.click(screen.getByRole('button', { name: '1 star' }));
    // No assertion target beyond "did not throw" — button is disabled so the
    // click is a no-op; absence of an error is the test.
  });
});
