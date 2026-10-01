import { describe, expect, test } from 'vitest';
import { isValidNigerianPhone, subscriberDigits, toNigerianPhone } from './phone';

describe('subscriberDigits', () => {
  test('strips a leading local "0"', () => {
    expect(subscriberDigits('08012345678')).toBe('8012345678');
  });

  test('strips a leading international "234"', () => {
    expect(subscriberDigits('2348012345678')).toBe('8012345678');
    expect(subscriberDigits('+2348012345678')).toBe('8012345678');
  });

  test('leaves a bare 10-digit subscriber number alone', () => {
    expect(subscriberDigits('8012345678')).toBe('8012345678');
  });

  test('caps at 10 digits', () => {
    expect(subscriberDigits('080123456789999')).toHaveLength(10);
  });

  test('handles empty/garbage input without throwing', () => {
    expect(subscriberDigits('')).toBe('');
    expect(subscriberDigits(null)).toBe('');
    expect(subscriberDigits('abc')).toBe('');
  });

  // Regression test — a real bug found and fixed in this session. The first
  // version took "the last 10 digits of the whole value", which happened to
  // work for a *complete* local/international number (the prefix is exactly
  // 1 or 3 digits, so the math lined up by coincidence) but corrupted the
  // value while still typing: with fewer than 10 subscriber digits entered,
  // the "234" from NigerianPhoneInput's own country-code badge bled into the
  // window, and the corruption compounded every keystroke since the
  // corrupted display fed back through toNigerianPhone on the next render.
  test('builds up correctly digit-by-digit while typing (incremental-typing regression)', () => {
    let value = '';
    for (const digit of '9021234567') {
      const typedSoFar = (subscriberDigits(value) + digit).slice(0, 10);
      value = toNigerianPhone(typedSoFar);
    }
    expect(subscriberDigits(value)).toBe('9021234567');
  });
});

describe('toNigerianPhone', () => {
  test('prefixes +234', () => {
    expect(toNigerianPhone('8012345678')).toBe('+2348012345678');
  });
});

describe('isValidNigerianPhone', () => {
  test.each([
    ['08012345678', true],
    ['+2348012345678', true],
    ['2349021234567', true],
    ['0801234567', false], // one digit short
    ['+234801234567890', false], // too long
    ['', false],
    ['not a phone', false],
  ])('%s -> %s', (phone, expected) => {
    expect(isValidNigerianPhone(phone)).toBe(expected);
  });
});
