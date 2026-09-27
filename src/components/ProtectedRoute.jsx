import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { isTokenExpired } from '../lib/jwt';

export default function ProtectedRoute({ children }) {
  const { session } = useAdminAuth();
  if (!session?.token || isTokenExpired(session.token)) {
    return <Navigate to="/restricted-path/login" replace state={{ expired: !!session?.token }} />;
  }
  return children;
}
