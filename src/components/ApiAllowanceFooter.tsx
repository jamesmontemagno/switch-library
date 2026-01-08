import { useState, useEffect } from 'react';
import { getStoredAllowance, isTheGamesDBConfigured } from '../services/thegamesdb';
import './ApiAllowanceFooter.css';

export function ApiAllowanceIndicator() {
  const [allowance, setAllowance] = useState<{ remaining: number; extra: number } | null>(null);
  const hasTheGamesDB = isTheGamesDBConfigured();

  useEffect(() => {
    // Check allowance on mount
    const stored = getStoredAllowance();
    if (stored) {
      setAllowance({ remaining: stored.remaining, extra: stored.extra });
    }

    // Listen for storage changes (when search updates the allowance)
    const handleStorageChange = () => {
      const updated = getStoredAllowance();
      if (updated) {
        setAllowance({ remaining: updated.remaining, extra: updated.extra });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also poll periodically since storage events don't fire for same-tab changes
    const interval = setInterval(() => {
      const updated = getStoredAllowance();
      if (updated) {
        setAllowance({ remaining: updated.remaining, extra: updated.extra });
      }
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  if (!hasTheGamesDB || !allowance) {
    return null;
  }

  const getStatusClass = () => {
    if (allowance.remaining === 0) return 'exhausted';
    if (allowance.remaining < 50) return 'low';
    if (allowance.remaining < 200) return 'moderate';
    return 'good';
  };

  return (
    <div className={`api-allowance-indicator ${getStatusClass()}`}>
      <span className="allowance-label">🔑 API:</span>
      <span className="allowance-value">
        {allowance.remaining.toLocaleString()}
      </span>
      {allowance.remaining === 0 && (
        <span className="allowance-warning">⚠️</span>
      )}
      {allowance.remaining > 0 && allowance.remaining < 50 && (
        <span className="allowance-warning">⚠️</span>
      )}
    </div>
  );
}
