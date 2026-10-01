import { describe, expect, test, vi, beforeEach } from 'vitest';
import {
  consumeSessionExpired,
  emitSessionExpired,
  markSessionExpired,
  onSessionExpired,
} from '../../src/lib/sessionEvents';

beforeEach(() => {
  sessionStorage.clear();
});

describe('emitSessionExpired / onSessionExpired', () => {
  test('a subscribed handler receives the emitted scope', () => {
    const handler = vi.fn();
    const unsubscribe = onSessionExpired(handler);

    emitSessionExpired('admin');

    expect(handler).toHaveBeenCalledWith({ scope: 'admin' });
    unsubscribe();
  });

  test('a missing/undefined scope is normalized to null', () => {
    const handler = vi.fn();
    const unsubscribe = onSessionExpired(handler);

    emitSessionExpired(undefined);

    expect(handler).toHaveBeenCalledWith({ scope: null });
    unsubscribe();
  });

  test('the returned unsubscribe function stops further notifications', () => {
    const handler = vi.fn();
    const unsubscribe = onSessionExpired(handler);

    unsubscribe();
    emitSessionExpired('customer');

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('markSessionExpired / consumeSessionExpired', () => {
  test('is a one-shot flag: true the first time, false on repeat calls', () => {
    markSessionExpired('admin');

    expect(consumeSessionExpired('admin')).toBe(true);
    expect(consumeSessionExpired('admin')).toBe(false);
  });

  test('returns false when nothing was marked', () => {
    expect(consumeSessionExpired('admin')).toBe(false);
  });

  test('returns false when the stored scope does not match the requested one', () => {
    markSessionExpired('admin');

    expect(consumeSessionExpired('customer')).toBe(false);
    // Not consumed by the mismatched read — still there for the right scope.
    expect(consumeSessionExpired('admin')).toBe(true);
  });

  test('marking with no scope falls back to the wildcard "1" value, matching any requested scope', () => {
    markSessionExpired();

    expect(consumeSessionExpired('customer')).toBe(true);
  });

  test('consumeSessionExpired with no scope argument matches whatever was stored', () => {
    markSessionExpired('admin');

    expect(consumeSessionExpired()).toBe(true);
  });

  test('markSessionExpired swallows a storage write failure instead of throwing', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(() => markSessionExpired('admin')).not.toThrow();

    setItemSpy.mockRestore();
  });

  test('consumeSessionExpired swallows a storage read failure and returns false', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(consumeSessionExpired('admin')).toBe(false);

    getItemSpy.mockRestore();
  });
});
