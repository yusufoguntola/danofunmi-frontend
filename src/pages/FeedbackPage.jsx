import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import SiteFooter from '../components/SiteFooter';
import StarInput from '../components/StarInput';
import PublicHero from '../components/PublicHero';
import './FeedbackPage.css';

// Feedback about a *specific* order — linked from the "delivered" order-
// status email (see backend/src/lib/email.js); order id/narration/number in
// the URL uniquely identifies which order the feedback is for. GET
// /api/feedback/order/:id carries just enough of the order + customer for
// this page (name, items), never the full order record. For feedback not
// tied to any order, see GeneralFeedbackPage (route /feedback, no id).
export default function FeedbackPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getOrderFeedback(id);
      setData(res);
      if (res.existingFeedback) setSubmitted(res.existingFeedback);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this order.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rating) {
      setSubmitError('Pick a star rating first.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.submitOrderFeedback(id, { rating, comment: comment.trim() || undefined });
      setSubmitted(res);
    } catch (err) {
      // Someone revisiting/double-submitting the same link — show what's
      // already on file instead of an error.
      if (err instanceof ApiError && err.status === 409 && err.body?.existingFeedback) {
        setSubmitted(err.body.existingFeedback);
      } else {
        setSubmitError(err instanceof ApiError ? err.message : 'Could not submit your feedback. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const firstName = (data?.customerName || '').trim().split(/\s+/)[0] || 'there';

  return (
    <div className="feedback-page">
      <PublicHero />

      <main className="wrap feedback-page__body">
        {loading && <p>Loading&hellip;</p>}
        {!loading && error && <p className="form-error">{error}</p>}

        {!loading && !error && data && (
          <div className="card stack">
            <div>
              <p className="muted" style={{ margin: 0 }}>Order {data.narration}</p>
              <h2 style={{ margin: '2px 0 0' }}>
                {submitted ? 'Thanks for your feedback!' : `How was it, ${firstName}?`}
              </h2>
            </div>

            {data.status !== 'DELIVERED' ? (
              <p className="muted">
                Feedback opens up once this order has been delivered — right now it&rsquo;s{' '}
                <strong>{data.status.replace(/_/g, ' ').toLowerCase()}</strong>.
              </p>
            ) : submitted ? (
              <div className="stack">
                <StarInput value={submitted.rating} />
                {submitted.comment && <p className="muted">&ldquo;{submitted.comment}&rdquo;</p>}
                <p className="muted" style={{ fontSize: '0.85rem' }}>We really appreciate you taking the time.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="stack">
                <div className="field">
                  <label>Your rating</label>
                  <StarInput value={rating} onChange={setRating} />
                </div>
                <div className="field">
                  <label htmlFor="feedback-comment">Comment (optional)</label>
                  <textarea
                    id="feedback-comment"
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us what you thought…"
                  />
                </div>
                {submitError && <p className="form-error">{submitError}</p>}
                <button className="btn btn--primary" type="submit" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit feedback'}
                </button>
              </form>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
