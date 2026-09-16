import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function ProtectedRoute({ children, admin = false }) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <section className="section"><p role="status">Restoring your session…</p></section>;
  if (!user || user.active === false) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/my-bookings" replace />;
  return children;
}
