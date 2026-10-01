import { describe, expect, test } from 'vitest';
import { decodeJwt, isTokenExpired, tokenType } from '../../src/lib/jwt';
import { fakeJwt } from '../helpers/fakeJwt';

describe('decodeJwt', () => {
  test('decodes a well-formed token payload', () => {
    expect(decodeJwt(fakeJwt({ sub: 'cust1', type: 'customer' }))).toEqual({ sub: 'cust1', type: 'customer' });
  });

  test('handles base64url chars (-/_) that differ from standard base64 (+//)', () => {
    // A payload whose JSON serialization is long/varied enough to likely
    // contain + and / when base64-encoded, proving the -/_ substitution
    // round-trips correctly rather than just happening to work on short input.
    const payload = { sub: 'a'.repeat(40), note: '>>??>>??>>??' };
    expect(decodeJwt(fakeJwt(payload))).toEqual(payload);
  });

  test('returns null for null/non-string/empty input', () => {
    expect(decodeJwt(null)).toBeNull();
    expect(decodeJwt(undefined)).toBeNull();
    expect(decodeJwt(42)).toBeNull();
    expect(decodeJwt('')).toBeNull();
  });

  test('returns null when the token does not have exactly 3 segments', () => {
    expect(decodeJwt('only.two')).toBeNull();
    expect(decodeJwt('a.b.c.d')).toBeNull();
    expect(decodeJwt('nodots')).toBeNull();
  });

  test('returns null when the payload segment is not valid base64/JSON', () => {
    expect(decodeJwt('header.not-valid-json!!!.sig')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  test('false for a token with no exp claim — lets the server decide', () => {
    expect(isTokenExpired(fakeJwt({ sub: 'cust1' }))).toBe(false);
  });

  test('false for a token expiring well in the future', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(isTokenExpired(fakeJwt({ exp }))).toBe(false);
  });

  test('true for a token that already expired', () => {
    const exp = Math.floor(Date.now() / 1000) - 3600;
    expect(isTokenExpired(fakeJwt({ exp }))).toBe(true);
  });

  test('true within the 5s clock-skew slack even if technically still valid', () => {
    const exp = Math.floor(Date.now() / 1000) + 2; // 2s from now, inside the 5s skew window
    expect(isTokenExpired(fakeJwt({ exp }))).toBe(true);
  });

  test('false for an undecodable token (treated as not-our-problem, not expired)', () => {
    expect(isTokenExpired('garbage')).toBe(false);
  });
});

describe('tokenType', () => {
  test('returns the type claim', () => {
    expect(tokenType(fakeJwt({ type: 'admin' }))).toBe('admin');
  });

  test('null when there is no type claim or the token is undecodable', () => {
    expect(tokenType(fakeJwt({ sub: 'cust1' }))).toBeNull();
    expect(tokenType('garbage')).toBeNull();
  });
});
