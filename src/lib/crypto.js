// Client half of the optional payload encryption (see backend/src/lib/
// payloadCrypto.js). AES-256-GCM via the Web Crypto API with a pre-shared key
// baked into the build. Enabled only when VITE_ENCRYPTION_ENABLED === "true".
//
// Wire format: base64( iv[12] | ciphertext | authTag[16] ) — Web Crypto
// appends the 16-byte GCM tag to the ciphertext, which is exactly what the
// Node side expects.

export const encryptionEnabled = import.meta.env.VITE_ENCRYPTION_ENABLED === 'true';

const RAW_KEY = (import.meta.env.VITE_ENCRYPTION_KEY || '').trim();
const IV_LEN = 12;

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

let keyPromise = null;
function getKey() {
  if (!keyPromise) {
    const bytes = /^[0-9a-fA-F]{64}$/.test(RAW_KEY) ? hexToBytes(RAW_KEY) : base64ToBytes(RAW_KEY);
    if (bytes.length !== 32) {
      return Promise.reject(new Error('VITE_ENCRYPTION_KEY must decode to 32 bytes (hex or base64)'));
    }
    keyPromise = crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  return keyPromise;
}

export async function encryptText(plaintext) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  );
  const out = new Uint8Array(iv.length + ciphertext.length);
  out.set(iv, 0);
  out.set(ciphertext, iv.length);
  return bytesToBase64(out);
}

export async function decryptText(payload) {
  const key = await getKey();
  const buf = base64ToBytes(payload);
  const iv = buf.slice(0, IV_LEN);
  const data = buf.slice(IV_LEN);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plaintext);
}
