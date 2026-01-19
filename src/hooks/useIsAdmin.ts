import { useAuth } from './useAuth';

/**
 * Hook to check if the current user is an admin user
 * Admin status is determined by the account_level field in the user's profile
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  
  if (!user) {
    return false;
  }
  
  return user.accountLevel === 'admin';
}
