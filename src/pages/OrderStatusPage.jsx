import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { formatNaira, formatDate, formatStatus } from '../lib/format';
import { pushSupported, subscribeToPush } from '../lib/push';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import SiteFooter from '../components/SiteFooter';
import LogoMark from '../components/LogoMark';
import './OrderStatusPage.css';

const STEPS = ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function OrderStatusPage() {
  const { id } = useParams();
  const { session } = useCustomerAuth();
  const [order, setOrder] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [confirmMode, setConfirmMode] = useState('upload');

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [senderName, setSenderName] = useState('');
  const [senderBank, setSenderBank] = useState('');
  const [detailsSubmitting, setDetailsSubmitting] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [detailsSuccess, setDetailsSuccess] = useState(false);

  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getOrder(id);
      setOrder(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this order.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    api.getPaymentInfo().then(setPaymentInfo).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (order && pushSupported() && Notification.permission === 'default') {
      setShowNotifPrompt(true);
    }
  }, [order]);

  async function handleEnableNotifs() {
    setNotifBusy(true);
    try {
      await subscribeToPush(order.customer.phone);
    } finally {
      setNotifBusy(false);
      setShowNotifPrompt(false);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setUploadError('Choose a screenshot or photo of your payment receipt.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await api.uploadReceipt(order.id, file);
      setUploadSuccess(true);
      setFile(null);
      await load();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Could not upload receipt. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmitDetails(e) {
    e.preventDefault();
    if (!senderName.trim() || !senderBank.trim()) {
      setDetailsError('Enter the sender name and bank the transfer was made from.');
      return;
    }
    setDetailsSubmitting(true);
    setDetailsError(null);
    try {
      await api.submitPaymentDetails(order.id, { senderName, senderBank });
      setDetailsSuccess(true);
      setSenderName('');
      setSenderBank('');
      await load();
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : 'Could not submit payment details. Please try again.');
    } finally {
      setDetailsSubmitting(false);
    }
  }

  if (loading) return <div className="wrap order-status"><p>Loading your order&hellip;</p></div>;
  if (error) return <div className="wrap order-status"><p className="form-error">{error}</p></div>;
  if (!order) return null;

  const stepIndex = STEPS.indexOf(order.status);
  const isCancelled = order.status === 'CANCELLED';
  const canUploadReceipt = ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED'].includes(order.status);
  const latestReceipt = order.receipts?.[0];

  return (
    <div className="order-status">
      <header className="order-status__hero">
        <div className="wrap row--between">
          <Link className="order-status__logo" to="/">
            <LogoMark size={28} />
            dánọ́fúnmi
          </Link>
          <Link className="order-status__back" to="/orders">&larr; My orders</Link>
        </div>
      </header>

      <main className="wrap order-status__body">
        {showNotifPrompt && (
          <div className="card row--between" style={{ marginBottom: 16 }}>
            <span>🔔 Get notified here when your order's status changes.</span>
            <div className="row">
              <button className="btn btn--primary btn--small" type="button" onClick={handleEnableNotifs} disabled={notifBusy}>
                {notifBusy ? 'Enabling…' : 'Enable'}
              </button>
              <button className="btn btn--ghost btn--small" type="button" onClick={() => setShowNotifPrompt(false)}>
                Not now
              </button>
            </div>
          </div>
        )}

        <div className="card stack">
          <div className="row--between">
            <div>
              <p className="muted" style={{ margin: 0 }}>Order #{order.orderNumber}</p>
              <h2 style={{ margin: 0 }}>{order.narration}</h2>
            </div>
            <span className={`badge badge--${order.status.toLowerCase()}`}>{formatStatus(order.status)}</span>
          </div>

          {!isCancelled && (
            <ol className="status-track">
              {STEPS.map((step, i) => (
                <li key={step} className={i <= stepIndex ? 'status-track__step is-done' : 'status-track__step'}>
                  {formatStatus(step)}
                </li>
              ))}
            </ol>
          )}

          <div className="order-status__grid">
            <div>
              <h4>Items</h4>
              <ul className="cart-list">
                {order.items.map((item) => (
                  <li key={item.id} className="cart-list__item">
                    <div><strong>{item.itemName}</strong> <span className="muted">&middot; {item.size} &times; {item.quantity}</span></div>
                    <span />
                    <span className="cart-list__total">{formatNaira(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="summary-total">
                <div className="row--between"><span className="muted">Subtotal</span><span>{formatNaira(order.subtotal)}</span></div>
                <div className="row--between"><span className="muted">Logistics ({order.location?.name})</span><span>{formatNaira(order.logisticsFee)}</span></div>
                <div className="row--between summary-total__grand"><span>Total</span><strong>{formatNaira(order.total)}</strong></div>
              </div>
            </div>

            <div>
              <h4>Delivery</h4>
              <p className="muted" style={{ marginBottom: 4 }}>{order.customer?.name} &middot; {order.customer?.phone}</p>
              <p className="muted">{order.deliveryAddress}</p>
              {order.notes && <p className="muted"><em>Note: {order.notes}</em></p>}
              <p className="muted" style={{ fontSize: '0.82rem' }}>Placed {formatDate(order.createdAt)}</p>
            </div>
          </div>
        </div>

        {canUploadReceipt && paymentInfo && (
          <div className="card stack" style={{ marginTop: 24 }}>
            <h3>Pay &amp; confirm</h3>
            <p className="muted">
              Transfer <strong>{formatNaira(order.total)}</strong> to the account below, using the narration
              exactly as shown, then upload your receipt so we can confirm it.
            </p>
            <div className="payment-details">
              <div><span className="muted">Bank</span><strong>{paymentInfo.bankName}</strong></div>
              <div><span className="muted">Account name</span><strong>{paymentInfo.accountName}</strong></div>
              <div><span className="muted">Account number</span><strong>{paymentInfo.accountNumber}</strong></div>
              <div><span className="muted">Narration</span><strong>{order.narration}</strong></div>
            </div>

            {latestReceipt && (
              <p className={latestReceipt.status === 'REJECTED' ? 'form-error' : 'form-success'}>
                {latestReceipt.status === 'PENDING' && 'Receipt received — we’re confirming your payment.'}
                {latestReceipt.status === 'REJECTED' && 'That receipt couldn’t be verified. Please upload a clearer copy.'}
                {latestReceipt.status === 'CONFIRMED' && 'Payment confirmed!'}
              </p>
            )}

            {order.status !== 'PAYMENT_SUBMITTED' || latestReceipt?.status === 'REJECTED' ? (
              <div className="stack">
                <div className="chips">
                  <button
                    type="button"
                    className={`chip ${confirmMode === 'upload' ? 'chip--selected' : ''}`}
                    onClick={() => setConfirmMode('upload')}
                  >
                    Upload receipt
                  </button>
                  <button
                    type="button"
                    className={`chip ${confirmMode === 'details' ? 'chip--selected' : ''}`}
                    onClick={() => setConfirmMode('details')}
                  >
                    Or provide payment details
                  </button>
                </div>

                {confirmMode === 'upload' ? (
                  <form onSubmit={handleUpload} className="stack">
                    <div className="field">
                      <label htmlFor="receipt">Payment receipt (screenshot or photo)</label>
                      <input
                        id="receipt"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    {uploadError && <p className="form-error">{uploadError}</p>}
                    {uploadSuccess && <p className="form-success">Receipt uploaded — thank you!</p>}
                    <button className="btn btn--primary" type="submit" disabled={uploading}>
                      {uploading ? 'Uploading…' : 'Upload receipt'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSubmitDetails} className="stack">
                    <p className="muted" style={{ margin: 0 }}>
                      No screenshot handy? Tell us who the transfer was sent from and we'll match it up.
                    </p>
                    <div className="field">
                      <label htmlFor="senderName">Sender name</label>
                      <input
                        id="senderName"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="Name on the account you paid from"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="senderBank">Sender bank</label>
                      <input
                        id="senderBank"
                        value={senderBank}
                        onChange={(e) => setSenderBank(e.target.value)}
                        placeholder="e.g. GTBank"
                      />
                    </div>
                    {detailsError && <p className="form-error">{detailsError}</p>}
                    {detailsSuccess && <p className="form-success">Payment details submitted — thank you!</p>}
                    <button className="btn btn--primary" type="submit" disabled={detailsSubmitting}>
                      {detailsSubmitting ? 'Submitting…' : 'Submit payment details'}
                    </button>
                  </form>
                )}
              </div>
            ) : null}
          </div>
        )}

        {!session?.token && (
          <div className="card stack" style={{ marginTop: 24 }}>
            <h4 style={{ margin: 0 }}>Create an account</h4>
            <p className="muted" style={{ margin: 0 }}>
              Manage and track your orders more easily — see your full order history and get
              to this page faster next time.
            </p>
            <div className="row">
              <Link to="/signup" className="btn btn--primary">Create account</Link>
              <Link to="/login" className="btn btn--ghost">Sign in</Link>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
