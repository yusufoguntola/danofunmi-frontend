import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

// obfuscationEnabled / the AES key are computed once at module-load time from
// import.meta.env, so each test that needs a different env combination must
// stub the env *then* reset the module registry and re-import fresh — simply
// importing once at the top of the file would freeze in whatever env happened
// to be active first.
const HEX_KEY = 'a1'.repeat(32); // 64 hex chars = 32 bytes

function base64Key() {
  const bytes = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('payloadObfuscation', () => {
  test('obfuscationEnabled reflects VITE_PAYLOAD_OBFUSCATION_ENABLED exactly equal to "true"', async () => {
    vi.stubEnv('VITE_PAYLOAD_OBFUSCATION_ENABLED', 'true');
    const mod = await import('../../src/lib/payloadObfuscation');
    expect(mod.obfuscationEnabled).toBe(true);
  });

  test('obfuscationEnabled is false for any other value, including unset', async () => {
    vi.stubEnv('VITE_PAYLOAD_OBFUSCATION_ENABLED', 'false');
    const mod = await import('../../src/lib/payloadObfuscation');
    expect(mod.obfuscationEnabled).toBe(false);
  });

  test('round-trips plaintext through obfuscatePayload -> deobfuscatePayload with a hex key', async () => {
    vi.stubEnv('VITE_PAYLOAD_OBFUSCATION_KEY', HEX_KEY);
    const { obfuscatePayload, deobfuscatePayload } = await import('../../src/lib/payloadObfuscation');

    const plaintext = JSON.stringify({ hello: 'world', n: 42 });
    const wire = await obfuscatePayload(plaintext);

    expect(typeof wire).toBe('string');
    expect(wire).not.toBe(plaintext);
    await expect(deobfuscatePayload(wire)).resolves.toBe(plaintext);
  });

  test('round-trips with a base64-encoded key too', async () => {
    vi.stubEnv('VITE_PAYLOAD_OBFUSCATION_KEY', base64Key());
    const { obfuscatePayload, deobfuscatePayload } = await import('../../src/lib/payloadObfuscation');

    const plaintext = 'a plain text payload';
    const wire = await obfuscatePayload(plaintext);

    await expect(deobfuscatePayload(wire)).resolves.toBe(plaintext);
  });

  test('two obfuscations of the same plaintext differ (random IV each time)', async () => {
    vi.stubEnv('VITE_PAYLOAD_OBFUSCATION_KEY', HEX_KEY);
    const { obfuscatePayload } = await import('../../src/lib/payloadObfuscation');

    const a = await obfuscatePayload('same input');
    const b = await obfuscatePayload('same input');

    expect(a).not.toBe(b);
  });

  test('rejects when the configured key does not decode to 32 bytes', async () => {
    // Valid base64 (no hex match, no invalid chars) but far too short.
    vi.stubEnv('VITE_PAYLOAD_OBFUSCATION_KEY', 'abcd1234');
    const { obfuscatePayload } = await import('../../src/lib/payloadObfuscation');

    await expect(obfuscatePayload('x')).rejects.toThrow('must decode to 32 bytes');
  });
});
