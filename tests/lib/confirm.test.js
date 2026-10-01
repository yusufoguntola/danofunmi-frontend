import { describe, expect, test, vi, beforeEach } from 'vitest';
import Swal from 'sweetalert2';
import {
  alertError,
  confirmAction,
  confirmDelete,
  confirmWithInput,
  confirmWithSelect,
} from '../../src/lib/confirm';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('confirmAction', () => {
  test('resolves true when the dialog is confirmed', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true });

    await expect(confirmAction({ title: 'Sure?', text: 'Really?' })).resolves.toBe(true);
  });

  test('resolves false when the dialog is cancelled/dismissed', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: false });

    await expect(confirmAction({ title: 'Sure?' })).resolves.toBe(false);
  });

  test('passes title/text/icon and non-danger styling through to Swal.fire', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true });

    await confirmAction({ title: 'Sure?', text: 'Really?' });

    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sure?',
        text: 'Really?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, continue',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#2a5c37',
        focusCancel: true,
      })
    );
  });

  test('danger: true swaps the confirm color to red and drops cancel focus', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true });

    await confirmAction({ title: 'Delete?', danger: true });

    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({ confirmButtonColor: '#b3392c', focusCancel: false })
    );
  });
});

describe('confirmWithSelect', () => {
  test('builds inputOptions from the given [{value,label}] list', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true, value: 'loc2' });

    await confirmWithSelect({
      title: 'Pick a location',
      options: [
        { value: 'loc1', label: 'Ikeja' },
        { value: 'loc2', label: 'Lekki' },
      ],
      defaultValue: 'loc1',
    });

    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        input: 'select',
        inputOptions: { loc1: 'Ikeja', loc2: 'Lekki' },
        inputValue: 'loc1',
      })
    );
  });

  test('resolves to the chosen value when confirmed', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true, value: 'loc2' });

    await expect(
      confirmWithSelect({ title: 'Pick', options: [{ value: 'loc2', label: 'Lekki' }] })
    ).resolves.toBe('loc2');
  });

  test('resolves to null when cancelled/dismissed', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: false, value: 'loc2' });

    await expect(
      confirmWithSelect({ title: 'Pick', options: [{ value: 'loc2', label: 'Lekki' }] })
    ).resolves.toBeNull();
  });
});

describe('confirmWithInput', () => {
  test('passes placeholder/inputValue through and uses a text input', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true, value: 'Musa' });

    await confirmWithInput({ title: "Rider's name?", placeholder: 'e.g. Musa', inputValue: 'prefill' });

    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'text', inputPlaceholder: 'e.g. Musa', inputValue: 'prefill' })
    );
  });

  test('resolves to the trimmed typed value when confirmed', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true, value: '  Musa  ' });

    await expect(confirmWithInput({ title: 'Name?' })).resolves.toBe('Musa');
  });

  test('resolves to an empty string (not undefined) for a confirmed-but-blank input', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true, value: '' });

    await expect(confirmWithInput({ title: 'Name?' })).resolves.toBe('');
  });

  test('resolves to undefined when cancelled/dismissed, distinct from a blank confirm', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: false, value: '' });

    await expect(confirmWithInput({ title: 'Name?' })).resolves.toBeUndefined();
  });
});

describe('alertError', () => {
  test('fires a single-button error dialog with the given title/text', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true });

    await alertError('Oops', 'Something broke');

    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Oops',
        text: 'Something broke',
        icon: 'error',
        confirmButtonColor: '#2a5c37',
      })
    );
  });

  test('passes the Swal.fire resolution straight through (no mapping)', async () => {
    const resolved = { isConfirmed: true, isDismissed: false };
    Swal.fire.mockResolvedValue(resolved);

    await expect(alertError('Oops', 'Something broke')).resolves.toBe(resolved);
  });
});

describe('confirmDelete', () => {
  test('builds a danger confirmAction dialog for the given subject', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true });

    await confirmDelete('this menu item');

    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete this menu item?',
        text: "This can't be undone.",
        confirmButtonText: 'Delete',
        confirmButtonColor: '#b3392c',
        focusCancel: false,
      })
    );
  });

  test('resolves true/false the same way confirmAction does', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: false });

    await expect(confirmDelete('this item')).resolves.toBe(false);
  });
});
