// Single source for the business's contact channels — the footer and the
// chat widget's human-handoff link both read from here.
export const PHONE_DISPLAY = '+2347062845630';
// wa.me wants the number with no '+' and no leading zeros.
export const PHONE_WHATSAPP = '2347062845630';
export const INSTAGRAM_HANDLE = 'danofunmikitchen';
export const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_HANDLE}`;

// Every phone number in this app (customers, Locations, the business's own
// number above) is Nigerian — stored either as a local "0803..." number or
// already-international "234803...". wa.me wants international with no '+'
// and no leading zero, so local numbers get "0" swapped for "234".
export function toWhatsappNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) return `234${digits.slice(1)}`;
  return digits;
}

/** A wa.me link to an arbitrary phone number, optionally with a pre-filled message. */
export function whatsappLinkTo(phone, text) {
  const base = `https://wa.me/${toWhatsappNumber(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** A wa.me link that opens a chat with the business itself. */
export function whatsappLink(text) {
  return whatsappLinkTo(PHONE_WHATSAPP, text);
}
