import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';

export default function AdminInterest() {
  const { session } = useAdminAuth();
  const token = session.token;
  const { refreshUnreadInterest } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api.adminListInterest(token).then(setRows).finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  // Visiting this tab clears the "unread" badge — mark everything read once
  // loaded, then let the layout refresh its count.
  useEffect(() => {
    api.adminMarkAllInterestRead(token).then(() => {
      refreshUnreadInterest();
      setRows((prev) => prev.map((r) => (r.readAt ? r : { ...r, readAt: new Date().toISOString() })));
    });
  }, [token, refreshUnreadInterest]);

  async function toggleRead(row) {
    setBusyId(row.id);
    try {
      const updated = await api.adminMarkInterestRead(token, row.id, !row.readAt);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      refreshUnreadInterest();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stack">
      <h2 className="section-title">Interested</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        People who registered their interest on the coming-soon page and want to hear when ordering opens.
      </p>

      {loading ? (
        <p>Loading&hellip;</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Address</th>
                <th>What excites them</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ fontWeight: r.readAt ? 400 : 700 }}>
                  <td className="muted" style={{ fontWeight: 400 }}>{formatDate(r.createdAt)}</td>
                  <td>{r.name}</td>
                  <td className="muted" style={{ fontWeight: 400 }}>{r.email}</td>
                  <td className="muted" style={{ fontWeight: 400 }}>{r.phone}</td>
                  <td className="muted" style={{ fontWeight: 400 }}>{r.address}</td>
                  <td className="muted" style={{ fontWeight: 400 }}>{r.excites || '—'}</td>
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
              {rows.length === 0 && (
                <tr><td colSpan={7} className="muted">No one has registered interest yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
