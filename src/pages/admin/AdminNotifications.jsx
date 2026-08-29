import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';

export default function AdminNotifications() {
  const { session } = useAdminAuth();
  const token = session.token;
  const [count, setCount] = useState(null);
  const [form, setForm] = useState({ title: '', body: '' });
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.adminListPushSubscriptions(token).then((subs) => setCount(subs.length));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!form.title || !form.body) {
      setError('Title and message are required.');
      return;
    }
    setSending(true);
    try {
      const res = await api.adminSendBroadcast(token, form);
      setResult(`Sent to ${res.sent} subscriber${res.sent === 1 ? '' : 's'}.`);
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
          Goes to every subscribed device — use it for new-menu announcements or a monthly
          ordering reminder. Order status updates are sent automatically and don't need this.
        </p>
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
