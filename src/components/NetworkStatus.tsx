import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloud, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import './NetworkStatus.css';

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineBanner, setShowOfflineBanner] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineBanner(true); // Show "Back online" message
      
      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setShowOfflineBanner(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showOfflineBanner) {
    return null;
  }

  return (
    <div 
      className="network-status" 
      role="status" 
      aria-live="polite"
      aria-label={isOnline ? 'You are online' : 'You are offline'}
    >
      <div className="network-status-content">
        <FontAwesomeIcon 
          icon={isOnline ? faCloud : faTriangleExclamation} 
          className="network-status-icon"
          aria-hidden="true"
        />
        <span className="network-status-text">
          {isOnline ? (
            'Back online'
          ) : (
            <>
              You're offline. Your library and cached games are still available.
            </>
          )}
        </span>
      </div>
    </div>
  );
}
