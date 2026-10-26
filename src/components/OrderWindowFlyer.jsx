import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import LogoMark from './LogoMark';
import './OrderWindowFlyer.css';

// The current ordering window, updated by hand each month.
export const CAMPAIGN = {
  id: '2026-11',
  monthLabel: 'November',
  opens: '25th of October',
  closes: '13th of November',
  delivery: '16th – 18th of November',
  // Start of the window — an order placed from this device since then means
  // the visitor has already ordered this month, so the flyer stays away.
  opensAt: new Date(2026, 9, 25),
  // Hidden once ordering closes (end of the 13th, local time) — the
  // "order before it closes" message no longer applies.
  closesAt: new Date(2026, 10, 14),
};

// Holds the local date (YYYY-MM-DD) the flyer was last closed on, so closing
// it only hides it for the rest of that day — it comes back tomorrow.
const DISMISSED_KEY = 'order-flyer-dismissed-on';

// Local dev and staging (VITE_IS_STAGING, see StagingBanner.jsx) always show
// the flyer on load — ignoring today's dismissal, any order already placed,
// and the closing date — so it can be reviewed any time. Closing it still hides it for that view.
const ALWAYS_SHOW = import.meta.env.DEV || import.meta.env.VITE_IS_STAGING === 'true';

// Same treatment as the mockup/status-cards flyers: faint emoji scattered
// behind the copy, and a strip of menu photos.
const DOODLES = [
  { emoji: '🍲', top: '3%', left: '6%', size: '2.4rem', rotate: -14 },
  { emoji: '🌶️', top: '5%', left: '82%', size: '2.1rem', rotate: 12 },
  { emoji: '🥘', top: '38%', left: '88%', size: '2rem', rotate: -9 },
  { emoji: '🥬', top: '44%', left: '3%', size: '1.9rem', rotate: 9 },
  { emoji: '🧅', top: '90%', left: '8%', size: '1.8rem', rotate: -6 },
  { emoji: '🍃', top: '88%', left: '84%', size: '1.9rem', rotate: 9 },
];

const DISHES = [
  { src: '/buka-stew.jpg', label: 'Buka Stew' },
  { src: '/efo.png', label: 'Efo Riro' },
  { src: '/jollof-rice.png', label: 'Jollof Rice' },
  { src: '/fried-rice.jpg', label: 'Fried Rice' },
];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function wasDismissedToday() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === today();
  } catch {
    return false;
  }
}

async function hasOrderedThisMonth() {
  const since = CAMPAIGN.opensAt.toISOString();
  try {
    return (await db.orderHistory.filter((o) => o.createdAt >= since).count()) > 0;
  } catch {
    return false;
  }
}

/** Launches for every site visitor once a day, until they've placed an order
 * this month. Only the close button (or heading off to order) takes it down. */
export default function OrderWindowFlyer() {
  const [visible, setVisible] = useState(ALWAYS_SHOW);

  useEffect(() => {
    if (ALWAYS_SHOW || new Date() >= CAMPAIGN.closesAt || wasDismissedToday()) return;
    let cancelled = false;
    hasOrderedThisMonth().then((ordered) => {
      if (!cancelled && !ordered) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, today());
    } catch {
      // Storage blocked — still close it for this page view.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="order-flyer__backdrop">
      <div className="order-flyer" role="dialog" aria-modal="true" aria-labelledby="order-flyer-title">
        <div className="order-flyer__doodles" aria-hidden="true">
          {DOODLES.map((d) => (
            <span
              key={d.emoji}
              className="order-flyer__doodle"
              style={{ top: d.top, left: d.left, fontSize: d.size, transform: `rotate(${d.rotate}deg)` }}
            >
              {d.emoji}
            </span>
          ))}
        </div>

        <button type="button" className="order-flyer__close" onClick={dismiss} aria-label="Close">
          &times;
        </button>

        <div className="order-flyer__brand">
          <LogoMark size={56} className="order-flyer__mark" />
          <span className="order-flyer__logo">dánọ́fúnmi</span>
        </div>

        <span className="order-flyer__badge">
          <span className="order-flyer__badge-dot" />
          {CAMPAIGN.monthLabel} orders open
        </span>

        <h2 id="order-flyer-title" className="order-flyer__headline">
          Don&rsquo;t miss the pot.
          <br />
          <span>Order now.</span>
        </h2>
        <p className="order-flyer__sub">Submit your order before ordering closes.</p>

        <div className="order-flyer__menu" aria-hidden="true">
          {DISHES.map((dish) => (
            <div key={dish.label} className="order-flyer__tile">
              <img src={dish.src} alt="" />
              <span className="order-flyer__tile-label">{dish.label}</span>
            </div>
          ))}
        </div>

        <ul className="order-flyer__details">
          <li>
            <span className="order-flyer__detail-icon" aria-hidden="true">🗓️</span>
            <span>
              Ordering opens
              <strong>{CAMPAIGN.opens}</strong>
            </span>
          </li>
          <li>
            <span className="order-flyer__detail-icon" aria-hidden="true">⏰</span>
            <span>
              Ordering closes
              <strong>{CAMPAIGN.closes}</strong>
            </span>
          </li>
          <li>
            <span className="order-flyer__detail-icon" aria-hidden="true">🚚</span>
            <span>
              Delivery
              <strong>{CAMPAIGN.delivery}</strong>
            </span>
          </li>
        </ul>

        <Link to="/order" className="order-flyer__cta" onClick={dismiss}>
          Order now &rarr;
        </Link>
      </div>
    </div>
  );
}
