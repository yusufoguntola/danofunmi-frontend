import { describe, expect, test, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../src/components/ProtectedRoute';
import { AdminAuthProvider } from '../../src/context/AdminAuthContext';
import { fakeJwt } from '../helpers/fakeJwt';

const STORAGE_KEY = 'danofunmi_admin_session';

function renderWithSession() {
  return render(
    <AdminAuthProvider>
      <MemoryRouter initialEntries={['/restricted-path']}>
        <Routes>
          <Route
            path="/restricted-path"
            element={
              <ProtectedRoute>
                <div>Protected content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/restricted-path/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </AdminAuthProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('ProtectedRoute', () => {
  test('renders children when there is a valid, unexpired admin session', () => {
    const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { email: 'admin@test.com' } }));

    renderWithSession();

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  test('redirects to the admin login route when there is no session', () => {
    renderWithSession();

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  test('redirects to the admin login route when the stored session is expired', () => {
    const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) - 3600 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { email: 'admin@test.com' } }));

    renderWithSession();

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
