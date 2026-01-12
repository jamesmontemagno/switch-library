import { useState, useEffect } from 'react';

/**
 * Hook to detect and track online/offline status
 * Listens to browser online/offline events and provides current status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    // Check if we're in a browser environment
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true; // Default to online for SSR/non-browser environments
  });

  useEffect(() => {
    // Double-check navigator availability
    if (typeof navigator === 'undefined') {
      return;
    }

    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup listeners
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
