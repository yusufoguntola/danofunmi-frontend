import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import SessionWatcher from './components/SessionWatcher';
import StagingBanner from './components/StagingBanner';
import InstallPrompt from './components/InstallPrompt';
import MobileNav from './components/MobileNav';
import ChatWidget from './components/chat/ChatWidget';

import LandingPage from './pages/LandingPage';
import OrderPage from './pages/OrderPage';
import OrderStatusPage from './pages/OrderStatusPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import FeedbackPage from './pages/FeedbackPage';
import GeneralFeedbackPage from './pages/GeneralFeedbackPage';
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
import AdminMenuGroups from './pages/admin/AdminMenuGroups';
import AdminMenuGroupEdit from './pages/admin/AdminMenuGroupEdit';
import AdminLocations from './pages/admin/AdminLocations';
import AdminCosts from './pages/admin/AdminCosts';
import AdminReports from './pages/admin/AdminReports';
import AdminFeedback from './pages/admin/AdminFeedback';
import AdminRequests from './pages/admin/AdminRequests';
import AdminInterest from './pages/admin/AdminInterest';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminErrorLogs from './pages/admin/AdminErrorLogs';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminCustomerDetail from './pages/admin/AdminCustomerDetail';

// Gates the whole customer-facing site behind a "coming soon" page while
// leaving the back-office admin dashboard reachable, via VITE_COMING_SOON.
const COMING_SOON = import.meta.env.VITE_COMING_SOON === 'true';

// Customer-facing chrome (install banner, mobile nav, chat widget) — hidden
// on the back-office admin dashboard and while the coming-soon gate is up.
function CustomerChrome() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/restricted-path') || COMING_SOON) return null;
  return (
    <>
      <InstallPrompt />
      <ChatWidget />
      <MobileNav />
    </>
  );
}

// Kept reachable even behind the coming-soon gate: first-taste pilot
// customers (see AdminInterest.jsx) get real delivered orders and an emailed
// /feedback/:id link before the site otherwise opens, and the standalone
// /feedback link is meant to be shareable independent of launch status.
const feedbackRoutes = (
  <>
    <Route path="/feedback/:id" element={<FeedbackPage />} />
    <Route path="/feedback" element={<GeneralFeedbackPage />} />
  </>
);

const adminRoutes = (
  <>
    <Route path="/restricted-path/login" element={<AdminLogin />} />
    <Route
      path="/restricted-path"
      element={
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<AdminOrders />} />
      <Route path="menu" element={<AdminMenu />} />
      <Route path="menu/groups" element={<AdminMenuGroups />} />
      <Route path="menu/groups/:id" element={<AdminMenuGroupEdit />} />
      <Route path="menu/:id" element={<AdminMenuItemEdit />} />
      <Route path="locations" element={<AdminLocations />} />
      <Route path="costs" element={<AdminCosts />} />
      <Route path="reports" element={<AdminReports />} />
      <Route path="feedback" element={<AdminFeedback />} />
      <Route path="requests" element={<AdminRequests />} />
      <Route path="interest" element={<AdminInterest />} />
      <Route path="notifications" element={<AdminNotifications />} />
      <Route path="error-logs" element={<AdminErrorLogs />} />
      <Route path="customers" element={<AdminCustomers />} />
      <Route path="customers/:id" element={<AdminCustomerDetail />} />
    </Route>
  </>
);

export default function App() {
  return (
    <AdminAuthProvider>
      <CustomerAuthProvider>
        <BrowserRouter>
          <StagingBanner />
          <SessionWatcher />
          <Routes>
            {COMING_SOON ? (
              <>
                {feedbackRoutes}
                {adminRoutes}
                <Route path="*" element={<ComingSoonPage />} />
              </>
            ) : (
              <>
                <Route path="/" element={<LandingPage />} />
                <Route path="/order" element={<OrderPage />} />
                <Route path="/order/:id" element={<OrderStatusPage />} />
                <Route path="/order/:id/confirmation" element={<OrderConfirmationPage />} />
                {feedbackRoutes}
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
