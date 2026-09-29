// The real limit is set server-side (backend/.env's RECEIPT_MAX_FILE_SIZE_KB)
// and comes down via GET /api/payment-info's maxReceiptFileSizeKB — see
// OrderStatusPage and ChatWidget, which both fetch it and pass it into
// receiptFileError. This is only the fallback shown/used before that fetch
// resolves (or if it fails), so it's kept equal to uploads.js's own default.
export const DEFAULT_RECEIPT_MAX_KB = 15360;

export function receiptFileError(file, maxKB = DEFAULT_RECEIPT_MAX_KB) {
  if (file.size > maxKB * 1024) {
    return `That photo is too large (max ${maxKB}KB). Please try a smaller photo or a screenshot instead.`;
  }
  return null;
}
