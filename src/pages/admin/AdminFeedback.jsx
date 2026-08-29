import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';

function Stars({ rating }) {
  return (
    <span aria-label={`${rating} out of 5`}>
      {'★'.repeat(rating)}
      <span className="muted">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

export default function AdminFeedback() {
  const { session } = useAdminAuth();
  const token = session.token;
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.adminListFeedback(token).then(setFeedback).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <h2 className="section-title">Feedback</h2>

      {loading ? (
        <p>Loading&hellip;</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Rating</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {feedback.map((f) => (
                <tr key={f.id}>
                  <td>{formatDate(f.createdAt)}</td>
                  <td>{f.order?.narration}</td>
                  <td>{f.order?.customer?.name}</td>
                  <td><Stars rating={f.rating} /></td>
                  <td>{f.comment || <span className="muted">—</span>}</td>
                </tr>
              ))}
              {feedback.length === 0 && (
                <tr><td colSpan={5} className="muted">No feedback yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
