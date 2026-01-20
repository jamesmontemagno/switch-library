import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { logger } from '../services/logger';
import type { ReactNode } from 'react';

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * AdminRoute component protects routes that should only be accessible by admin users.
 * Admin status is determined by the account_level field in the user's profile.
 * If user is not admin level, redirects to home page.
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isChecking } = useIsAdmin();

  logger.debug('AdminRoute: Checking access', { 
    isLoading, 
    isAuthenticated, 
    hasUser: !!user, 
    isAdmin,
    isChecking,
    userId: user?.id 
  });

  // Show nothing while checking auth OR admin status
  if (isLoading || isChecking) {
    logger.debug('AdminRoute: Auth or admin check still loading', { isLoading, isChecking });
    return null;
  }

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    logger.info('AdminRoute: User not authenticated, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  // Redirect if user is not an admin
  if (!isAdmin) {
    logger.info('AdminRoute: User is not admin, redirecting to home', { userId: user.id });
    return <Navigate to="/" replace />;
  }

  // User is authenticated and is an admin
  logger.info('AdminRoute: Access granted', { userId: user.id });
  return <>{children}</>;
}
