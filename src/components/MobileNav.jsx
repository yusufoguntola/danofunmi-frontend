import { NavLink } from 'react-router-dom';
import './MobileNav.css';

const ITEMS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/menu', label: 'Menu', icon: '📋' },
  { to: '/order', label: 'Order', icon: '🛒' },
  { to: '/orders', label: 'My orders', icon: '🧾' },
];

export default function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Primary">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `mobile-nav__item${isActive ? ' is-active' : ''}`}
        >
          <span className="mobile-nav__icon" aria-hidden="true">{item.icon}</span>
          <span className="mobile-nav__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
