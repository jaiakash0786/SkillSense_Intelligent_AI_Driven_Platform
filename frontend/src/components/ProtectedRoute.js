import { Navigate } from "react-router-dom";
import { getUserFromToken } from "../utils/auth";

function ProtectedRoute({ children, requiredRole }) {
  const user = getUserFromToken();

  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole && user.role !== requiredRole)
    return <Navigate to="/login" replace />;

  return children;
}

export default ProtectedRoute;
