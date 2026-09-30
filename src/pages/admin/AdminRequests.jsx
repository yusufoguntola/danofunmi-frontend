import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { confirmDelete } from '../../lib/confirm';
import { whatsappLinkTo } from '../../lib/contact';
import ExpandableRow from '../../components/admin/ExpandableRow';
import { usePagination } from '../../lib/usePagination';
import Pagination from '../../components/admin/Pagination';
import CreateOrderFromRequestModal from './CreateOrderFromRequestModal';

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
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [orderModalRequest, setOrderModalRequest] = useState(null);

  function load() {
    setLoading(true);
    api.adminListRequests(token).then(setRequests).finally(() => setLoading(false));
  }

  useEffect(load, [token]);
  useEffect(() => {
    api.getLocations().then(setLocations);
  }, []);

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

  async function deleteRequest(request) {
    if (!(await confirmDelete('this request'))) return;
    setBusyId(request.id);
    try {
      await api.adminDeleteRequest(token, request.id);
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      refreshUnreadRequests();
    } finally {
      setBusyId(null);
    }
  }

  function handleOrderCreated(request, order) {
    setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, orderId: order.id, orderCreatedNarration: order.narration } : r)));
    setOrderModalRequest(null);
  }

  const { pageItems, page, setPage, pageSize, changePageSize, pageCount, total, start } = usePagination(requests);

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
                <th>#</th>
                <th>Date</th>
                <th>Type</th>
                <th>Customer</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r, i) => (
                <ExpandableRow
                  key={r.id}
                  colSpan={5}
                  rowStyle={{ fontWeight: r.readAt ? 400 : 700 }}
                  summary={
                    <>
                      <td className="muted" style={{ fontWeight: 400 }}>{start + i + 1}</td>
                      <td className="muted" style={{ fontWeight: 400 }}>{formatDate(r.createdAt)}</td>
                      <td>{TYPE_LABELS[r.requestType] || r.requestType}</td>
                      <td className="muted" style={{ fontWeight: 400 }}>
                        {r.customerName || r.customerPhone
                          ? [r.customerName, r.customerPhone].filter(Boolean).join(' · ')
                          : '—'}
                      </td>
                    </>
                  }
                  detail={
                    <>
                      <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                        <span className="detail-field__label">Request</span>
                        <span className="detail-field__value">{r.message}</span>
                      </div>
                      <div className="detail-field">
                        <span className="detail-field__label">About order</span>
                        <span className="detail-field__value">{r.orderNarration || '—'}</span>
                      </div>
                      <div className="detail-field">
                        <span className="detail-field__label">Order created from this request</span>
                        <span className="detail-field__value">
                          {r.orderId ? (r.orderCreatedNarration || r.orderId) : '—'}
                        </span>
                      </div>
                      <div className="detail-actions">
                        {r.customerPhone && (
                          <>
                            <a
                              className="btn btn--ghost btn--small"
                              href={whatsappLinkTo(
                                r.customerPhone,
                                `Hi ${r.customerName ? r.customerName.trim().split(/\s+/)[0] : 'there'}! This is dánọ́fúnmi, following up on your request: "${r.message}"`
                              )}
                              target="_blank"
                              rel="noreferrer"
                            >
                              💬 WhatsApp
                            </a>
                            <a className="btn btn--ghost btn--small" href={`tel:${r.customerPhone}`}>
                              📞 Call
                            </a>
                          </>
                        )}
                        {!r.orderId && (
                          <button
                            type="button"
                            className="btn btn--primary btn--small"
                            onClick={() => setOrderModalRequest(r)}
                          >
                            Create order
                          </button>
                        )}
                        <button
                          className="btn btn--ghost btn--small"
                          disabled={busyId === r.id}
                          onClick={() => toggleRead(r)}
                        >
                          {r.readAt ? 'Mark unread' : 'Mark read'}
                        </button>
                        <button
                          className="btn btn--danger btn--small"
                          disabled={busyId === r.id}
                          onClick={() => deleteRequest(r)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  }
                />
              ))}
              {pageItems.length === 0 && (
                <tr><td colSpan={5} className="muted">No requests logged yet.</td></tr>
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

      {orderModalRequest && (
        <CreateOrderFromRequestModal
          request={orderModalRequest}
          token={token}
          locations={locations}
          onClose={() => setOrderModalRequest(null)}
          onCreated={(order) => handleOrderCreated(orderModalRequest, order)}
        />
      )}
    </div>
  );
}
