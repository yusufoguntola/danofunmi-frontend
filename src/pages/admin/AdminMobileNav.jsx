import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import './AdminMobileNav.css';

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

function OrdersIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 3h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3V3Z" />
      <path d="M9 8h6M9 11.3h6M9 14.6h3.5" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3.3 11h17.4a1 1 0 0 1 .98 1.2 8.5 8.5 0 0 1-17.36 0A1 1 0 0 1 3.3 11Z" />
      <path d="M8 11c0-2 1-3 1-4.5M12 11c0-2.4 1.3-3.4 1.3-5.4M16 11c0-2 1-3 1-4.5" />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 9.3a2.6 2.6 0 0 0-2.3-1.3c-1.5 0-2.6 1-2.6 2.2 0 3 4.9 1.5 4.9 4.2 0 1.2-1.1 2.2-2.6 2.2a2.6 2.6 0 0 1-2.3-1.3M12 6.7v1.3M12 16v1.3" />
    </svg>
  );
}

function SetupIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 21s-6.5-5.2-6.5-10.5A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.5C18.5 15.8 12 21 12 21Z" />
      <circle cx="12" cy="10.3" r="2.3" />
    </svg>
  );
}

function FeedbackIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 5h16v11H9l-4 3.5V16H4Z" />
      <path d="M8 9.3h8M8 12.2h5" />
    </svg>
  );
}

const CHEVRON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
    <path d="M6 15l6-6 6 6" />
  </svg>
);

// Admin has more sections than fit comfortably in a bottom tab bar, so
// related ones are grounded together into a single tab whose sub-items
// appear in a small sheet on tap, mirroring the customer MobileNav pattern.
const GROUPS = [
  { key: 'orders', label: 'Orders', Icon: OrdersIcon, items: [{ to: '/admin', label: 'Orders', end: true }] },
  { key: 'menu', label: 'Menu', Icon: MenuIcon, items: [{ to: '/admin/menu', label: 'Menu' }] },
  {
    key: 'money',
    label: 'Money',
    Icon: MoneyIcon,
    items: [
      { to: '/admin/costs', label: 'Costs' },
      { to: '/admin/reports', label: 'Reports' },
    ],
  },
  {
    key: 'setup',
    label: 'Setup',
    Icon: SetupIcon,
    items: [
      { to: '/admin/locations', label: 'Locations' },
      { to: '/admin/notifications', label: 'Notifications' },
    ],
  },
  { key: 'feedback', label: 'Feedback', Icon: FeedbackIcon, items: [{ to: '/admin/feedback', label: 'Feedback' }] },
];

export default function AdminMobileNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [openGroup, setOpenGroup] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => setOpenGroup(null), [pathname]);

  useEffect(() => {
    if (!openGroup) return;
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpenGroup(null);
    }
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [openGroup]);

  function isGroupActive(group) {
    return group.items.some((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));
  }

  function handleTap(group) {
    if (group.items.length === 1) {
      navigate(group.items[0].to);
      return;
    }
    setOpenGroup((cur) => (cur === group.key ? null : group.key));
  }

  return (
    <nav className="admin-mobile-nav" aria-label="Admin sections" ref={containerRef}>
      {openGroup && (
        <div className="admin-mobile-nav__sheet" role="menu">
          {GROUPS.find((g) => g.key === openGroup).items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              role="menuitem"
              className={({ isActive }) => `admin-mobile-nav__sheet-item${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
      {GROUPS.map((group) => {
        const active = isGroupActive(group);
        const isOpen = openGroup === group.key;
        return (
          <button
            key={group.key}
            type="button"
            className={`admin-mobile-nav__item${active ? ' is-active' : ''}${isOpen ? ' is-open' : ''}`}
            onClick={() => handleTap(group)}
          >
            <span className="admin-mobile-nav__icon">
              <group.Icon />
            </span>
            <span className="admin-mobile-nav__label">
              {group.label}
              {group.items.length > 1 && <span className="admin-mobile-nav__chevron">{CHEVRON}</span>}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
