import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { ReactNode } from 'react';

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * AdminRoute component protects routes that should only be accessible by admin users.
 * Admin status is determined by the is_admin field in the user's profile.
 * If user is not admin, redirects to home page.
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Show nothing while checking auth
  if (isLoading) {
    return null;
  }

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect if user is not an admin
  if (!user.isAdmin) {
    return <Navigate to="/" replace />;
  }

  // User is authenticated and is an admin
  return <>{children}</>;
}
