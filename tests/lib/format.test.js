import { describe, expect, test } from 'vitest';
import { formatDate, formatNaira, formatStatus } from '../../src/lib/format';

describe('formatNaira', () => {
  test('formats a whole-number amount with the ₦ symbol, no decimals', () => {
    expect(formatNaira(4500)).toBe('₦4,500');
    expect(formatNaira(0)).toBe('₦0');
  });

  test('treats a non-numeric amount as 0 rather than throwing', () => {
    expect(formatNaira(undefined)).toBe('₦0');
    expect(formatNaira(null)).toBe('₦0');
    expect(formatNaira('not a number')).toBe('₦0');
  });

  test('coerces a numeric string (e.g. a Prisma Decimal serialized over JSON)', () => {
    expect(formatNaira('4500')).toBe('₦4,500');
  });
});

describe('formatStatus', () => {
  test('replaces underscores with spaces', () => {
    expect(formatStatus('PENDING_PAYMENT')).toBe('PENDING PAYMENT');
    expect(formatStatus('OUT_FOR_DELIVERY')).toBe('OUT FOR DELIVERY');
  });

  test('handles a status with no underscores, or none at all', () => {
    expect(formatStatus('DELIVERED')).toBe('DELIVERED');
    expect(formatStatus(null)).toBe('');
    expect(formatStatus(undefined)).toBe('');
  });
});

describe('formatDate', () => {
  test('returns an em dash placeholder for a missing value', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  test('formats a real date into something non-empty', () => {
    const formatted = formatDate('2026-09-30T12:00:00.000Z');
    expect(formatted).not.toBe('—');
    expect(formatted.length).toBeGreaterThan(0);
  });
});
