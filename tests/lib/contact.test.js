import { describe, expect, test } from 'vitest';
import { toWhatsappNumber, whatsappLink, whatsappLinkTo } from '../../src/lib/contact';

describe('toWhatsappNumber', () => {
  test('swaps a leading local "0" for "234"', () => {
    expect(toWhatsappNumber('08012345678')).toBe('2348012345678');
  });

  test('leaves an already-international number alone (minus formatting)', () => {
    expect(toWhatsappNumber('+2348012345678')).toBe('2348012345678');
    expect(toWhatsappNumber('2348012345678')).toBe('2348012345678');
  });

  test('strips non-digit formatting (spaces, dashes)', () => {
    expect(toWhatsappNumber('0801 234 5678')).toBe('2348012345678');
  });

  test('handles empty input without throwing', () => {
    expect(toWhatsappNumber('')).toBe('');
    expect(toWhatsappNumber(null)).toBe('');
  });
});

describe('whatsappLinkTo', () => {
  test('builds a wa.me link with no text', () => {
    expect(whatsappLinkTo('08012345678')).toBe('https://wa.me/2348012345678');
  });

  test('appends a URL-encoded text param when given', () => {
    const link = whatsappLinkTo('08012345678', 'Hi there!');
    expect(link).toBe('https://wa.me/2348012345678?text=Hi%20there!');
  });
});

describe('whatsappLink', () => {
  test('links to the business\'s own number', () => {
    expect(whatsappLink()).toBe('https://wa.me/2347062845630');
  });
});
