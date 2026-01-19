import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { ReactNode } from 'react';

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * AdminRoute component protects routes that should only be accessible by admin users.
 * The admin user ID is configured via VITE_ADMIN_USER_ID environment variable.
 * If no admin is configured or user is not admin, redirects to home page.
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const adminUserId = import.meta.env.VITE_ADMIN_USER_ID;

  // Show nothing while checking auth
  if (isLoading) {
    return null;
  }

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect if no admin configured or user is not the admin
  if (!adminUserId || user.id !== adminUserId) {
    return <Navigate to="/" replace />;
  }

  // User is authenticated and is the admin
  return <>{children}</>;
}
