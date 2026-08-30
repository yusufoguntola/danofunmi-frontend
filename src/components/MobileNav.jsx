import { NavLink } from 'react-router-dom';
import './MobileNav.css';

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

// A little cooking pot — home base, and a nod to "home-cooked, just for you".
function PotIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5 10h14l-1.2 7.5A2 2 0 0 1 15.83 19H8.17a2 2 0 0 1-1.97-1.5L5 10Z" />
      <path d="M4 10h16" />
      <circle cx="12" cy="6.3" r="1" />
      <path d="M3.5 9.3c0-1.4 1.5-2.1 1.5-3.5M20.5 9.3c0-1.4-1.5-2.1-1.5-3.5" />
    </svg>
  );
}

// A steaming bowl — this month's menu.
function BowlIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3.3 11h17.4a1 1 0 0 1 .98 1.2 8.5 8.5 0 0 1-17.36 0A1 1 0 0 1 3.3 11Z" />
      <path d="M8 11c0-2 1-3 1-4.5M12 11c0-2.4 1.3-3.4 1.3-5.4M16 11c0-2 1-3 1-4.5" />
    </svg>
  );
}

// A takeout bag — placing an order.
function BagIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 9h12l-1 11.2a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.8L6 9Z" />
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
      <path d="M8.5 12.7h7" />
    </svg>
  );
}

// A receipt — order history.
function ReceiptIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 3h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3V3Z" />
      <path d="M9 8h6M9 11.3h6M9 14.6h3.5" />
    </svg>
  );
}

const ITEMS = [
  { to: '/', label: 'Home', Icon: PotIcon, end: true },
  { to: '/menu', label: 'Menu', Icon: BowlIcon },
  { to: '/order', label: 'Order', Icon: BagIcon },
  { to: '/orders', label: 'My orders', Icon: ReceiptIcon },
];

export default function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Primary">
      {ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `mobile-nav__item${isActive ? ' is-active' : ''}`}
        >
          <span className="mobile-nav__icon">
            <Icon />
          </span>
          <span className="mobile-nav__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
