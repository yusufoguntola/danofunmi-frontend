// Single source for the business's contact channels — the footer and the
// chat widget's human-handoff link both read from here.
export const PHONE_DISPLAY = '+2347062845630';
// wa.me wants the number with no '+' and no leading zeros.
export const PHONE_WHATSAPP = '2347062845630';
export const INSTAGRAM_HANDLE = 'danofunmikitchen';
export const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_HANDLE}`;

/** A wa.me link that opens a chat with the business, optionally with a pre-filled message. */
export function whatsappLink(text) {
  const base = `https://wa.me/${PHONE_WHATSAPP}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
