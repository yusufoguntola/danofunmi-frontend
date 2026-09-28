import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatNaira, formatDate, formatStatus } from '../../lib/format';
import { confirmAction, confirmWithSelect, confirmWithInput } from '../../lib/confirm';
import { usePagination } from '../../lib/usePagination';
import Pagination from '../../components/admin/Pagination';
import Modal from '../../components/Modal';
import { whatsappLinkTo } from '../../lib/contact';
import './AdminOrders.css';

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
  const [locations, setLocations] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    api.getLocations().then(setLocations);
  }, []);

  const selected = orders.find((o) => o.id === selectedId);
  const { pageItems, page, setPage, pageSize, changePageSize, pageCount, total, start } = usePagination(orders);
  const feedbackUrl = selected ? `${window.location.origin}/feedback/${selected.id}` : '';

  async function handleCopyFeedbackLink() {
    try {
      await navigator.clipboard.writeText(feedbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (older browser, permission denied)
      // — the field is readonly and select-on-focus, so manual copy still
      // works as a fallback.
    }
  }

  async function updateStatus(orderId, status, riderContact) {
    setBusy(true);
    try {
      await api.adminUpdateOrderStatus(token, orderId, status, riderContact);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleAdvanceStatus(order, status) {
    // Out for delivery is the one transition worth capturing extra detail
    // for — who's actually carrying the order — so it gets its own dialog
    // with a text field instead of the plain yes/no confirm.
    if (status === 'OUT_FOR_DELIVERY') {
      const riderContact = await confirmWithInput({
        title: 'Mark as Out for delivery?',
        text: `Order ${order.narration} will move to "Out for delivery". You can note the rider's contact below (optional).`,
        placeholder: "Rider's name and/or phone",
        inputValue: order.riderContact || '',
        confirmButtonText: 'Mark as Out for delivery',
      });
      if (riderContact === undefined) return; // cancelled
      updateStatus(order.id, status, riderContact);
      return;
    }

    const ok = await confirmAction({
      title: `Mark as ${formatStatus(status)}?`,
      text: `Order ${order.narration} will move to "${formatStatus(status)}".`,
      confirmButtonText: `Mark as ${formatStatus(status)}`,
      icon: 'question',
    });
    if (ok) updateStatus(order.id, status);
  }

  // Jumps straight to Delivered from any state short of DELIVERED/CANCELLED
  // — separate from the step-by-step "Mark as {next}" button above, for
  // orders that were actually fulfilled outside the normal digital flow
  // (cash paid in person, a status that never got updated along the way,
  // etc.) and shouldn't have to be walked through every step to catch up.
  // No backend transition rules to skip — PATCH .../status already accepts
  // any valid status regardless of the order's current one.
  async function handleMarkDelivered(order) {
    const ok = await confirmAction({
      title: 'Mark as delivered?',
      text: `Order ${order.narration} is currently "${formatStatus(order.status)}" — this jumps straight to "Delivered", skipping any steps in between.`,
      confirmButtonText: 'Mark as delivered',
      icon: 'question',
    });
    if (ok) updateStatus(order.id, 'DELIVERED');
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

  // Fixes an order created with the wrong delivery location (e.g. a
  // first-taste order — see AdminInterest.jsx) — recalculates the delivery
  // fee/total from the new location. Blocked server-side once the order is
  // DELIVERED or CANCELLED, so the button is hidden then too.
  async function handleEditLocation(order) {
    const locationId = await confirmWithSelect({
      title: 'Change delivery location?',
      text: `This recalculates the delivery fee for order ${order.narration}.`,
      options: locations.map((l) => ({ value: l.id, label: `${l.name} (+${formatNaira(l.logisticsFee)})` })),
      defaultValue: order.locationId,
      confirmButtonText: 'Update location',
    });
    if (!locationId || locationId === order.locationId) return;

    setBusy(true);
    try {
      await api.adminUpdateOrderLocation(token, order.id, locationId);
      load();
    } finally {
      setBusy(false);
    }
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

      {/* On desktop the detail panel sits to the right and the table shrinks
          to make room; on narrow screens (see AdminOrders.css) it becomes a
          full-screen modal over the table instead. */}
      <div className="admin-orders__layout">
        <div className="admin-orders__table-col">
          {loading ? (
            <p>Loading orders&hellip;</p>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="table admin-orders__table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Order #</th>
                    <th>Narration</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Status updated</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((order, i) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className={selectedId === order.id ? 'is-selected' : undefined}
                    >
                      <td className="muted">{start + i + 1}</td>
                      <td>{order.orderNumber}</td>
                      <td>{order.narration}</td>
                      <td>{order.customer?.name}<br /><span className="muted">{order.customer?.phone}</span></td>
                      <td>{formatNaira(order.total)}</td>
                      <td><span className={`badge badge--${order.status.toLowerCase()}`}>{formatStatus(order.status)}</span></td>
                      <td className="muted">{formatDate(order.statusUpdatedAt)}</td>
                      <td className="muted">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                  {pageItems.length === 0 && (
                    <tr><td colSpan={8} className="muted">No orders here yet.</td></tr>
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

        {selected && (
          <div className="admin-orders__detail-backdrop" onClick={() => setSelectedId(null)}>
            <div className="admin-orders__detail card stack" onClick={(e) => e.stopPropagation()}>
              <div className="row--between">
                <h3 style={{ margin: 0 }}>#{selected.orderNumber} · {selected.narration}</h3>
                <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <span className={`badge badge--${selected.status.toLowerCase()}`}>{formatStatus(selected.status)}</span>
                  <button
                    type="button"
                    className="admin-orders__detail-close"
                    onClick={() => setSelectedId(null)}
                    aria-label="Close"
                  >
                    &times;
                  </button>
                </div>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                Status updated {formatDate(selected.statusUpdatedAt)}
              </p>

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
                {selected.deliveryAddress}
                {selected.landmark && <> &middot; near {selected.landmark}</>}<br />
                Delivery to {selected.location?.name} (+{formatNaira(selected.logisticsFee)})
                {!['DELIVERED', 'CANCELLED'].includes(selected.status) && (
                  <button
                    className="btn btn--ghost btn--small"
                    style={{ marginLeft: 8 }}
                    disabled={busy}
                    onClick={() => handleEditLocation(selected)}
                  >
                    Change
                  </button>
                )}
                {selected.riderContact && <><br />🏍️ Rider: <strong>{selected.riderContact}</strong></>}
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
                {!['DELIVERED', 'CANCELLED'].includes(selected.status) && NEXT_STATUS[selected.status] !== 'DELIVERED' && (
                  <button className="btn btn--ghost btn--small" disabled={busy} onClick={() => handleMarkDelivered(selected)}>
                    Mark as Delivered
                  </button>
                )}
                {!['DELIVERED', 'CANCELLED'].includes(selected.status) && (
                  <button className="btn btn--danger btn--small" disabled={busy} onClick={() => handleCancelOrder(selected)}>
                    Cancel order
                  </button>
                )}
                {selected.status === 'DELIVERED' && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => {
                      setCopied(false);
                      setShareOpen(true);
                    }}
                  >
                    Share feedback link
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {shareOpen && selected && (
        <Modal title="Share feedback link" onClose={() => setShareOpen(false)}>
          <div className="stack">
            <p className="muted" style={{ marginTop: 0 }}>
              Send this to {selected.customer?.name} so they can rate order {selected.narration}.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <input
                readOnly
                value={feedbackUrl}
                onFocus={(e) => e.target.select()}
                style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: '0.85rem' }}
              />
              <button type="button" className="btn btn--ghost btn--small" onClick={handleCopyFeedbackLink}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <a
              className="btn btn--primary"
              href={whatsappLinkTo(
                selected.customer?.phone,
                `Hi ${(selected.customer?.name || '').trim().split(/\s+/)[0] || 'there'}! Here's the link to share feedback on your dánọ́fúnmi order ${selected.narration}: ${feedbackUrl}`
              )}
              target="_blank"
              rel="noreferrer"
            >
              💬 Share via WhatsApp
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
