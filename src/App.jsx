import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import InstallPrompt from './components/InstallPrompt';
import ChatWidget from './components/chat/ChatWidget';

import LandingPage from './pages/LandingPage';
import OrderPage from './pages/OrderPage';
import OrderStatusPage from './pages/OrderStatusPage';
import MyOrdersPage from './pages/MyOrdersPage';
import MenuPage from './pages/MenuPage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
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

// Customer-facing chrome (install banner, chat widget) — hidden on the
// back-office admin dashboard.
function CustomerChrome() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin')) return null;
  return (
    <>
      <InstallPrompt />
      <ChatWidget />
    </>
  );
}

export default function App() {
  return (
    <AdminAuthProvider>
      <CustomerAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/order" element={<OrderPage />} />
            <Route path="/order/:id" element={<OrderStatusPage />} />
            <Route path="/orders" element={<MyOrdersPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/login" element={<LoginPage />} />

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
          </Routes>
          <CustomerChrome />
        </BrowserRouter>
      </CustomerAuthProvider>
    </AdminAuthProvider>
  );
}
