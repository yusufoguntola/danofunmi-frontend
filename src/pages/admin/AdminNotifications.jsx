import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';

const CHANNELS = [
  { key: 'in_app', label: 'In-App', active: true },
  { key: 'email', label: 'Email', active: true },
  { key: 'sms', label: 'SMS', active: false },
  { key: 'whatsapp', label: 'WhatsApp', active: false },
];

export default function AdminNotifications() {
  const { session } = useAdminAuth();
  const token = session.token;
  const [count, setCount] = useState(null);
  const [channels, setChannels] = useState(['in_app']);
  const [form, setForm] = useState({ title: '', body: '' });
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.adminListPushSubscriptions(token).then((subs) => setCount(subs.length));
  }, [token]);

  function toggleChannel(key) {
    setChannels((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!form.title || !form.body) {
      setError('Title and message are required.');
      return;
    }
    if (channels.length === 0) {
      setError('Select at least one channel to send through.');
      return;
    }
    setSending(true);
    try {
      const res = await api.adminSendBroadcast(token, { channels, ...form });
      const summary = [];
      if (res.results.in_app) {
        const n = res.results.in_app.sent;
        summary.push(`In-App: sent to ${n} device${n === 1 ? '' : 's'}.`);
      }
      if (res.results.email) {
        const { sent, failed } = res.results.email;
        summary.push(`Email: sent to ${sent}${failed.length ? ` (failed for ${failed.length})` : ''}.`);
      }
      setResult(summary.join(' '));
      setForm({ title: '', body: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="stack">
      <h2 className="section-title">Notifications</h2>
      <p className="muted">
        {count === null ? 'Loading subscriber count…' : `${count} device${count === 1 ? '' : 's'} subscribed to push notifications.`}
      </p>

      <form className="card stack" onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
        <h3>Send a broadcast</h3>
        <p className="muted">
          Goes to every customer on the channels you pick — use it for new-menu announcements or a monthly
          ordering reminder. Order status updates are sent automatically and don't need this.
        </p>

        <div className="field">
          <label>Channels</label>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
            {CHANNELS.map((c) => (
              <label
                key={c.key}
                className="row"
                style={{ gap: 6, opacity: c.active ? 1 : 0.5, cursor: c.active ? 'pointer' : 'not-allowed' }}
              >
                <input
                  type="checkbox"
                  checked={channels.includes(c.key)}
                  disabled={!c.active}
                  onChange={() => toggleChannel(c.key)}
                />
                {c.label}
                {!c.active && <span className="muted" style={{ fontSize: '0.78rem' }}>(coming soon)</span>}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. This month's menu is up!"
          />
        </div>
        <div className="field">
          <label htmlFor="body">Message</label>
          <textarea
            id="body"
            rows={3}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Ordering is open now through the 5th — tap to order."
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        {result && <p className="form-success">{result}</p>}
        <button className="btn btn--primary" type="submit" disabled={sending}>
          {sending ? 'Sending…' : 'Send broadcast'}
        </button>
      </form>
    </div>
  );
}
