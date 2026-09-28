import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { confirmDelete } from '../../lib/confirm';
import ExpandableRow from '../../components/admin/ExpandableRow';
import { usePagination } from '../../lib/usePagination';
import Pagination from '../../components/admin/Pagination';

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
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.adminListFeedback(token).then(setFeedback).finally(() => setLoading(false));
  }, [token]);

  async function deleteFeedback(f) {
    if (!(await confirmDelete('this feedback'))) return;
    setBusyId(f.id);
    try {
      await api.adminDeleteFeedback(token, f.id);
      setFeedback((prev) => prev.filter((row) => row.id !== f.id));
    } finally {
      setBusyId(null);
    }
  }

  const { pageItems, page, setPage, pageSize, changePageSize, pageCount, total, start } = usePagination(feedback);

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
                <th>#</th>
                <th>Date</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Rating</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((f, i) => (
                <ExpandableRow
                  key={f.id}
                  colSpan={6}
                  summary={
                    <>
                      <td className="muted">{start + i + 1}</td>
                      <td className="muted">{formatDate(f.createdAt)}</td>
                      <td>{f.order?.narration}</td>
                      <td>{f.order?.customer?.name}</td>
                      <td><Stars rating={f.rating} /></td>
                    </>
                  }
                  detail={
                    <>
                      <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                        <span className="detail-field__label">Comment</span>
                        <span className="detail-field__value">{f.comment || <span className="muted">—</span>}</span>
                      </div>
                      <div className="detail-actions">
                        <button
                          className="btn btn--danger btn--small"
                          disabled={busyId === f.id}
                          onClick={() => deleteFeedback(f)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  }
                />
              ))}
              {pageItems.length === 0 && (
                <tr><td colSpan={6} className="muted">No feedback yet.</td></tr>
              )}
            </tbody>
          </table>
          <Pagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
          />
        </div>
      )}
    </div>
  );
}
