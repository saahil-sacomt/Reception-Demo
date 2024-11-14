// client/src/components/RequireAuth.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RequireAuth = ({ allowedRoles }) => {
  const { user, loading,role } = useAuth();

  if (loading) return <p>Loading...</p>;

  if (!user) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(role)) {
    console.warn("Access denied. Current role:", role);
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

export default RequireAuth;
