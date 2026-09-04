import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { formatNaira } from '../lib/format';
import { db } from '../lib/db';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { getRecaptchaToken } from '../lib/recaptcha';
import SiteFooter from '../components/SiteFooter';
import GroupDetailsModal from '../components/GroupDetailsModal';
import MenuIcon from '../components/MenuIcon';
import LogoMark from '../components/LogoMark';
import './OrderPage.css';

export default function OrderPage() {
  const navigate = useNavigate();
  const { session } = useCustomerAuth();
  const [menu, setMenu] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    locationId: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [viewingGroup, setViewingGroup] = useState(null);

  const [draftRestored, setDraftRestored] = useState(false);
  // Captured once at mount — a draft or hand-typed value always wins over the
  // account, and a login happening later while this page is open shouldn't
  // retroactively overwrite whatever the customer has already typed.
  const initialCustomerRef = useRef(session?.customer);

  useEffect(() => {
    const initialCustomer = initialCustomerRef.current;
    Promise.all([api.getMenu(), api.getLocations(), db.cart.get('draft')])
      .then(([menuData, locationData, draft]) => {
        setMenu(menuData);
        setLocations(locationData);
        setForm((f) => ({
          ...f,
          locationId: draft?.locationId || locationData[0]?.id || '',
          customerName: draft?.customerName || f.customerName || initialCustomer?.name || '',
          customerPhone: draft?.customerPhone || f.customerPhone || initialCustomer?.phone || '',
          deliveryAddress: draft?.deliveryAddress || f.deliveryAddress,
          notes: draft?.notes || f.notes,
        }));
        if (draft?.items?.length) setCart(draft.items);
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => {
        setLoading(false);
        setDraftRestored(true);
      });
  }, []);

  // Debounce-save the in-progress cart/delivery details so a customer can
  // leave and pick up where they left off (see LandingPage's "Continue your
  // order" banner). Skipped until the initial draft load resolves, so we
  // never overwrite a stored draft with the pre-restore empty state.
  useEffect(() => {
    if (!draftRestored) return;
    const hasContent = cart.length > 0 || form.customerName || form.customerPhone || form.deliveryAddress || form.notes;
    const timer = setTimeout(() => {
      if (hasContent) {
        db.cart.put({ id: 'draft', items: cart, ...form, updatedAt: new Date().toISOString() });
      } else {
        db.cart.delete('draft');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [cart, form, draftRestored]);

  const categories = useMemo(() => [...new Set(menu.map((m) => m.category))], [menu]);

  function addItem(menuItem, option) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.optionId === option.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          optionId: option.id,
          itemName: menuItem.name,
          icon: menuItem.icon,
          size: option.size,
          unitPrice: Number(option.price),
          quantity: 1,
        },
      ];
    });
  }

  function addGroup(group) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.groupId === group.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          groupId: group.id,
          itemName: group.name,
          icon: group.icon,
          size: 'Combo',
          unitPrice: group.total,
          quantity: 1,
        },
      ];
    });
  }

  // A cart line is either an individual item (keyed by optionId) or a combo
  // bundle (keyed by groupId) — exactly one is set per line.
  function lineKey(line) {
    return line.optionId || line.groupId;
  }

  function setQty(key, quantity) {
    setCart((prev) =>
      quantity < 1
        ? prev.filter((l) => lineKey(l) !== key)
        : prev.map((l) => (lineKey(l) === key ? { ...l, quantity } : l))
    );
  }

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const selectedLocation = locations.find((l) => l.id === form.locationId);
  const logisticsFee = selectedLocation ? Number(selectedLocation.logisticsFee) : 0;
  const total = subtotal + logisticsFee;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);

    if (cart.length === 0) {
      setSubmitError('Add at least one item to your order.');
      return;
    }
    if (!form.customerName || !form.customerPhone || !form.deliveryAddress || !form.locationId) {
      setSubmitError('Please fill in your name, phone, address, and delivery location.');
      return;
    }

    setSubmitting(true);
    try {
      const recaptchaToken = await getRecaptchaToken('create_order').catch(() => null);
      const data = await api.createOrder(
        {
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          deliveryAddress: form.deliveryAddress,
          locationId: form.locationId,
          notes: form.notes.trim() || undefined,
          items: cart.map((l) =>
            l.groupId
              ? { menuGroupId: l.groupId, quantity: l.quantity }
              : { menuItemOptionId: l.optionId, quantity: l.quantity }
          ),
          recaptchaToken,
        },
        session?.token
      );
      await db.cart.delete('draft');
      await db.orderHistory.put({
        orderId: data.order.id,
        narration: data.order.narration,
        orderNumber: data.order.orderNumber,
        createdAt: new Date().toISOString(),
      });
      navigate(`/order/${data.order.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="order-page">
      <header className="order-page__hero">
        <div className="order-page__doodles" aria-hidden="true">
          <span className="doodle" style={{ top: '10%', left: '6%', fontSize: '2.6rem', transform: 'rotate(-12deg)' }}>🍲</span>
          <span className="doodle" style={{ top: '18%', left: '92%', fontSize: '2.3rem', transform: 'rotate(10deg)' }}>🍛</span>
          <span className="doodle" style={{ top: '70%', left: '3%', fontSize: '2rem', transform: 'rotate(8deg)' }}>🥬</span>
          <span className="doodle" style={{ top: '75%', left: '95%', fontSize: '2.2rem', transform: 'rotate(-9deg)' }}>🍚</span>
        </div>
        <div className="wrap order-page__nav">
          {session?.token ? (
            <Link to="/orders" className="order-page__back">&larr; My orders</Link>
          ) : (
            <Link to="/" className="order-page__back">&larr; Back Home</Link>
          )}
        </div>
        <div className="wrap order-page__intro">
          <span className="order-page__eyebrow">Monthly stock-up &middot; home-cooked in bulk</span>
          <h1 className="order-page__logo">
            <LogoMark size={44} />
            dánọ́fúnmi
          </h1>
          <p className="order-page__tagline">You choose, we cook.</p>
        </div>
      </header>

      <main className="wrap order-page__body">
        {loading && <p>Loading this month's menu&hellip;</p>}
        {loadError && <p className="form-error">{loadError}</p>}

        {!loading && !loadError && (
          <form className="order-builder" onSubmit={handleSubmit}>
            <div className="order-builder__menu">
              <h2 className="section-title">This month's menu</h2>
              <p className="muted">Pick any combination — tap a size to add it to your order.</p>

              {categories.map((category) => (
                <section key={category} className="menu-category">
                  <h3>{category}</h3>
                  {menu
                    .filter((m) => m.category === category)
                    .map((entry) =>
                      entry.type === 'group' ? (
                        <div className="menu-item-card menu-item-card--group" key={entry.id}>
                          <MenuIcon icon={entry.icon} className="menu-item-card__icon" imgClassName="menu-item-card__icon-img" />
                          <div className="menu-item-card__body">
                            <h4>{entry.name}</h4>
                            {entry.description && <p>{entry.description}</p>}
                            <div className="menu-item-card__options">
                              <button type="button" className="pill" onClick={() => addGroup(entry)}>
                                Add combo &middot; {formatNaira(entry.total)}
                              </button>
                              <button
                                type="button"
                                className="link-btn"
                                onClick={() => setViewingGroup(entry)}
                              >
                                View details
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="menu-item-card" key={entry.id}>
                          <MenuIcon icon={entry.icon} className="menu-item-card__icon" imgClassName="menu-item-card__icon-img" />
                          <div className="menu-item-card__body">
                            <h4>{entry.name}</h4>
                            {entry.description && <p>{entry.description}</p>}
                            <div className="menu-item-card__options">
                              {entry.options.map((option) => (
                                <button
                                  type="button"
                                  key={option.id}
                                  className="pill"
                                  onClick={() => addItem(entry, option)}
                                >
                                  {option.size} &middot; {formatNaira(option.price)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                </section>
              ))}
            </div>

            <div className="order-builder__summary">
              <div className="card stack">
                <h3>Your order</h3>

                {cart.length === 0 && <p className="muted">No items yet — add something from the menu.</p>}

                {cart.length > 0 && (
                  <ul className="cart-list">
                    {cart.map((line) => (
                      <li key={lineKey(line)} className="cart-list__item">
                        <div>
                          <strong>
                            <MenuIcon icon={line.icon} className="cart-list__icon" imgClassName="cart-list__icon-img" />{' '}
                            {line.itemName}
                          </strong>
                          <span className="muted"> &middot; {line.size}</span>
                        </div>
                        <div className="cart-list__qty">
                          <button type="button" onClick={() => setQty(lineKey(line), line.quantity - 1)}>
                            &minus;
                          </button>
                          <span>{line.quantity}</span>
                          <button type="button" onClick={() => setQty(lineKey(line), line.quantity + 1)}>
                            +
                          </button>
                        </div>
                        <span className="cart-list__total">{formatNaira(line.unitPrice * line.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="field">
                  <label htmlFor="locationId">Delivery location</label>
                  <select
                    id="locationId"
                    value={form.locationId}
                    onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} (+{formatNaira(loc.logisticsFee)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="summary-total">
                  <div className="row--between"><span className="muted">Subtotal</span><span>{formatNaira(subtotal)}</span></div>
                  <div className="row--between"><span className="muted">Logistics</span><span>{formatNaira(logisticsFee)}</span></div>
                  <div className="row--between summary-total__grand"><span>Total</span><strong>{formatNaira(total)}</strong></div>
                </div>

                <h3>Delivery details</h3>
                <div className="field">
                  <label htmlFor="customerName">Full name</label>
                  <input
                    id="customerName"
                    value={form.customerName}
                    onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                    placeholder="Your name"
                  />
                </div>
                <div className="field">
                  <label htmlFor="customerPhone">Phone number</label>
                  <input
                    id="customerPhone"
                    value={form.customerPhone}
                    onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                    placeholder="e.g. 0801 234 5678"
                  />
                </div>
                <div className="field">
                  <label htmlFor="deliveryAddress">Delivery address</label>
                  <textarea
                    id="deliveryAddress"
                    rows={3}
                    value={form.deliveryAddress}
                    onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))}
                    placeholder="Street, area, landmark"
                  />
                </div>
                <div className="field">
                  <label htmlFor="notes">Delivery note <span className="muted">(optional)</span></label>
                  <textarea
                    id="notes"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. gate code, call on arrival, leave with security"
                  />
                </div>

                {submitError && <p className="form-error">{submitError}</p>}

                <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
                  {submitting ? 'Placing order…' : 'Continue to payment'}
                </button>
              </div>
            </div>
          </form>
        )}
      </main>

      <SiteFooter />

      {viewingGroup && (
        <GroupDetailsModal
          group={viewingGroup}
          onClose={() => setViewingGroup(null)}
          footer={
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                addGroup(viewingGroup);
                setViewingGroup(null);
              }}
            >
              Add to order
            </button>
          }
        />
      )}
    </div>
  );
}
