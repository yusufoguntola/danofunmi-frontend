import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import AdminMobileNav from './AdminMobileNav';
import LogoMark from '../../components/LogoMark';

// How often the "unread requests" badge refreshes on its own — a visit to
// /restricted-path/requests (which marks everything read) also triggers an
// immediate refresh via the refreshUnreadRequests() passed down through
// Outlet context.
const UNREAD_POLL_MS = 30000;

export default function AdminLayout() {
  const { session, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [unreadRequests, setUnreadRequests] = useState(0);
  const [unreadInterest, setUnreadInterest] = useState(0);

  const refreshUnreadRequests = useCallback(() => {
    api.adminRequestsUnreadCount(session.token).then((d) => setUnreadRequests(d.count)).catch(() => {});
  }, [session.token]);

  const refreshUnreadInterest = useCallback(() => {
    api.adminInterestUnreadCount(session.token).then((d) => setUnreadInterest(d.count)).catch(() => {});
  }, [session.token]);

  useEffect(() => {
    refreshUnreadRequests();
    refreshUnreadInterest();
    const timer = setInterval(() => {
      refreshUnreadRequests();
      refreshUnreadInterest();
    }, UNREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [refreshUnreadRequests, refreshUnreadInterest]);

  function handleLogout() {
    logout();
    navigate('/restricted-path/login');
  }

  return (
    <div className="admin-layout">
      <header className="admin-layout__header">
        <div className="wrap row--between">
          <span className="admin-layout__logo">
            <LogoMark size={22} />
            dánọ́fúnmi admin
          </span>
          <nav className="admin-layout__nav">
            <NavLink to="/restricted-path" end>Orders</NavLink>
            <NavLink to="/restricted-path/menu">Menu</NavLink>
            <NavLink to="/restricted-path/customers">Customers</NavLink>
            <NavLink to="/restricted-path/locations">Locations</NavLink>
            <NavLink to="/restricted-path/costs">Costs</NavLink>
            <NavLink to="/restricted-path/reports">Reports</NavLink>
            <NavLink to="/restricted-path/feedback">Feedback</NavLink>
            <NavLink to="/restricted-path/requests">
              Requests
              {unreadRequests > 0 && <span className="admin-layout__nav-badge">{unreadRequests}</span>}
            </NavLink>
            <NavLink to="/restricted-path/interest">
              Interested
              {unreadInterest > 0 && <span className="admin-layout__nav-badge">{unreadInterest}</span>}
            </NavLink>
            <NavLink to="/restricted-path/notifications">Notifications</NavLink>
          </nav>
          <div className="row">
            <span className="muted" style={{ fontSize: '0.85rem' }}>{session?.admin?.name}</span>
            <button className="btn btn--ghost btn--small" onClick={handleLogout} type="button">Log out</button>
          </div>
        </div>
      </header>
      <main className="wrap admin-layout__body">
        <Outlet context={{ refreshUnreadRequests, refreshUnreadInterest }} />
      </main>
      <AdminMobileNav unreadRequests={unreadRequests} unreadInterest={unreadInterest} />
    </div>
  );
}
