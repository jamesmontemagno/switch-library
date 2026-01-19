import { useAuth } from './useAuth';

/**
 * Hook to check if the current user is an admin user
 * Admin status is determined by:
 * 1. account_level field in the user's profile (database)
 * 2. VITE_ADMIN_ALLOWLIST environment variable (optional additional security)
 * 
 * Both checks must pass if allowlist is configured:
 * - User must have account_level = 'admin' in database
 * - User ID must be in VITE_ADMIN_ALLOWLIST (if configured)
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  
  if (!user) {
    return false;
  }
  
  // Check database account level
  const hasAdminLevel = user.accountLevel === 'admin';
  
  if (!hasAdminLevel) {
    return false;
  }
  
  // Check allowlist if configured (additional security layer)
  const allowlist = import.meta.env.VITE_ADMIN_ALLOWLIST;
  
  if (allowlist) {
    const allowedIds = allowlist.split(',').map(id => id.trim()).filter(id => id.length > 0);
    
    if (allowedIds.length > 0) {
      // If allowlist is configured, user must be in it
      return allowedIds.includes(user.id);
    }
  }
  
  // No allowlist configured, just check database level
  return true;
}
