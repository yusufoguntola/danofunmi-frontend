import { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { isTokenExpired } from '../lib/jwt';

const AdminAuthContext = createContext(null);

const STORAGE_KEY = 'danofunmi_admin_session';

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A token that's already expired is as good as no session — drop it so the
    // app boots straight to the login screen instead of flashing the dashboard.
    if (isTokenExpired(parsed?.token)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);

  const login = useCallback(async (email, password) => {
    const { token, admin } = await api.adminLogin(email, password);
    const next = { token, admin };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
