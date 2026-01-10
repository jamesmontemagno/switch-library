import { useState, useEffect } from 'react';
import { getStoredAllowance, isTheGamesDBConfigured } from '../services/thegamesdb';
import { getMonthlySearchCount } from '../services/database';
import { useAuth } from '../hooks/useAuth';
import './ApiAllowanceFooter.css';

function getInitialAllowance() {
  const stored = getStoredAllowance();
  return stored ? { remaining: stored.remaining, extra: stored.extra } : null;
}

export function ApiAllowanceIndicator() {
  const { user } = useAuth();
  const [allowance, setAllowance] = useState<{ remaining: number; extra: number } | null>(getInitialAllowance);
  const [usage, setUsage] = useState<{ count: number; limit: number } | null>(null);
  const hasTheGamesDB = isTheGamesDBConfigured();

  useEffect(() => {
    // Load initial usage
    if (user) {
      getMonthlySearchCount(user.id).then(u => setUsage({ count: u.count, limit: u.limit }));
    }

    // Listen for storage changes (when search updates the allowance)
    const handleStorageChange = () => {
      const updated = getStoredAllowance();
      if (updated) {
        setAllowance({ remaining: updated.remaining, extra: updated.extra });
      }
      // Also refresh usage
      if (user) {
        getMonthlySearchCount(user.id).then(u => setUsage({ count: u.count, limit: u.limit }));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also poll periodically since storage events don't fire for same-tab changes
    const interval = setInterval(() => {
      const updated = getStoredAllowance();
      if (updated) {
        setAllowance({ remaining: updated.remaining, extra: updated.extra });
      }
      // Refresh usage
      if (user) {
        getMonthlySearchCount(user.id).then(u => setUsage({ count: u.count, limit: u.limit }));
      }
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [user]);

  if (!hasTheGamesDB || (!allowance && !usage)) {
    return null;
  }

  const getStatusClass = () => {
    if (allowance && allowance.remaining === 0) return 'exhausted';
    if (allowance && allowance.remaining < 50) return 'low';
    if (allowance && allowance.remaining < 200) return 'moderate';
    return 'good';
  };

  const getUsageStatusClass = () => {
    if (!usage) return 'good';
    const percentage = (usage.count / usage.limit) * 100;
    if (percentage >= 100) return 'exhausted';
    if (percentage >= 80) return 'low';
    if (percentage >= 60) return 'moderate';
    return 'good';
  };

  return (
    <div className="api-allowance-container">
      {allowance && (
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
      )}
      {usage && (
        <div className={`api-allowance-indicator ${getUsageStatusClass()}`}>
          <span className="allowance-label">🔍 Searches:</span>
          <span className="allowance-value">
            {usage.count}/{usage.limit}
          </span>
          {usage.count >= usage.limit && (
            <span className="allowance-warning">⚠️</span>
          )}
        </div>
      )}
    </div>
  );
}
