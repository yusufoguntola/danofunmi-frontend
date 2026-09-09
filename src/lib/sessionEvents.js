// A tiny pub/sub the non-React API layer uses to tell the app that a token was
// rejected by the server (or has lapsed locally), so <SessionWatcher> can log
// the user out and send them to the right login screen.

const target = new EventTarget();
const EVENT = 'session-expired';

/** @param {'admin'|'customer'|null} scope */
export function emitSessionExpired(scope) {
  target.dispatchEvent(new CustomEvent(EVENT, { detail: { scope: scope ?? null } }));
}

export function onSessionExpired(handler) {
  const listener = (e) => handler(e.detail);
  target.addEventListener(EVENT, listener);
  return () => target.removeEventListener(EVENT, listener);
}

// A one-shot "you were signed out because your session lapsed" flag, survived
// across the redirect via sessionStorage so it's immune to router-state races
// between <ProtectedRoute> and <SessionWatcher> both bouncing to /login.
const EXPIRED_KEY = 'danofunmi_session_expired';

export function markSessionExpired(scope) {
  try {
    sessionStorage.setItem(EXPIRED_KEY, scope || '1');
  } catch {
    /* private mode / storage disabled — the message is a nicety, skip it */
  }
}

/** Reads and clears the flag. Returns true only if it was set (for `scope`, if given). */
export function consumeSessionExpired(scope) {
  try {
    const value = sessionStorage.getItem(EXPIRED_KEY);
    if (!value) return false;
    if (scope && value !== scope && value !== '1') return false;
    sessionStorage.removeItem(EXPIRED_KEY);
    return true;
  } catch {
    return false;
  }
}
