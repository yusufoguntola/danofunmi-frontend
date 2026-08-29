import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatNaira, formatDate, formatStatus } from '../../lib/format';
import { confirmAction } from '../../lib/confirm';

const STATUS_FILTERS = [
  '',
  'PENDING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'CONFIRMED',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

const NEXT_STATUS = {
  PAYMENT_SUBMITTED: 'CONFIRMED',
  CONFIRMED: 'PACKED',
  PACKED: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
};

export default function AdminOrders() {
  const { session } = useAdminAuth();
  const token = session.token;
  const [statusFilter, setStatusFilter] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .adminListOrders(token, statusFilter || undefined)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [token, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = orders.find((o) => o.id === selectedId);

  async function updateStatus(orderId, status) {
    setBusy(true);
    try {
      await api.adminUpdateOrderStatus(token, orderId, status);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleAdvanceStatus(order, status) {
    const ok = await confirmAction({
      title: `Mark as ${formatStatus(status)}?`,
      text: `Order ${order.narration} will move to "${formatStatus(status)}".`,
      confirmButtonText: `Mark as ${formatStatus(status)}`,
      icon: 'question',
    });
    if (ok) updateStatus(order.id, status);
  }

  async function handleCancelOrder(order) {
    const ok = await confirmAction({
      title: 'Cancel this order?',
      text: `Order ${order.narration} will be marked as cancelled.`,
      confirmButtonText: 'Cancel order',
      danger: true,
    });
    if (ok) updateStatus(order.id, 'CANCELLED');
  }

  async function updateReceipt(orderId, receiptId, status) {
    setBusy(true);
    try {
      await api.adminUpdateReceiptStatus(token, orderId, receiptId, status);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmReceipt(order, receiptId) {
    const ok = await confirmAction({
      title: 'Confirm this payment?',
      text: `This marks order ${order.narration} as paid and moves it to "Confirmed".`,
      confirmButtonText: 'Confirm payment',
      icon: 'question',
    });
    if (ok) updateReceipt(order.id, receiptId, 'CONFIRMED');
  }

  async function handleRejectReceipt(order, receiptId) {
    const ok = await confirmAction({
      title: 'Reject this receipt?',
      text: `The customer will need to upload a new receipt for order ${order.narration}.`,
      confirmButtonText: 'Reject receipt',
      danger: true,
    });
    if (ok) updateReceipt(order.id, receiptId, 'REJECTED');
  }

  return (
    <div className="stack">
      <h2 className="section-title">Orders</h2>

      <div className="chips">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            className={`chip ${statusFilter === s ? 'chip--selected' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s ? formatStatus(s) : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading orders&hellip;</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Narration</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setSelectedId(order.id)}
                  style={{ cursor: 'pointer', background: selectedId === order.id ? 'var(--green-50)' : undefined }}
                >
                  <td>{order.orderNumber}</td>
                  <td>{order.narration}</td>
                  <td>{order.customer?.name}<br /><span className="muted">{order.customer?.phone}</span></td>
                  <td>{formatNaira(order.total)}</td>
                  <td><span className={`badge badge--${order.status.toLowerCase()}`}>{formatStatus(order.status)}</span></td>
                  <td>{formatDate(order.createdAt)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} className="muted">No orders here yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="card stack">
          <div className="row--between">
            <h3 style={{ margin: 0 }}>#{selected.orderNumber} · {selected.narration}</h3>
            <span className={`badge badge--${selected.status.toLowerCase()}`}>{formatStatus(selected.status)}</span>
          </div>

          <div className="order-builder__summary">
            <ul className="cart-list">
              {selected.items.map((item) => (
                <li key={item.id} className="cart-list__item">
                  <div><strong>{item.itemName}</strong> <span className="muted">&middot; {item.size} &times; {item.quantity}</span></div>
                  <span />
                  <span className="cart-list__total">{formatNaira(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="muted">
            {selected.customer?.name} &middot; {selected.customer?.phone}<br />
            {selected.deliveryAddress}<br />
            Delivery to {selected.location?.name} (+{formatNaira(selected.logisticsFee)})
            {selected.notes && <><br /><em>Note: {selected.notes}</em></>}
          </p>

          {selected.receipts?.length > 0 && (
            <div>
              <h4>Payment receipts</h4>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {selected.receipts.map((r) => (
                  <div key={r.id} className="receipt-card">
                    {r.imagePath ? (
                      <a href={`${api.BASE_URL}${r.imagePath}`} target="_blank" rel="noreferrer">
                        <img src={`${api.BASE_URL}${r.imagePath}`} alt="Payment receipt" />
                      </a>
                    ) : (
                      <div className="receipt-card__details">
                        <span className="muted">Sender</span>
                        <strong>{r.senderName}</strong>
                        <span className="muted">Bank</span>
                        <strong>{r.senderBank}</strong>
                      </div>
                    )}
                    <span className={`badge badge--${r.status.toLowerCase()}`}>{r.status}</span>
                    {r.status === 'PENDING' && (
                      <div className="row">
                        <button className="btn btn--primary btn--small" disabled={busy} onClick={() => handleConfirmReceipt(selected, r.id)}>Confirm</button>
                        <button className="btn btn--danger btn--small" disabled={busy} onClick={() => handleRejectReceipt(selected, r.id)}>Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="row" style={{ flexWrap: 'wrap' }}>
            {NEXT_STATUS[selected.status] && (
              <button
                className="btn btn--primary btn--small"
                disabled={busy}
                onClick={() => handleAdvanceStatus(selected, NEXT_STATUS[selected.status])}
              >
                Mark as {formatStatus(NEXT_STATUS[selected.status])}
              </button>
            )}
            {!['DELIVERED', 'CANCELLED'].includes(selected.status) && (
              <button className="btn btn--danger btn--small" disabled={busy} onClick={() => handleCancelOrder(selected)}>
                Cancel order
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
