import { describe, expect, test } from 'vitest';
import { DEFAULT_RECEIPT_MAX_KB, receiptFileError } from '../../src/lib/receiptValidation';

function fileOfSize(bytes) {
  return { size: bytes };
}

describe('receiptFileError', () => {
  test('null (no error) for a file at or under the limit', () => {
    expect(receiptFileError(fileOfSize(1024), 10)).toBeNull();
    expect(receiptFileError(fileOfSize(10 * 1024), 10)).toBeNull(); // exactly at the limit
  });

  test('an error message for a file over the limit', () => {
    const error = receiptFileError(fileOfSize(11 * 1024), 10);
    expect(error).toContain('10KB');
    expect(error).toContain('too large');
  });

  test('defaults to DEFAULT_RECEIPT_MAX_KB when no limit is passed', () => {
    expect(receiptFileError(fileOfSize(DEFAULT_RECEIPT_MAX_KB * 1024))).toBeNull();
    expect(receiptFileError(fileOfSize(DEFAULT_RECEIPT_MAX_KB * 1024 + 1))).not.toBeNull();
  });
});
