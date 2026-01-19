import { useAuth } from './useAuth';

/**
 * Hook to check if the current user is the admin user
 * Admin user ID is configured via VITE_ADMIN_USER_ID environment variable
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  const adminUserId = import.meta.env.VITE_ADMIN_USER_ID;
  
  if (!adminUserId || !user) {
    return false;
  }
  
  return user.id === adminUserId;
}
