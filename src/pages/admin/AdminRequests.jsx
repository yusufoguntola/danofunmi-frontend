import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';

const TYPE_LABELS = {
  item_request: 'Item request',
  discount_request: 'Discount request',
  other: 'Other',
};

export default function AdminRequests() {
  const { session } = useAdminAuth();
  const token = session.token;
  const { refreshUnreadRequests } = useOutletContext();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api.adminListRequests(token).then(setRequests).finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  // Visiting this tab is what clears the "unread" badge — mark everything
  // read once loaded, then let the layout know so it can refresh the count.
  useEffect(() => {
    api.adminMarkAllRequestsRead(token).then(() => {
      refreshUnreadRequests();
      setRequests((prev) => prev.map((r) => (r.readAt ? r : { ...r, readAt: new Date().toISOString() })));
    });
  }, [token, refreshUnreadRequests]);

  async function toggleRead(request) {
    setBusyId(request.id);
    try {
      const updated = await api.adminMarkRequestRead(token, request.id, !request.readAt);
      setRequests((prev) => prev.map((r) => (r.id === request.id ? updated : r)));
      refreshUnreadRequests();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stack">
      <h2 className="section-title">Requests</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Items, custom quantities, or discounts customers asked for through the chat that couldn't be handled
        automatically.
      </p>

      {loading ? (
        <p>Loading&hellip;</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Request</th>
                <th>Customer</th>
                <th>Order</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} style={{ fontWeight: r.readAt ? 400 : 700 }}>
                  <td className="muted" style={{ fontWeight: 400 }}>{formatDate(r.createdAt)}</td>
                  <td>{TYPE_LABELS[r.requestType] || r.requestType}</td>
                  <td>{r.message}</td>
                  <td className="muted" style={{ fontWeight: 400 }}>
                    {r.customerName || r.customerPhone
                      ? [r.customerName, r.customerPhone].filter(Boolean).join(' · ')
                      : '—'}
                  </td>
                  <td className="muted" style={{ fontWeight: 400 }}>{r.orderNarration || '—'}</td>
                  <td>
                    <button
                      className="btn btn--ghost btn--small"
                      disabled={busyId === r.id}
                      onClick={() => toggleRead(r)}
                    >
                      {r.readAt ? 'Mark unread' : 'Mark read'}
                    </button>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr><td colSpan={6} className="muted">No requests logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
