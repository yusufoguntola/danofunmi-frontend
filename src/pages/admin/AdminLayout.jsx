import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminLayout() {
  const { session, logout } = useAdminAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/admin/login');
  }

  return (
    <div className="admin-layout">
      <header className="admin-layout__header">
        <div className="wrap row--between">
          <span className="admin-layout__logo">dánọ́fúnmi admin</span>
          <nav className="admin-layout__nav">
            <NavLink to="/admin" end>Orders</NavLink>
            <NavLink to="/admin/menu">Menu</NavLink>
            <NavLink to="/admin/locations">Locations</NavLink>
            <NavLink to="/admin/costs">Costs</NavLink>
            <NavLink to="/admin/reports">Reports</NavLink>
            <NavLink to="/admin/feedback">Feedback</NavLink>
            <NavLink to="/admin/notifications">Notifications</NavLink>
          </nav>
          <div className="row">
            <span className="muted" style={{ fontSize: '0.85rem' }}>{session?.admin?.name}</span>
            <button className="btn btn--ghost btn--small" onClick={handleLogout} type="button">Log out</button>
          </div>
        </div>
      </header>
      <main className="wrap admin-layout__body">
        <Outlet />
      </main>
    </div>
  );
}
