import { useRegisterSW } from 'virtual:pwa-register/react';
import './UpdateAvailableBanner.css';

export function UpdateAvailableBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl: string, r: ServiceWorkerRegistration | undefined) {
      console.log('[PWA] Service Worker registered:', swUrl);
      // Check for updates every hour
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000); // 1 hour
      }
    },
    onRegisterError(error: unknown) {
      console.error('[PWA] Service Worker registration error:', error);
    },
  });

  if (!needRefresh) {
    return null;
  }

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <div className="update-banner-content">
        <div className="update-banner-text">
          <strong>New version available!</strong>
          <span>Click "Update Now" to get the latest features and improvements.</span>
        </div>
        <div className="update-banner-actions">
          <button 
            onClick={handleUpdate}
            className="update-banner-button update-banner-button-primary"
            aria-label="Update application now"
          >
            Update Now
          </button>
          <button 
            onClick={handleDismiss}
            className="update-banner-button update-banner-button-secondary"
            aria-label="Dismiss update notification"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
