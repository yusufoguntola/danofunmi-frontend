import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import SiteFooter from '../components/SiteFooter';
import LogoMark from '../components/LogoMark';
import './OrderStatusPage.css';

// Shown after either payment-confirmation path on OrderStatusPage —
// uploading a receipt image, or submitting sender name + bank details — a
// dedicated stop rather than an inline success message, so there's no
// leftover "submit"/"upload" button inviting a duplicate. Takes
// orderNumber/narration from router state (set by the redirect) and falls
// back to fetching the order if the page was reached directly (e.g. a
// refresh), so it never has to show blank.
export default function OrderConfirmationPage() {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(location.state || null);

  // The navigate() that lands here can happen from anywhere on the (often
  // long) OrderStatusPage — React Router doesn't reset scroll position on
  // its own, so without this the customer can land mid-page, or even on the
  // footer, instead of seeing the confirmation they were just sent to.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (order) return;
    api.getOrder(id).then((data) => setOrder({ orderNumber: data.orderNumber, narration: data.narration })).catch(() => {});
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
        <div className="card stack" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <span style={{ fontSize: '3rem' }} aria-hidden="true">✅</span>
          <h2 style={{ margin: 0 }}>Payment info received!</h2>
          <p className="muted" style={{ margin: 0 }}>
            {order ? (
              <>We've got your payment info for order <strong>#{order.orderNumber}</strong> ({order.narration}).</>
            ) : (
              "We've got your payment info."
            )}
            {' '}We'll confirm it and update your order status shortly.
          </p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <Link to={`/order/${id}`} className="btn btn--primary">Track this order</Link>
            <Link to="/" className="btn btn--ghost">Back home</Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
