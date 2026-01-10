import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { getShareProfile, enableSharing } from '../services/database';
import './Settings.css';

export function Settings() {
  const { user, logout } = useAuth();
  const { theme, setTheme, shareSettings, updateShareSettings } = usePreferences();
  const [shareLink, setShareLink] = useState<string>('');
  const [loadingShareLink, setLoadingShareLink] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');

  // Load existing share profile on mount
  useEffect(() => {
    const loadShareProfile = async () => {
      if (!user) return;
      
      const profile = await getShareProfile(user.id);
      if (profile && profile.enabled) {
        const fullUrl = `${window.location.origin}${import.meta.env.BASE_URL}shared/${profile.shareId}`;
        setShareLink(fullUrl);
      }
    };
    
    loadShareProfile();
  }, [user]);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  const handleGenerateShareLink = async () => {
    if (!user) return;
    
    setLoadingShareLink(true);
    try {
      const profile = await enableSharing(user.id);
      if (profile) {
        const fullUrl = `${window.location.origin}${import.meta.env.BASE_URL}shared/${profile.shareId}`;
        setShareLink(fullUrl);
        updateShareSettings({ enabled: true });
      }
    } catch (error) {
      console.error('Failed to generate share link:', error);
    } finally {
      setLoadingShareLink(false);
    }
  };

  const handleCopyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
    }
  };

  const handleSaveDisplayName = () => {
    // Here you would save the display name to Supabase user metadata
    console.log('Saving display name:', displayName);
    // TODO: Implement update user metadata
  };

  return (
    <div className="settings-container">
      <div className="settings-content">
        <h1>Settings</h1>

        {/* User Profile Section */}
        <section className="settings-section">
          <h2>Profile</h2>
          <div className="setting-item">
            <label htmlFor="displayName">Display Name</label>
            <div className="input-group">
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input"
                placeholder="Your display name"
              />
              <button onClick={handleSaveDisplayName} className="btn btn-primary">
                Save
              </button>
            </div>
          </div>
          <div className="setting-item">
            <label>Email</label>
            <p className="setting-value">{user?.email || 'Not available'}</p>
          </div>
        </section>

        {/* Theme Section */}
        <section className="settings-section">
          <h2>Appearance</h2>
          <div className="setting-item">
            <label>Theme</label>
            <div className="theme-options">
              <button
                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => handleThemeChange('light')}
              >
                <span className="theme-icon">☀️</span>
                Light
              </button>
              <button
                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => handleThemeChange('dark')}
              >
                <span className="theme-icon">🌙</span>
                Dark
              </button>
              <button
                className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                onClick={() => handleThemeChange('system')}
              >
                <span className="theme-icon">💻</span>
                System
              </button>
            </div>
          </div>
        </section>

        {/* Share Settings Section */}
        <section className="settings-section">
          <h2>Library Sharing</h2>
          <div className="setting-item">
            <label htmlFor="shareEnabled">Enable Library Sharing</label>
            <input
              id="shareEnabled"
              type="checkbox"
              checked={shareSettings.enabled}
              onChange={(e) => updateShareSettings({ enabled: e.target.checked })}
              className="checkbox"
            />
            <p className="setting-description">
              Allow others to view your game library via a public link
            </p>
          </div>
          
          {shareSettings.enabled && (
            <>
              <div className="setting-item">
                <label htmlFor="showGameCount">Show Game Count</label>
                <input
                  id="showGameCount"
                  type="checkbox"
                  checked={shareSettings.showGameCount}
                  onChange={(e) => updateShareSettings({ showGameCount: e.target.checked })}
                  className="checkbox"
                />
              </div>
              
              <div className="setting-item">
                <label htmlFor="showProgress">Show Completion Progress</label>
                <input
                  id="showProgress"
                  type="checkbox"
                  checked={shareSettings.showProgress}
                  onChange={(e) => updateShareSettings({ showProgress: e.target.checked })}
                  className="checkbox"
                />
              </div>

              <div className="setting-item">
                <button 
                  onClick={handleGenerateShareLink} 
                  className="btn btn-secondary"
                  disabled={loadingShareLink}
                >
                  {loadingShareLink ? 'Generating...' : 'Generate Share Link'}
                </button>
                {shareLink && (
                  <div className="share-link-container">
                    <input
                      type="text"
                      value={shareLink}
                      readOnly
                      className="input share-link-input"
                    />
                    <button onClick={handleCopyShareLink} className="btn btn-primary">
                      Copy
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Account Section */}
        <section className="settings-section">
          <h2>Account</h2>
          <div className="setting-item">
            <button onClick={logout} className="btn btn-danger">
              Sign Out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
