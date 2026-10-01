// Builds a real base64url-encoded JWT-shaped string (header/payload/signature)
// for tests — shared by anything touching lib/jwt.js's decode/expiry logic
// (AdminAuthContext, CustomerAuthContext, ProtectedRoute, SessionWatcher, ...)
// so each test file doesn't reimplement the same encoder.
export function fakeJwt(payload) {
  const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
}
