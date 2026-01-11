import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { ApiAllowanceIndicator } from './ApiAllowanceFooter';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { getFollowBackRequests } from '../services/database';
import './Layout.css';

export function Layout() {
  const { user, isAuthenticated } = useAuth();
  const { shareSettings } = usePreferences();
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  // Fetch pending follow-back request count on mount and when user/settings change
  useEffect(() => {
    let isMounted = true;
    
    const loadPendingCount = async () => {
      if (!isAuthenticated || !user || !shareSettings.acceptFollowRequests) {
        if (isMounted) setPendingRequestCount(0);
        return;
      }
      
      try {
        const requests = await getFollowBackRequests(user.id);
        if (isMounted) setPendingRequestCount(requests.length);
      } catch (error) {
        console.error('Failed to fetch follow-back requests:', error);
        if (isMounted) setPendingRequestCount(0);
      }
    };
    
    loadPendingCount();
    
    return () => { isMounted = false; };
  }, [isAuthenticated, user, shareSettings.acceptFollowRequests]);

  const handleRefreshRequests = useCallback(async () => {
    if (!isAuthenticated || !user || !shareSettings.acceptFollowRequests) {
      setPendingRequestCount(0);
      return;
    }
    
    try {
      const requests = await getFollowBackRequests(user.id);
      setPendingRequestCount(requests.length);
    } catch (error) {
      console.error('Failed to fetch follow-back requests:', error);
      setPendingRequestCount(0);
    }
  }, [isAuthenticated, user, shareSettings.acceptFollowRequests]);

  return (
    <div className="layout">
      <Header 
        pendingRequestCount={pendingRequestCount} 
        onRefreshRequests={handleRefreshRequests}
      />
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-content">
          <p>
            &copy; {new Date().getFullYear()} My Switch Library. Built with ❤️ for Nintendo fans.
          </p>
          <p className="footer-links">
            <a href="https://www.refractored.com/terms" target="_blank" rel="noopener noreferrer">Terms</a>
            {' · '}
            <a href="https://www.refractored.com/about#privacy-policy" target="_blank" rel="noopener noreferrer">Privacy</a>
          </p>
          <p className="footer-attribution">
            Game data provided by{' '}
            <a href="https://thegamesdb.net" target="_blank" rel="noopener noreferrer">TheGamesDB.net</a>
          </p>
        </div>
        <ApiAllowanceIndicator />
      </footer>
    </div>
  );
}
