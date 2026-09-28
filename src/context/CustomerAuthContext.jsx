import { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { isTokenExpired } from '../lib/jwt';

const CustomerAuthContext = createContext(null);

const STORAGE_KEY = 'danofunmi_customer_session';

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // An expired token means the user is effectively signed out already.
    if (isTokenExpired(parsed?.token)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function CustomerAuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);

  const persist = useCallback((next) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    return next;
  }, []);

  const signup = useCallback(
    async ({ name, email, phone, password, recaptchaToken }) =>
      persist(await api.customerSignup({ name, email, phone, password, recaptchaToken })),
    [persist]
  );

  const login = useCallback(
    async (identifier, password, recaptchaToken) =>
      persist(await api.customerLogin(identifier, password, recaptchaToken)),
    [persist]
  );

  const loginWithGoogle = useCallback(
    async (credential) => persist(await api.customerGoogleLogin(credential)),
    [persist]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  // Re-fetches the account's own profile and updates the cached session —
  // name/phone/address can change server-side after the token was issued
  // (e.g. a placed order backfilling phone or address, see
  // lib/orderCreation.js), and the session is otherwise only ever as fresh
  // as the last login. Returns the fresh customer object directly (rather
  // than relying on a caller re-reading `session` right after, which
  // wouldn't see this update in the same tick) — a no-op returning null if
  // signed out or the request fails (e.g. an expired token; SessionWatcher
  // handles that separately).
  const refresh = useCallback(async () => {
    if (!session?.token) return null;
    try {
      const customer = await api.getCustomerProfile(session.token);
      persist({ ...session, customer });
      return customer;
    } catch {
      return null;
    }
  }, [session, persist]);

  return (
    <CustomerAuthContext.Provider value={{ session, signup, login, loginWithGoogle, logout, refresh }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
