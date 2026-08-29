import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { ApiError } from '../lib/api';
import { getRecaptchaToken } from '../lib/recaptcha';
import GoogleSignInButton from '../components/GoogleSignInButton';
import './AuthPage.css';

export default function SignupPage() {
  const { session, signup, loginWithGoogle } = useCustomerAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (session?.token) return <Navigate to="/orders" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const recaptchaToken = await getRecaptchaToken('signup').catch(() => null);
      await signup({ ...form, recaptchaToken });
      navigate('/orders');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle(credential) {
    setError(null);
    try {
      await loginWithGoogle(credential);
      navigate('/orders');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign up with Google.');
    }
  }

  return (
    <div className="auth-page">
      <Link className="auth-page__logo" to="/">dánọ́fúnmi</Link>
      <form className="card stack auth-page__card" onSubmit={handleSubmit}>
        <h2 style={{ textAlign: 'center', margin: 0 }}>Create your account</h2>
        <p className="muted" style={{ textAlign: 'center', marginTop: -8 }}>
          Manage and track your orders in one place.
        </p>

        <div className="auth-page__google">
          <GoogleSignInButton onCredential={handleGoogle} />
        </div>
        <div className="auth-page__divider">or</div>

        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone number</label>
          <input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
          />
        </div>

        {error && <p className="form-error">{error}</p>}
        <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="auth-page__switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
