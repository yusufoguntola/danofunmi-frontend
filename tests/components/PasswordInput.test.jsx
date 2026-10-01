import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordInput from '../../src/components/PasswordInput';

describe('PasswordInput', () => {
  test('starts masked (type="password")', () => {
    render(<PasswordInput id="pw" value="" onChange={() => {}} />);
    expect(document.getElementById('pw')).toHaveAttribute('type', 'password');
  });

  test('clicking the toggle reveals the value, clicking again re-masks it', async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="pw" value="secret" onChange={() => {}} />);

    const toggle = screen.getByRole('button', { name: 'Show password' });
    await user.click(toggle);
    expect(document.getElementById('pw')).toHaveAttribute('type', 'text');

    const hideToggle = screen.getByRole('button', { name: 'Hide password' });
    await user.click(hideToggle);
    expect(document.getElementById('pw')).toHaveAttribute('type', 'password');
  });

  test('forwards id and other props (value, onChange) straight to the input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PasswordInput id="pw" value="" onChange={onChange} placeholder="Enter password" />);

    const input = document.getElementById('pw');
    expect(input).toHaveAttribute('placeholder', 'Enter password');

    await user.type(input, 'a');
    expect(onChange).toHaveBeenCalled();
  });
});
