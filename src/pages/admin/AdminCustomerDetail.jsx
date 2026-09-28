import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatDate, formatNaira, formatStatus } from '../../lib/format';

function Stars({ rating }) {
  return (
    <span aria-label={`${rating} out of 5`}>
      {'★'.repeat(rating)}
      <span className="muted">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

const TABS = [
  { key: 'orders', label: 'Orders' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'requests', label: 'Requests' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const { session } = useAdminAuth();
  const token = session.token;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('orders');

  useEffect(() => {
    setLoading(true);
    api
      .adminGetCustomer(token, id)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, id]);

  if (loading) return <p>Loading&hellip;</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!data) return null;

  const { customer, orders, feedback, requests, whatsappMessages } = data;
  const totalSpent = orders.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <div className="stack">
      <div>
        <Link to="/restricted-path/customers" className="muted" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>
          &larr; Back to customers
        </Link>
        <h2 className="section-title" style={{ margin: '4px 0 0' }}>{customer.name}</h2>
      </div>

      <div className="card">
        <div className="detail-grid">
          <div className="detail-field">
            <span className="detail-field__label">Phone</span>
            <span className="detail-field__value">{customer.phone || '—'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-field__label">Email</span>
            <span className="detail-field__value">{customer.email || '—'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-field__label">Address</span>
            <span className="detail-field__value">{customer.address || '—'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-field__label">Landmark</span>
            <span className="detail-field__value">{customer.landmark || '—'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-field__label">Joined</span>
            <span className="detail-field__value">{formatDate(customer.createdAt)}</span>
          </div>
          <div className="detail-field">
            <span className="detail-field__label">Orders &middot; lifetime spend</span>
            <span className="detail-field__value">{orders.length} &middot; {formatNaira(totalSpent)}</span>
          </div>
        </div>
      </div>

      <div className="chips">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`chip ${tab === t.key ? 'chip--selected' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Narration</th>
                <th>Total</th>
                <th>Status</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.orderNumber}</td>
                  <td>{o.narration}</td>
                  <td>{formatNaira(o.total)}</td>
                  <td><span className={`badge badge--${o.status.toLowerCase()}`}>{formatStatus(o.status)}</span></td>
                  <td className="muted">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={5} className="muted">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'feedback' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Rating</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {feedback.map((f) => (
                <tr key={f.id}>
                  <td className="muted">{formatDate(f.createdAt)}</td>
                  <td>{f.order?.narration}</td>
                  <td><Stars rating={f.rating} /></td>
                  <td>{f.comment || <span className="muted">—</span>}</td>
                </tr>
              ))}
              {feedback.length === 0 && (
                <tr><td colSpan={4} className="muted">No feedback left yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'requests' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Request</th>
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{formatDate(r.createdAt)}</td>
                  <td>{r.requestType}</td>
                  <td>{r.message}</td>
                  <td className="muted">{r.orderNarration || '—'}</td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr><td colSpan={4} className="muted">No chat requests logged.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'whatsapp' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Direction</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {whatsappMessages.map((m) => (
                <tr key={m.id}>
                  <td className="muted">{formatDate(m.createdAt)}</td>
                  <td className="muted">{m.direction}</td>
                  <td>{m.body || <span className="muted">(media)</span>}</td>
                </tr>
              ))}
              {whatsappMessages.length === 0 && (
                <tr><td colSpan={3} className="muted">No WhatsApp messages.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
