import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../ui/Ui';

export default function ProtectedRoute({ roles }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Spinner label="Checking your session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const hasAccess =
    !roles ||
    roles.some((role) => {
      if (role === 'admin') return user?.is_superuser || user?.user_role === '2';
      if (role === 'vendor') return user?.user_role === '3';
      if (role === 'customer') return user?.user_role === '1';
      return false;
    });

  if (!hasAccess) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-semibold text-navy">Access denied</h1>
        <p className="mt-2 text-sm text-slate-500">
          This area is not available for your account type.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
