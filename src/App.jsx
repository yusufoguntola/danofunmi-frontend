import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import InstallPrompt from './components/InstallPrompt';
import MobileNav from './components/MobileNav';
import ChatWidget from './components/chat/ChatWidget';

import LandingPage from './pages/LandingPage';
import OrderPage from './pages/OrderPage';
import OrderStatusPage from './pages/OrderStatusPage';
import MyOrdersPage from './pages/MyOrdersPage';
import MenuPage from './pages/MenuPage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import ComingSoonPage from './pages/ComingSoonPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminOrders from './pages/admin/AdminOrders';
import AdminMenu from './pages/admin/AdminMenu';
import AdminMenuItemEdit from './pages/admin/AdminMenuItemEdit';
import AdminLocations from './pages/admin/AdminLocations';
import AdminCosts from './pages/admin/AdminCosts';
import AdminReports from './pages/admin/AdminReports';
import AdminFeedback from './pages/admin/AdminFeedback';
import AdminNotifications from './pages/admin/AdminNotifications';

// Gates the whole customer-facing site behind a "coming soon" page while
// leaving the back-office admin dashboard reachable, via VITE_COMING_SOON.
const COMING_SOON = import.meta.env.VITE_COMING_SOON === 'true';

// Customer-facing chrome (install banner, mobile nav, chat widget) — hidden
// on the back-office admin dashboard and while the coming-soon gate is up.
function CustomerChrome() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin') || COMING_SOON) return null;
  return (
    <>
      <InstallPrompt />
      <ChatWidget />
      <MobileNav />
    </>
  );
}

const adminRoutes = (
  <>
    <Route path="/admin/login" element={<AdminLogin />} />
    <Route
      path="/admin"
      element={
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<AdminOrders />} />
      <Route path="menu" element={<AdminMenu />} />
      <Route path="menu/:id" element={<AdminMenuItemEdit />} />
      <Route path="locations" element={<AdminLocations />} />
      <Route path="costs" element={<AdminCosts />} />
      <Route path="reports" element={<AdminReports />} />
      <Route path="feedback" element={<AdminFeedback />} />
      <Route path="notifications" element={<AdminNotifications />} />
    </Route>
  </>
);

export default function App() {
  return (
    <AdminAuthProvider>
      <CustomerAuthProvider>
        <BrowserRouter>
          <Routes>
            {COMING_SOON ? (
              <>
                {adminRoutes}
                <Route path="*" element={<ComingSoonPage />} />
              </>
            ) : (
              <>
                <Route path="/" element={<LandingPage />} />
                <Route path="/order" element={<OrderPage />} />
                <Route path="/order/:id" element={<OrderStatusPage />} />
                <Route path="/orders" element={<MyOrdersPage />} />
                <Route path="/menu" element={<MenuPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/login" element={<LoginPage />} />
                {adminRoutes}
              </>
            )}
          </Routes>
          <CustomerChrome />
        </BrowserRouter>
      </CustomerAuthProvider>
    </AdminAuthProvider>
  );
}
