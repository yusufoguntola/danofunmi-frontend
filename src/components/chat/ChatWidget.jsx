import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { formatNaira } from '../../lib/format';
import { db } from '../../lib/db';
import { pushSupported, subscribeToPush, unsubscribeFromPush } from '../../lib/push';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import './ChatWidget.css';

const RECEIPT_UPLOADABLE_STATUSES = ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED'];
const AUTO_OPEN_KEY = 'dfm-chat-auto-opened';

/** Pulls out the plain text a message should render as, or '' if it's a
 * tool-only turn (tool_use / tool_result) that shouldn't show a bubble. */
function messageText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

function timeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export default function ChatWidget() {
  const { session } = useCustomerAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const [confirmMode, setConfirmMode] = useState('upload');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [receiptSubmitted, setReceiptSubmitted] = useState(false);

  const [senderName, setSenderName] = useState('');
  const [senderBank, setSenderBank] = useState('');
  const [detailsSubmitting, setDetailsSubmitting] = useState(false);
  const [detailsError, setDetailsError] = useState(null);

  const [orderNotifsOn, setOrderNotifsOn] = useState(false);
  const [menuNotifsOn, setMenuNotifsOn] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);

  const listRef = useRef(null);

  // IndexedDB (Dexie) is async, so hydrate on mount rather than in useState's
  // initializer — the write effect below is gated on `hydrated` so it can't
  // clobber stored history with the initial empty state.
  useEffect(() => {
    (async () => {
      const row = await db.chat.get('default');
      if (row) {
        setMessages(row.messages || []);
        setMeta(row.meta || null);
      }
      setHydrated(true);
    })();

    if (pushSupported()) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          const subscribed = !!sub && Notification.permission === 'granted';
          setOrderNotifsOn(subscribed);
          setMenuNotifsOn(subscribed);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    db.chat.put({ id: 'default', messages, meta });
  }, [messages, meta, hydrated]);

  // Greet first-time visitors by popping the chat open on its own, once —
  // returning visitors (an existing conversation, or a prior auto-open)
  // aren't interrupted.
  useEffect(() => {
    if (!hydrated || messages.length > 0 || localStorage.getItem(AUTO_OPEN_KEY)) return;
    const timer = setTimeout(() => {
      setOpen(true);
      localStorage.setItem(AUTO_OPEN_KEY, '1');
    }, 900);
    return () => clearTimeout(timer);
  }, [hydrated, messages.length]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open, sending]);

  async function toggleMenuNotifs() {
    setNotifBusy(true);
    try {
      if (menuNotifsOn) {
        await unsubscribeFromPush();
        setMenuNotifsOn(false);
        setOrderNotifsOn(false);
      } else {
        const ok = await subscribeToPush(meta?.customerPhone || null);
        setMenuNotifsOn(ok);
        if (ok && meta?.customerPhone) setOrderNotifsOn(true);
      }
    } finally {
      setNotifBusy(false);
    }
  }

  async function enableOrderNotifs() {
    if (!meta?.customerPhone) return;
    setNotifBusy(true);
    try {
      const ok = await subscribeToPush(meta.customerPhone);
      setOrderNotifsOn(ok);
      if (ok) setMenuNotifsOn(true);
    } finally {
      setNotifBusy(false);
    }
  }

  // Bridges the AI's in-progress cart into the same Dexie 'cart' draft
  // OrderPage reads/writes, so "continue on web" just means visiting /order.
  async function syncCartFromChat(cart) {
    const items = (cart.items || []).map((i) => ({
      optionId: i.menuItemOptionId || undefined,
      groupId: i.menuGroupId || undefined,
      itemName: i.itemName,
      icon: i.icon,
      size: i.size,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
    }));
    const existing = await db.cart.get('draft');
    if (items.length === 0 && !existing?.customerName && !existing?.customerPhone && !existing?.deliveryAddress) {
      await db.cart.delete('draft');
      return;
    }
    await db.cart.put({ id: 'draft', ...existing, items, updatedAt: new Date().toISOString() });
  }

  async function send(text) {
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setSending(true);
    setError(null);
    try {
      const res = await api.sendChatMessage(next, session?.token);
      setMessages(res.messages);
      if (res.meta) {
        setMeta(res.meta);
        setReceiptSubmitted(false);
        if (res.meta.orderId) {
          db.orderHistory.put({
            orderId: res.meta.orderId,
            narration: res.meta.narration,
            orderNumber: res.meta.orderNumber,
            createdAt: new Date().toISOString(),
          });
        }
        if (res.meta.cart) syncCartFromChat(res.meta.cart);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the assistant. Please try again.');
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    send(text);
  }

  function startNewConversation() {
    setMessages([]);
    setMeta(null);
    setError(null);
    setReceiptSubmitted(false);
    db.chat.delete('default');
  }

  async function handleUploadReceipt(e) {
    e.preventDefault();
    if (!file || !meta?.orderId) return;
    setUploading(true);
    setUploadError(null);
    try {
      await api.uploadReceipt(meta.orderId, file);
      setFile(null);
      setReceiptSubmitted(true);
      await send('[Uploaded my payment receipt]');
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Could not upload receipt. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmitDetails(e) {
    e.preventDefault();
    if (!senderName.trim() || !senderBank.trim() || !meta?.orderId) return;
    setDetailsSubmitting(true);
    setDetailsError(null);
    try {
      await api.submitPaymentDetails(meta.orderId, { senderName, senderBank });
      setSenderName('');
      setSenderBank('');
      setReceiptSubmitted(true);
      await send('[Submitted my payment details]');
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : 'Could not submit payment details. Please try again.');
    } finally {
      setDetailsSubmitting(false);
    }
  }

  const showReceiptUpload =
    meta?.orderId && !receiptSubmitted && RECEIPT_UPLOADABLE_STATUSES.includes(meta.status);

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-widget__panel card">
          <div className="chat-widget__header">
            <div>
              <strong>dánọ́fúnmi assistant</strong>
              <span className="muted chat-widget__subtitle">Order, track, or ask a question</span>
            </div>
            <div className="chat-widget__header-actions">
              {pushSupported() && (
                <button
                  type="button"
                  className="chat-widget__icon-btn"
                  title={menuNotifsOn ? 'Turn off menu update notifications' : 'Notify me about new menus'}
                  onClick={toggleMenuNotifs}
                  disabled={notifBusy}
                >
                  {menuNotifsOn ? '🔔' : '🔕'}
                </button>
              )}
              <button
                type="button"
                className="chat-widget__icon-btn"
                title="Start a new conversation"
                onClick={startNewConversation}
              >
                ↺
              </button>
              <button
                type="button"
                className="chat-widget__icon-btn"
                title="Close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
          </div>

          <div className="chat-widget__messages" ref={listRef}>
            {messages.length === 0 && (
              <>
                <div className="chat-bubble chat-bubble--assistant">
                  👋 Welcome to dánọ́fúnmi! I'm your ordering assistant.
                </div>
                <div className="chat-bubble chat-bubble--assistant">
                  Good {timeOfDay()}! What can I help you with today? Ask about this month's
                  menu, place an order, track one, or leave feedback. 🍲
                </div>
              </>
            )}
            {messages.map((m, i) => {
              const text = messageText(m.content);
              if (!text) return null;
              return (
                <div key={i} className={`chat-bubble chat-bubble--${m.role}`}>
                  {text}
                </div>
              );
            })}
            {sending && <div className="chat-bubble chat-bubble--assistant chat-bubble--typing">…</div>}

            {meta?.cart?.items?.length > 0 && (
              <Link to="/order" className="btn btn--small chat-widget__notify-btn">
                🛒 View cart ({meta.cart.items.reduce((n, i) => n + i.quantity, 0)}) — continue on web
              </Link>
            )}

            {showReceiptUpload && (
              <div className="chat-widget__receipt">
                <label>
                  Confirm payment for order #{meta.orderNumber} ({meta.narration})
                  {meta.total ? ` — ${formatNaira(meta.total)}` : ''}
                </label>
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
                    Provide payment details
                  </button>
                </div>

                {confirmMode === 'upload' ? (
                  <form onSubmit={handleUploadReceipt} className="stack">
                    <input
                      id="chat-receipt"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    {uploadError && <p className="form-error">{uploadError}</p>}
                    <button className="btn btn--primary btn--small" type="submit" disabled={uploading || !file}>
                      {uploading ? 'Uploading…' : 'Upload receipt'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSubmitDetails} className="stack">
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Sender name"
                    />
                    <input
                      type="text"
                      value={senderBank}
                      onChange={(e) => setSenderBank(e.target.value)}
                      placeholder="Sender bank"
                    />
                    {detailsError && <p className="form-error">{detailsError}</p>}
                    <button
                      className="btn btn--primary btn--small"
                      type="submit"
                      disabled={detailsSubmitting || !senderName.trim() || !senderBank.trim()}
                    >
                      {detailsSubmitting ? 'Submitting…' : 'Submit details'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {meta?.customerPhone && !orderNotifsOn && pushSupported() && (
              <button
                type="button"
                className="btn btn--small chat-widget__notify-btn"
                onClick={enableOrderNotifs}
                disabled={notifBusy}
              >
                🔔 Notify me when this order's status changes
              </button>
            )}

            {!session?.token && meta?.orderId && (
              <Link to="/signup" className="btn btn--small chat-widget__notify-btn">
                ✨ Create an account to track this order more easily
              </Link>
            )}

            {error && <p className="form-error">{error}</p>}
          </div>

          <form className="chat-widget__composer" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button type="submit" className="btn btn--primary btn--small" disabled={sending || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="chat-widget__launcher"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? '×' : '💬'}
      </button>
    </div>
  );
}
