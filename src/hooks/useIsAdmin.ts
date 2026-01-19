import { useAuth } from './useAuth';

/**
 * Hook to check if the current user is an admin user
 * Admin status is stored in the user's profile in the database
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  
  if (!user) {
    return false;
  }
  
  return user.isAdmin || false;
}
