import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { api } from '../lib/api';
import { formatNaira, formatDate, formatStatus } from '../lib/format';
import SiteFooter from '../components/SiteFooter';
import LogoMark from '../components/LogoMark';
import './MyOrdersPage.css';

const OPEN_STATUSES = ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY'];

const TABS = [
  { key: 'open', label: 'Open', match: (o) => OPEN_STATUSES.includes(o.status) },
  { key: 'completed', label: 'Completed', match: (o) => o.status === 'DELIVERED' },
  { key: 'cancelled', label: 'Canceled', match: (o) => o.status === 'CANCELLED' },
  { key: 'all', label: 'All', match: () => true },
];

function TrackOrderBox() {
  const navigate = useNavigate();
  const [trackValue, setTrackValue] = useState('');
  const [trackError, setTrackError] = useState(null);

  function handleTrack(e) {
    e.preventDefault();
    const value = trackValue.trim();
    if (!value) {
      setTrackError('Enter an order narration (DFM-XXXXXX) or order number.');
      return;
    }
    navigate(`/order/${encodeURIComponent(value)}`);
  }

  return (
    <form className="card my-orders__track" onSubmit={handleTrack}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="track">Track an order</label>
        <div className="row">
          <input
            id="track"
            value={trackValue}
            onChange={(e) => setTrackValue(e.target.value)}
            placeholder="Narration (DFM-XXXXXX) or order number"
          />
          <button className="btn btn--primary btn--small" type="submit">Track</button>
        </div>
      </div>
      {trackError && <p className="form-error">{trackError}</p>}
    </form>
  );
}

function SignedOutPrompt() {
  return (
    <div className="card stack my-orders__cta">
      <h3 style={{ margin: 0 }}>Create an account to see your orders</h3>
      <p className="muted" style={{ margin: 0 }}>
        Sign up to keep every order in one place, track them more easily across visits, and
        manage them from any device — you can still place and track individual orders as a
        guest using the box above.
      </p>
      <div className="row">
        <Link to="/signup" className="btn btn--primary">Create account</Link>
        <Link to="/login" className="btn btn--ghost">Sign in</Link>
      </div>
    </div>
  );
}

function OrderList({ orders, loading }) {
  const [tab, setTab] = useState('open');
  const activeTab = TABS.find((t) => t.key === tab);
  const visibleOrders = orders.filter(activeTab.match);

  return (
    <>
      <div className="chips">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`chip ${tab === t.key ? 'chip--selected' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading&hellip;</p>
      ) : orders.length === 0 ? (
        <div className="card">
          <p className="muted">No orders yet — once you place one, it'll show up here.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Narration</th>
                <th>Status</th>
                <th>Total</th>
                <th>Placed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>{order.narration}</td>
                  <td><span className={`badge badge--${order.status.toLowerCase()}`}>{formatStatus(order.status)}</span></td>
                  <td>{formatNaira(order.total)}</td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td><Link className="btn btn--ghost btn--small" to={`/order/${order.id}`}>Track</Link></td>
                </tr>
              ))}
              {visibleOrders.length === 0 && (
                <tr><td colSpan={6} className="muted">Nothing in this tab yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function MyOrdersPage() {
  const { session, logout } = useCustomerAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getCustomerOrders(session.token)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [session?.token]);

  return (
    <div className="my-orders">
      <header className="my-orders__hero">
        <div className="wrap row--between">
          <Link className="my-orders__logo" to="/">
            <LogoMark size={28} />
            dánọ́fúnmi
          </Link>
          {session?.customer && (
            <div className="row">
              <span className="my-orders__hero-name">Hi, {session.customer.name.split(' ')[0]}</span>
              <button type="button" className="btn btn--small my-orders__signout" onClick={logout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="wrap my-orders__body stack">
        <div className="row--between">
          <h2 className="section-title" style={{ margin: 0 }}>My orders</h2>
          {session?.token && (
            <div className="row">
              <Link to="/order" className="btn btn--primary btn--small">Order now</Link>
              <Link to="/menu" className="btn btn--ghost btn--small">See menu</Link>
            </div>
          )}
        </div>

        <TrackOrderBox />

        {session?.token ? <OrderList orders={orders} loading={loading} /> : <SignedOutPrompt />}
      </main>

      <SiteFooter />
    </div>
  );
}
