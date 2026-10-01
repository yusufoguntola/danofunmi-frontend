import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import NigerianPhoneInput from '../../src/components/NigerianPhoneInput';

// NigerianPhoneInput is a controlled component — a stateful wrapper lets
// userEvent.type build up a value across keystrokes the way a real consumer
// (a form holding the full phone in its own state) would.
function Harness({ initial = '', onChange }) {
  const [value, setValue] = useState(initial);
  return (
    <NigerianPhoneInput
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('NigerianPhoneInput', () => {
  test('renders the fixed +234 country-code badge', () => {
    render(<NigerianPhoneInput value="" onChange={() => {}} />);
    expect(screen.getByText('+234')).toBeInTheDocument();
  });

  test('displays only the subscriber digits of a stored value, stripping a leading 0/234', () => {
    render(<NigerianPhoneInput value="08012345678" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('8012345678');
  });

  test('typing digits one by one builds up the normalized +234XXXXXXXXXX value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), '8012345678');

    expect(onChange).toHaveBeenLastCalledWith('+2348012345678');
    expect(screen.getByRole('textbox')).toHaveValue('8012345678');
  });

  test('pasting a full 10-digit subscriber number in one go normalizes correctly', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.paste('8012345678');

    expect(onChange).toHaveBeenLastCalledWith('+2348012345678');
    expect(input).toHaveValue('8012345678');
  });

  // Regression test — a real bug found while writing this suite and fixed in
  // the component. handleChange used to strip non-digits and take the FIRST
  // 10 digits of whatever was pasted, instead of reusing subscriberDigits'
  // prefix-aware stripping — so pasting a fully-formatted number (with its
  // leading 0/234/+234 still attached) produced a truncated, wrong value
  // instead of normalizing it.
  test('pasting a fully-formatted number (with a 0/234/+234 prefix) still normalizes correctly', async () => {
    const user = userEvent.setup();

    for (const pasted of ['08012345678', '2348012345678', '+2348012345678']) {
      const onChange = vi.fn();
      const { unmount } = render(<Harness onChange={onChange} />);
      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.paste(pasted);

      expect(onChange).toHaveBeenLastCalledWith('+2348012345678');
      unmount();
    }
  });

  test('strips non-digit characters out of pasted text', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.paste('801-234-5678');

    expect(onChange).toHaveBeenLastCalledWith('+2348012345678');
  });

  test('caps the typed subscriber number at 10 digits', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole('textbox'), '80123456789999');

    expect(screen.getByRole('textbox')).toHaveValue('8012345678');
  });

  test('applies the readOnly prop to the input and wrapper', () => {
    render(<NigerianPhoneInput value="+2348012345678" onChange={() => {}} readOnly />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('readOnly');
    expect(input.closest('.ng-phone-input')).toHaveClass('ng-phone-input--readonly');
  });

  test('falls back to a default placeholder, or uses a custom one when given', () => {
    const { rerender } = render(<NigerianPhoneInput value="" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', '8012345678');

    rerender(<NigerianPhoneInput value="" onChange={() => {}} placeholder="Your number" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Your number');
  });
});
