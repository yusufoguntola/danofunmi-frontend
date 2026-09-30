import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { confirmAction, confirmDelete } from '../../lib/confirm';
import ExpandableRow from '../../components/admin/ExpandableRow';
import { usePagination } from '../../lib/usePagination';
import Pagination from '../../components/admin/Pagination';

// Unexpected errors caught while a customer was doing something (placing an
// order, chatting with the AI bot, or any other unhandled route error) —
// logged server-side regardless of whether an alert email also went out for
// it (see backend's ADMIN_EMAILS). This is the "go see what broke" list;
// the email is the "something broke right now" ping.
export default function AdminErrorLogs() {
  const { session } = useAdminAuth();
  const token = session.token;
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [clearing, setClearing] = useState(false);

  function load() {
    setLoading(true);
    api.adminListErrorLogs(token).then(setLogs).finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function deleteLog(log) {
    if (!(await confirmDelete('this error log'))) return;
    setBusyId(log.id);
    try {
      await api.adminDeleteErrorLog(token, log.id);
      setLogs((prev) => prev.filter((l) => l.id !== log.id));
    } finally {
      setBusyId(null);
    }
  }

  async function clearAll() {
    const ok = await confirmAction({
      title: 'Clear all error logs?',
      text: `This permanently deletes all ${logs.length} logged error${logs.length === 1 ? '' : 's'}.`,
      confirmButtonText: 'Clear all',
      danger: true,
    });
    if (!ok) return;
    setClearing(true);
    try {
      await api.adminClearErrorLogs(token);
      setLogs([]);
    } finally {
      setClearing(false);
    }
  }

  const { pageItems, page, setPage, pageSize, changePageSize, pageCount, total, start } = usePagination(logs);

  return (
    <div className="stack">
      <div className="row--between">
        <div>
          <h2 className="section-title">Error logs</h2>
          <p className="muted" style={{ marginTop: -8 }}>
            Unexpected errors from placing orders, chatting with the bot, or anything else on the site.
          </p>
        </div>
        {logs.length > 0 && (
          <button className="btn btn--danger btn--small" disabled={clearing} onClick={clearAll}>
            {clearing ? 'Clearing…' : 'Clear all'}
          </button>
        )}
      </div>

      {loading ? (
        <p>Loading&hellip;</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Source</th>
                <th>Message</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((log, i) => (
                <ExpandableRow
                  key={log.id}
                  colSpan={5}
                  summary={
                    <>
                      <td className="muted">{start + i + 1}</td>
                      <td className="muted">{formatDate(log.createdAt)}</td>
                      <td><span className="tag">{log.source}</span></td>
                      <td style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.message}
                      </td>
                    </>
                  }
                  detail={
                    <>
                      <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                        <span className="detail-field__label">Message</span>
                        <span className="detail-field__value">{log.message}</span>
                      </div>
                      {log.context && (
                        <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                          <span className="detail-field__label">Context</span>
                          <pre style={{ margin: 0, fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.stack && (
                        <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                          <span className="detail-field__label">Stack trace</span>
                          <pre style={{ margin: 0, fontSize: '0.74rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {log.stack}
                          </pre>
                        </div>
                      )}
                      <div className="detail-actions">
                        <button
                          className="btn btn--danger btn--small"
                          disabled={busyId === log.id}
                          onClick={() => deleteLog(log)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  }
                />
              ))}
              {pageItems.length === 0 && (
                <tr><td colSpan={5} className="muted">No errors logged — good sign.</td></tr>
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
