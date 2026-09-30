// Every Nigerian mobile number is a fixed +234 country code plus a 10-digit
// subscriber number starting 7, 8, or 9 (every Nigerian mobile prefix) —
// mirrors backend/src/lib/phone.js's validator.
export const NG_COUNTRY_CODE = '+234';
const NG_SUBSCRIBER_RE = /^[789]\d{9}$/;

/** Pulls the subscriber number out of a phone stored in any of the formats
 * this app has used ("0801...", "234801...", "+234801..."), for pre-filling
 * NigerianPhoneInput from an existing account/order value — and, fed back
 * through on every keystroke, for building up what the customer is
 * currently typing.
 *
 * Strips a recognized prefix ("234" or a leading "0") off the FRONT, then
 * caps at 10 digits — deliberately not just "take the last 10 digits of
 * the whole string": while still typing, the subscriber part is shorter
 * than 10 digits, so a naive last-10 slice would eat into the "234" the
 * country-code badge already contributes (e.g. typing just "8" produces
 * the full value "+2348", whose last-10-digits naively taken is "2348",
 * not "8" — and every following keystroke compounds that same mistake). */
export function subscriberDigits(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('234')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function isValidNigerianPhone(phone) {
  return NG_SUBSCRIBER_RE.test(subscriberDigits(phone)) && String(phone || '').replace(/\D/g, '').length <= 13;
}

/** Combines the fixed country code with a typed subscriber number into the
 * full phone string this app stores/sends. */
export function toNigerianPhone(subscriberPart) {
  return `${NG_COUNTRY_CODE}${subscriberPart}`;
}
