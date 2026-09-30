import { useState } from 'react';
import './PasswordInput.css';

/** A password `<input>` with an eye-icon toggle to reveal the typed value.
 * Drop-in replacement for `<input type="password">` — every other prop
 * (id, value, onChange, required, minLength, autoComplete, …) passes
 * straight through. Used by LoginPage, SignupPage, and admin's AdminLogin. */
export default function PasswordInput({ id, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input">
      <input id={id} type={visible ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  );
}
