import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { getFullUserProfile } from '../services/database';
import { logger } from '../services/logger';

/**
 * Hook to check if the current user is an admin user
 * Admin status is determined by:
 * 1. account_level field in the user's profile (database) - fetched lazily
 * 2. VITE_ADMIN_ALLOWLIST environment variable (optional additional security)
 * 
 * Both checks must pass if allowlist is configured:
 * - User must have account_level = 'admin' in database
 * - User ID must be in VITE_ADMIN_ALLOWLIST (if configured)
 * 
 * This hook only fetches account_level when the component using it mounts,
 * avoiding unnecessary database queries during login.
 */
export function useIsAdmin(): { isAdmin: boolean; isChecking: boolean } {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  
  useEffect(() => {
    async function checkAdminStatus() {
      if (!user) {
        logger.debug('useIsAdmin: No user, returning false');
        setIsAdmin(false);
        setIsChecking(false);
        return;
      }
      
      logger.info('useIsAdmin: Checking admin status for user', { userId: user.id, login: user.login });
      
      try {
        // Fetch account level from database (only happens when needed)
        logger.debug('useIsAdmin: Fetching profile from database');
        const profile = await getFullUserProfile(user.id);
        logger.info('useIsAdmin: Profile fetched', { accountLevel: profile?.accountLevel, hasProfile: !!profile });
        
        const hasAdminLevel = profile?.accountLevel === 'admin';
        
        if (!hasAdminLevel) {
          logger.info('useIsAdmin: User is not admin', { accountLevel: profile?.accountLevel });
          setIsAdmin(false);
          setIsChecking(false);
          return;
        }
        
        logger.info('useIsAdmin: User has admin level in database');
        
        // Check allowlist if configured (additional security layer)
        const allowlist = import.meta.env.VITE_ADMIN_ALLOWLIST;
        
        if (allowlist) {
          const allowedIds = allowlist.split(',').map(id => id.trim()).filter(id => id.length > 0);
          logger.info('useIsAdmin: Allowlist configured', { allowedIds, userInList: allowedIds.includes(user.id) });
          
          if (allowedIds.length > 0) {
            // If allowlist is configured, user must be in it
            const isInAllowlist = allowedIds.includes(user.id);
            logger.info('useIsAdmin: Allowlist check result', { isInAllowlist });
            setIsAdmin(isInAllowlist);
            setIsChecking(false);
            return;
          }
        } else {
          logger.info('useIsAdmin: No allowlist configured, using database level only');
        }
        
        // No allowlist configured, just check database level
        logger.info('useIsAdmin: Final result - user is admin');
        setIsAdmin(true);
        setIsChecking(false);
      } catch (error) {
        logger.error('Failed to check admin status', error, { userId: user.id });
        setIsAdmin(false);
        setIsChecking(false);
      }
    }
    
    checkAdminStatus();
  }, [user]);
  
  // Return both the status and checking state so components can wait
  return { isAdmin, isChecking };
}
