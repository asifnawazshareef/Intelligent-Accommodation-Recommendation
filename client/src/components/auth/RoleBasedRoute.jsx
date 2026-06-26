import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";

const RoleBasedRoute = ({ allowedRoles, children }) => {
  const { user, getDashboardPath } = useAuth();

  return (
    <ProtectedRoute>
      {!user?.role ? (
        <Navigate to="/login" replace />
      ) : allowedRoles.includes(user.role) ? (
        children
      ) : (
        <Navigate to={getDashboardPath(user.role)} replace />
      )}
    </ProtectedRoute>
  );
};

export default RoleBasedRoute;
