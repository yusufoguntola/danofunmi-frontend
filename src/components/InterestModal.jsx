import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { getRecaptchaToken } from '../lib/recaptcha';
import Modal from './Modal';

const EMPTY = { name: '', email: '', phone: '', address: '', landmark: '', excites: '' };

/**
 * `variant="slot"` — the "Lock in your slot" flow: asks for a Popular
 * Landmark and counts against the limited first-taste slots.
 * `variant="general"` (default) — the plain waitlist form, unchanged from
 * before, no slot claimed.
 */
export default function InterestModal({ onClose, variant = 'general' }) {
  const isSlot = variant === 'slot';
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { claimedSlot, alreadyShortlisted } once submitted

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const recaptchaToken = await getRecaptchaToken('interest').catch(() => null);
      const payload = { ...form, claimSlot: isSlot, recaptchaToken };
      if (!isSlot) delete payload.landmark;
      const res = await api.registerInterest(payload);
      setResult({ claimedSlot: !!res?.claimedSlot, alreadyShortlisted: !!res?.alreadyShortlisted });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const title = result
    ? (result.alreadyShortlisted ? "You're already on the list" : result.claimedSlot ? "You're in!" : "You're on the list")
    : (isSlot ? 'Lock in your slot' : "I'm interested");

  return (
    <Modal title={title} onClose={onClose}>
      {result ? (
        <div className="stack" style={{ gap: 16 }}>
          <p className="form-success" style={{ margin: 0 }}>
            {result.alreadyShortlisted
              ? `You're already on our first-taste list, ${form.name.split(' ')[0] || 'friend'} — sit tight, we'll be in touch soon!`
              : result.claimedSlot
                ? `Nice one, ${form.name.split(' ')[0] || 'friend'} — your first-taste slot is locked in. We'll be in touch with next steps.`
                : `Thanks, ${form.name.split(' ')[0] || 'friend'}! ${isSlot ? "The first-taste slots just filled up, but you're now on our waitlist — " : "We'll be in touch "}we'll let you know the moment ordering opens.`}
          </p>
          <button type="button" className="btn btn--primary btn--block" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <form className="stack" style={{ gap: 0 }} onSubmit={handleSubmit}>
          <p className="muted" style={{ marginTop: -4 }}>
            {isSlot
              ? "Leave your details to lock in a first-taste slot — your first perk is free from the kitchen, delivery fee on you."
              : "Leave your details and we'll let you know the moment monthly ordering goes live."}
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
          {isSlot && (
            <div className="field">
              <label htmlFor="interest-landmark">Popular landmark near you</label>
              <input
                id="interest-landmark"
                value={form.landmark}
                onChange={set('landmark')}
                required
                maxLength={200}
                placeholder="e.g. Opposite Ecobank, Akobo"
              />
            </div>
          )}
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
            {submitting ? 'Sending…' : (isSlot ? 'Lock in my slot' : 'Count me in')}
          </button>
        </form>
      )}
    </Modal>
  );
}
