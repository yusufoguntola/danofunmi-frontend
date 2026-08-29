import { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../lib/api';

const CustomerAuthContext = createContext(null);

const STORAGE_KEY = 'danofunmi_customer_session';

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
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

  return (
    <CustomerAuthContext.Provider value={{ session, signup, login, loginWithGoogle, logout }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
