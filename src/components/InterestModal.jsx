import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { getRecaptchaToken } from '../lib/recaptcha';
import Modal from './Modal';

const EMPTY = { name: '', email: '', phone: '', address: '', excites: '' };

export default function InterestModal({ onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const recaptchaToken = await getRecaptchaToken('interest').catch(() => null);
      await api.registerInterest({ ...form, recaptchaToken });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={done ? "You're on the list" : "I'm interested"} onClose={onClose}>
      {done ? (
        <div className="stack" style={{ gap: 16 }}>
          <p className="form-success" style={{ margin: 0 }}>
            Thanks, {form.name.split(' ')[0] || 'friend'}! We&rsquo;ll be in touch as soon as ordering opens.
          </p>
          <button type="button" className="btn btn--primary btn--block" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <form className="stack" style={{ gap: 0 }} onSubmit={handleSubmit}>
          <p className="muted" style={{ marginTop: -4 }}>
            Leave your details and we&rsquo;ll let you know the moment monthly ordering goes live.
          </p>

          <div className="field">
            <label htmlFor="interest-name">Name</label>
            <input id="interest-name" value={form.name} onChange={set('name')} required maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="interest-email">Email</label>
            <input
              id="interest-email"
              type="email"
              value={form.email}
              onChange={set('email')}
              required
              maxLength={180}
            />
          </div>
          <div className="field">
            <label htmlFor="interest-phone">Phone</label>
            <input
              id="interest-phone"
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              required
              maxLength={40}
            />
          </div>
          <div className="field">
            <label htmlFor="interest-address">Address</label>
            <input
              id="interest-address"
              value={form.address}
              onChange={set('address')}
              required
              maxLength={400}
            />
          </div>
          <div className="field">
            <label htmlFor="interest-excites">What excites you the most?</label>
            <textarea
              id="interest-excites"
              rows={3}
              value={form.excites}
              onChange={set('excites')}
              maxLength={1000}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Count me in'}
          </button>
        </form>
      )}
    </Modal>
  );
}
