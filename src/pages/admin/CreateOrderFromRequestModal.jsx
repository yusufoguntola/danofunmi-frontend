import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { formatNaira } from '../../lib/format';
import Modal from '../../components/Modal';
import './CreateOrderFromRequestModal.css';

function emptyItem() {
  return { itemName: '', size: '', quantity: 1, unitPrice: '' };
}

/** Turns a logged ExtraneousRequest into a real order, after the admin has
 * followed up with the customer by phone/WhatsApp — see AdminRequests.jsx.
 * Opens with an AI best-effort guess at the line items (from the request's
 * free-text message), which the admin reviews/edits before saving; the
 * total defaults to subtotal + the selected location's fee but can be
 * overridden with whatever was actually quoted. */
export default function CreateOrderFromRequestModal({ request, token, locations, onClose, onCreated }) {
  const [customerName, setCustomerName] = useState(request.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(request.customerPhone || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [locationId, setLocationId] = useState(locations[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [suggesting, setSuggesting] = useState(true);
  const [suggestError, setSuggestError] = useState(null);

  const [total, setTotal] = useState('');
  const [totalTouched, setTotalTouched] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .adminSuggestRequestItems(token, request.id)
      .then(({ items: suggested }) => {
        if (suggested?.length) setItems(suggested.map((i) => ({ ...i, unitPrice: i.unitPrice || '' })));
      })
      .catch((err) => setSuggestError(err instanceof ApiError ? err.message : 'Could not get item suggestions.'))
      .finally(() => setSuggesting(false));
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedLocation = locations.find((l) => l.id === locationId);
  const logisticsFee = selectedLocation ? Number(selectedLocation.logisticsFee) : 0;
  const subtotal = items.reduce((sum, i) => sum + (Number(i.unitPrice) || 0) * (Number(i.quantity) || 0), 0);
  const suggestedTotal = subtotal + logisticsFee;

  // The total defaults to subtotal + logistics fee, staying in sync as items/
  // location change — but only until the admin actually types their own
  // figure (the real quote may not match a simple sum), after which it's
  // left alone.
  useEffect(() => {
    if (!totalTouched) setTotal(suggestedTotal ? String(suggestedTotal) : '');
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedTotal, totalTouched]);

  function updateItem(index, patch) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const cleanItems = items
      .map((i) => ({ ...i, itemName: i.itemName.trim(), size: i.size.trim() || 'Standard' }))
      .filter((i) => i.itemName);
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim() || !locationId) {
      setError('Customer name, phone, delivery address, and location are all required.');
      return;
    }
    if (cleanItems.length === 0) {
      setError('Add at least one item.');
      return;
    }

    setSaving(true);
    try {
      const order = await api.adminCreateOrderFromRequest(token, request.id, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        landmark: landmark.trim() || undefined,
        locationId,
        items: cleanItems,
        total: total === '' ? undefined : Number(total),
        notes: notes.trim() || undefined,
      });
      onCreated(order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the order.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Create order from request" onClose={onClose} panelClassName="create-order-modal__panel">
      <form className="stack" onSubmit={handleSubmit}>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          After confirming details with the customer directly (call/WhatsApp), fill in their order below.
        </p>

        <div className="field-row">
          <div className="field">
            <label htmlFor="coCustomerName">Customer name</label>
            <input id="coCustomerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="coCustomerPhone">Phone</label>
            <input id="coCustomerPhone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />
          </div>
        </div>

        <div className="field">
          <label htmlFor="coAddress">Delivery address</label>
          <textarea id="coAddress" rows={2} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} required />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="coLandmark">Nearest landmark <span className="muted">(optional)</span></label>
            <input id="coLandmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="coLocation">Delivery location</label>
            <select id="coLocation" value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} (+{formatNaira(l.logisticsFee)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>
            Items
            {suggesting && <span className="muted"> &middot; asking the assistant for a guess&hellip;</span>}
          </label>
          {suggestError && <p className="form-error" style={{ margin: '0 0 8px' }}>{suggestError} You can still add items manually.</p>}

          <div className="create-order-modal__items">
            {items.map((item, i) => (
              <div key={i} className="create-order-modal__item-row">
                <input
                  placeholder="Item name"
                  value={item.itemName}
                  onChange={(e) => updateItem(i, { itemName: e.target.value })}
                  className="create-order-modal__item-name"
                />
                <input
                  placeholder="Size"
                  value={item.size}
                  onChange={(e) => updateItem(i, { size: e.target.value })}
                  className="create-order-modal__item-size"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, { quantity: e.target.value })}
                  className="create-order-modal__item-qty"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="₦ price"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
                  className="create-order-modal__item-price"
                />
                <button type="button" className="create-order-modal__item-remove" onClick={() => removeItem(i)} aria-label="Remove item">
                  &times;
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
            + Add item
          </button>
        </div>

        <div className="field">
          <label htmlFor="coNotes">Delivery note <span className="muted">(optional)</span></label>
          <input id="coNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="summary-total">
          <div className="row--between"><span className="muted">Items subtotal</span><span>{formatNaira(subtotal)}</span></div>
          <div className="row--between"><span className="muted">Logistics ({selectedLocation?.name || '—'})</span><span>{formatNaira(logisticsFee)}</span></div>
        </div>
        <div className="field">
          <label htmlFor="coTotal">Total <span className="muted">(what was actually quoted — editable)</span></label>
          <input
            id="coTotal"
            type="number"
            min="0"
            value={total}
            onChange={(e) => {
              setTotalTouched(true);
              setTotal(e.target.value);
            }}
            required
          />
        </div>

        {error && <p className="form-error">{error}</p>}
        <button className="btn btn--primary" type="submit" disabled={saving}>
          {saving ? 'Creating order…' : 'Create order'}
        </button>
      </form>
    </Modal>
  );
}
