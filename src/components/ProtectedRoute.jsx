import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function ProtectedRoute({ children }) {
  const { session } = useAdminAuth();
  if (!session?.token) return <Navigate to="/admin/login" replace />;
  return children;
}
