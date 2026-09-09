// Client-side JWT introspection — NOT verification. The server verifies the
// signature; here we only peek at the payload to learn a token's `type` and
// its `exp`, so the app can log the user out the moment it lapses instead of
// waiting for the next API call to come back 401.

function base64UrlDecode(segment) {
  const padded = segment
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(segment.length / 4) * 4, '=');
  return atob(padded);
}

export function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

// A little slack so a token that's seconds from expiry (or a client clock
// running slightly ahead of the server's) is treated as already gone.
const CLOCK_SKEW_MS = 5000;

export function isTokenExpired(token) {
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') return false; // no exp claim → let the server decide
  return payload.exp * 1000 <= Date.now() + CLOCK_SKEW_MS;
}

export function tokenType(token) {
  return decodeJwt(token)?.type ?? null;
}
