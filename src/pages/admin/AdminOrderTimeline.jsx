import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatTimelineDate, formatDeliveryRange } from '../../lib/orderTimeline';

const EMPTY = { opensOn: '', closesOn: '', deliveryStartsOn: '', deliveryEndsOn: '' };

// Same rules the server enforces (backend/src/lib/orderTimeline.js), checked
// here too so admin sees the problem before a round trip. 'YYYY-MM-DD'
// strings compare correctly as plain strings.
function validate(t) {
  if (Object.values(t).some((v) => !v)) return 'All four dates are required.';
  if (t.closesOn < t.opensOn) return 'Ordering must close on or after the day it opens.';
  if (t.deliveryStartsOn <= t.closesOn) return 'Delivery must start after ordering closes.';
  if (t.deliveryEndsOn < t.deliveryStartsOn) return 'Delivery must end on or after the day it starts.';
  return null;
}

/** Edit the current run's ordering timeline — drives the site's order-window
 * flyer and the delivery window quoted in order-confirmation notifications. */
export default function AdminOrderTimeline() {
  const { session } = useAdminAuth();
  const token = session.token;
  const [draft, setDraft] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .adminGetOrderTimeline(token)
      .then((t) => {
        if (t) {
          const { opensOn, closesOn, deliveryStartsOn, deliveryEndsOn } = t;
          setDraft({ opensOn, closesOn, deliveryStartsOn, deliveryEndsOn });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  function update(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    const problem = validate(draft);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      await api.adminUpdateOrderTimeline(token, draft);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const complete = !validate(draft);

  return (
    <div className="stack">
      <h2 className="section-title">Order timeline</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        When ordering opens and closes for this month&rsquo;s run, and when it&rsquo;s delivered. Shown on the
        site&rsquo;s order flyer and in the order-confirmation email.
      </p>

      {loading ? (
        <p className="muted">Loading&hellip;</p>
      ) : (
        <form className="card stack" onSubmit={handleSave}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="opensOn">Ordering opens</label>
              <input id="opensOn" type="date" value={draft.opensOn} onChange={(e) => update('opensOn', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="closesOn">Ordering closes</label>
              <input id="closesOn" type="date" value={draft.closesOn} onChange={(e) => update('closesOn', e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="deliveryStartsOn">Delivery starts</label>
              <input
                id="deliveryStartsOn"
                type="date"
                value={draft.deliveryStartsOn}
                onChange={(e) => update('deliveryStartsOn', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="deliveryEndsOn">Delivery ends</label>
              <input
                id="deliveryEndsOn"
                type="date"
                value={draft.deliveryEndsOn}
                onChange={(e) => update('deliveryEndsOn', e.target.value)}
              />
            </div>
          </div>

          {complete && (
            <p className="muted" style={{ margin: 0 }}>
              Customers will see: ordering opens <strong>{formatTimelineDate(draft.opensOn)}</strong>, closes{' '}
              <strong>{formatTimelineDate(draft.closesOn)}</strong>; delivery <strong>{formatDeliveryRange(draft)}</strong>.
            </p>
          )}

          {error && <p className="form-error">{error}</p>}
          {saved && <p className="form-success">Order timeline saved.</p>}

          <div>
            <button className="btn btn--primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save timeline'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
