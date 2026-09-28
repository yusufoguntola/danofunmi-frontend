import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { getRecaptchaToken } from '../lib/recaptcha';
import SiteFooter from '../components/SiteFooter';
import StarInput from '../components/StarInput';
import PublicHero from '../components/PublicHero';
import './GeneralFeedbackPage.css';

// Feedback with no specific order behind it — reached by sharing this link
// manually, or via the "Leave feedback" link in SiteFooter.jsx (so it's on
// every customer-facing page, landing page included). Unlike FeedbackPage
// (order-scoped, /feedback/:id), everything past the rating is free text
// the customer volunteers themselves, since there's no order to pull it
// from — see backend/src/routes/publicFeedback.js's POST /general.
export default function GeneralFeedbackPage() {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [location, setLocation] = useState('');
  const [foodType, setFoodType] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rating) {
      setSubmitError('Pick a star rating first.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const recaptchaToken = await getRecaptchaToken('general_feedback').catch(() => null);
      await api.submitGeneralFeedback({
        rating,
        comment: comment.trim() || undefined,
        customerName: customerName.trim() || undefined,
        location: location.trim() || undefined,
        foodType: foodType.trim() || undefined,
        recaptchaToken,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not submit your feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PublicHero />

      <main className="wrap general-feedback-page__body">
        <div className="card stack">
          <div>
            <h2 style={{ margin: 0 }}>{submitted ? 'Thanks for your feedback!' : 'Tell us what you think'}</h2>
            {!submitted && (
              <p className="muted" style={{ margin: '4px 0 0' }}>
                Had dánọ́fúnmi before? We&rsquo;d love to hear about it — no order needed.
              </p>
            )}
          </div>

          {submitted ? (
            <p className="muted">We really appreciate you taking the time.</p>
          ) : (
            <form onSubmit={handleSubmit} className="stack">
              <div className="field">
                <label>Your rating</label>
                <StarInput value={rating} onChange={setRating} />
              </div>
              <div className="field">
                <label htmlFor="general-feedback-comment">Comment (optional)</label>
                <textarea
                  id="general-feedback-comment"
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us what you thought…"
                />
              </div>
              <div className="field">
                <label htmlFor="general-feedback-name">Your name (optional)</label>
                <input
                  id="general-feedback-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="So we know who to thank"
                />
              </div>
              <div className="field">
                <label htmlFor="general-feedback-location">Your area (optional)</label>
                <input
                  id="general-feedback-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Bodija, Ibadan"
                />
              </div>
              <div className="field">
                <label htmlFor="general-feedback-food">What did you have? (optional)</label>
                <input
                  id="general-feedback-food"
                  value={foodType}
                  onChange={(e) => setFoodType(e.target.value)}
                  placeholder="e.g. Efo riro with rice"
                />
              </div>
              {submitError && <p className="form-error">{submitError}</p>}
              <button className="btn btn--primary" type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit feedback'}
              </button>
            </form>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
