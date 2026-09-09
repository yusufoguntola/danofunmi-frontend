import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { markSessionExpired, onSessionExpired } from '../lib/sessionEvents';
import { isTokenExpired } from '../lib/jwt';

// How often to re-check stored tokens for a lapsed `exp` while the tab is open.
const SWEEP_INTERVAL_MS = 20000;

// Renders nothing. Watches both auth sessions and, the instant either token
// expires — proactively on a timer, or reactively when the server answers a
// request with 401 — clears that session and, if the user is on a screen that
// needs it, sends them to the matching login page.
export default function SessionWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const admin = useAdminAuth();
  const customer = useCustomerAuth();

  // Keep the freshest values reachable from the long-lived timer/event
  // handlers without making them re-subscribe on every render.
  const latest = useRef({});
  useEffect(() => {
    latest.current = { admin, customer, navigate, pathname: location.pathname };
  });

  const expireAdmin = useCallback(() => {
    const { admin, navigate, pathname } = latest.current;
    if (!admin.session) return;
    markSessionExpired('admin');
    admin.logout();
    const onAdminScreen = pathname.startsWith('/admin') && pathname !== '/admin/login';
    if (onAdminScreen) navigate('/admin/login', { replace: true, state: { expired: true } });
  }, []);

  const expireCustomer = useCallback(() => {
    const { customer, navigate, pathname } = latest.current;
    if (!customer.session) return;
    markSessionExpired('customer');
    customer.logout();
    // Most customer screens work fine signed-out; only "My orders" truly needs it.
    if (pathname === '/orders') navigate('/login', { replace: true, state: { expired: true } });
  }, []);

  // Reactive: a token the server just rejected.
  useEffect(
    () =>
      onSessionExpired(({ scope }) => {
        if (scope === 'admin') expireAdmin();
        else if (scope === 'customer') expireCustomer();
        else {
          expireAdmin();
          expireCustomer();
        }
      }),
    [expireAdmin, expireCustomer]
  );

  // Proactive: catch tokens that lapse while the tab sits open or asleep.
  useEffect(() => {
    function sweep() {
      if (isTokenExpired(latest.current.admin.session?.token)) expireAdmin();
      if (isTokenExpired(latest.current.customer.session?.token)) expireCustomer();
    }
    sweep();
    const timer = setInterval(sweep, SWEEP_INTERVAL_MS);
    document.addEventListener('visibilitychange', sweep);
    window.addEventListener('focus', sweep);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', sweep);
      window.removeEventListener('focus', sweep);
    };
  }, [expireAdmin, expireCustomer]);

  return null;
}
