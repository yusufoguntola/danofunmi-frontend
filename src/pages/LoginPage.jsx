import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { ApiError } from '../lib/api';
import { getRecaptchaToken } from '../lib/recaptcha';
import GoogleSignInButton from '../components/GoogleSignInButton';
import LogoMark from '../components/LogoMark';
import './AuthPage.css';

export default function LoginPage() {
  const { session, login, loginWithGoogle } = useCustomerAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (session?.token) return <Navigate to="/orders" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const recaptchaToken = await getRecaptchaToken('login').catch(() => null);
      await login(identifier, password, recaptchaToken);
      navigate('/orders');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.');
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
      setError(err instanceof ApiError ? err.message : 'Could not sign in with Google.');
    }
  }

  return (
    <div className="auth-page">
      <Link className="auth-page__logo" to="/">
        <LogoMark size={30} />
        dánọ́fúnmi
      </Link>
      <form className="card stack auth-page__card" onSubmit={handleSubmit}>
        <h2 style={{ textAlign: 'center', margin: 0 }}>Sign in</h2>

        <div className="auth-page__google">
          <GoogleSignInButton onCredential={handleGoogle} />
        </div>
        <div className="auth-page__divider">or</div>

        <div className="field">
          <label htmlFor="identifier">Email or phone number</label>
          <input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="form-error">{error}</p>}
        <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="auth-page__switch">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
