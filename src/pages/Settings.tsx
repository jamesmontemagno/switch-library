import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { useSEO } from '../hooks/useSEO';
import { getShareProfile, enableSharing, disableSharing, regenerateShareId, deleteUserAccount } from '../services/database';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons';
import './Settings.css';

export function Settings() {
  const { user, logout } = useAuth();
  const { theme, setTheme, shareSettings, updateShareSettings } = usePreferences();
  const [shareLink, setShareLink] = useState<string>('');
  const [loadingShareLink, setLoadingShareLink] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  
  useSEO({
    title: 'Settings',
    description: 'Manage your profile, appearance, sharing settings, and account preferences',
  });

  // Load existing share profile on mount
  useEffect(() => {
    const loadShareProfile = async () => {
      if (!user) return;
      
      const profile = await getShareProfile(user.id);
      if (profile) {
        // Sync database state with local preferences
        updateShareSettings({
          enabled: profile.enabled,
          showGameCount: shareSettings.showGameCount,
          showProgress: shareSettings.showProgress,
        });
        
        if (profile.enabled) {
          const fullUrl = `${window.location.origin}${import.meta.env.BASE_URL}shared/${profile.shareId}`;
          setShareLink(fullUrl);
        }
      }
    };
    
    loadShareProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  const handleToggleSharing = async (enabled: boolean) => {
    if (!user) return;
    
    updateShareSettings({ enabled });
    
    if (enabled) {
      // Enable sharing in database
      const profile = await enableSharing(user.id);
      if (profile) {
        const fullUrl = `${window.location.origin}${import.meta.env.BASE_URL}shared/${profile.shareId}`;
        setShareLink(fullUrl);
      }
    } else {
      // Disable sharing in database
      await disableSharing(user.id);
      setShareLink('');
    }
  };

  const handleGenerateShareLink = async () => {
    if (!user) return;
    
    setLoadingShareLink(true);
    try {
      const profile = await regenerateShareId(user.id);
      if (profile) {
        const fullUrl = `${window.location.origin}${import.meta.env.BASE_URL}shared/${profile.shareId}`;
        setShareLink(fullUrl);
        updateShareSettings({ enabled: true });
      }
    } catch (error) {
      console.error('Failed to generate share link:', error);
    } finally {
      setLoadingShareLink(false);
      setShowRegenerateConfirm(false);
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      return;
    }
    
    if (!user) return;
    
    try {
      const success = await deleteUserAccount(user.id);
      if (success) {
        // Sign out after successful deletion
        await logout();
      } else {
        alert('Failed to delete account. Please try again or contact support.');
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('An error occurred while deleting your account. Please try again.');
    }
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
                <FontAwesomeIcon icon={faSun} className="theme-icon" />
                Light
              </button>
              <button
                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => handleThemeChange('dark')}
              >
                <FontAwesomeIcon icon={faMoon} className="theme-icon" />
                Dark
              </button>
              <button
                className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                onClick={() => handleThemeChange('system')}
              >
                <FontAwesomeIcon icon={faDesktop} className="theme-icon" />
                System
              </button>
            </div>
          </div>
        </section>

        {/* Share Settings Section */}
        <section className="settings-section">
          <h2>Library Sharing</h2>
          <p className="setting-description" style={{ marginBottom: '1rem' }}>
            Allow others to view your game library via a public link
          </p>
          
          {/* Enable/Disable Toggle */}
          <div className="share-toggle-row">
            <label htmlFor="shareEnabled">Enable Library Sharing</label>
            <button 
              id="shareEnabled"
              className={`btn-toggle ${shareSettings.enabled ? 'on' : 'off'}`}
              onClick={() => handleToggleSharing(!shareSettings.enabled)}
            >
              {shareSettings.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          
          {shareSettings.enabled && (
            <>
              {/* Share Link Row */}
              {shareLink && (
                <div className="share-link-row">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="share-url-input"
                  />
                  <button onClick={handleCopyShareLink} className="btn-copy">
                    Copy
                  </button>
                </div>
              )}
              
              {/* Privacy Settings */}
              <div className="privacy-settings">
                <h5>Privacy Settings</h5>
                <div className="privacy-toggle-row">
                  <span>Show Game Count</span>
                  <button 
                    className={`btn-toggle small ${shareSettings.showGameCount ? 'on' : 'off'}`}
                    onClick={() => updateShareSettings({ showGameCount: !shareSettings.showGameCount })}
                  >
                    {shareSettings.showGameCount ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div className="privacy-toggle-row">
                  <span>Show Completion Progress</span>
                  <button 
                    className={`btn-toggle small ${shareSettings.showProgress ? 'on' : 'off'}`}
                    onClick={() => updateShareSettings({ showProgress: !shareSettings.showProgress })}
                  >
                    {shareSettings.showProgress ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Share Actions */}
              <div className="share-actions-row">
                <button 
                  onClick={() => setShowRegenerateConfirm(true)} 
                  className="btn-regenerate"
                  disabled={loadingShareLink}
                >
                  {loadingShareLink ? 'Generating...' : 'Regenerate Link'}
                </button>
              </div>
            </>
          )}
        </section>

        {/* Account Section */}
        <section className="settings-section">
          <h2>Account</h2>
          <div className="setting-item">
            <button onClick={logout} className="btn btn-secondary">
              Sign Out
            </button>
          </div>
          <div className="setting-item">
            <label>Delete Account</label>
            <p className="setting-description">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button onClick={() => setShowDeleteConfirm(true)} className="btn btn-danger">
              Delete Account
            </button>
          </div>
        </section>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <header className="modal-header">
              <h2>Delete Account</h2>
              <button onClick={() => setShowDeleteConfirm(false)} className="modal-close" aria-label="Close">
                ×
              </button>
            </header>
            <div className="modal-form" style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', color: '#dc3545', fontWeight: '600' }}>
                ⚠️ Warning: This action cannot be undone!
              </p>
              <p style={{ marginBottom: '1rem' }}>
                Deleting your account will permanently remove:
              </p>
              <ul style={{ marginBottom: '1.5rem', marginLeft: '1.5rem', lineHeight: '1.8' }}>
                <li>Your entire game library</li>
                <li>All game data and notes</li>
                <li>Your profile and settings</li>
                <li>Share links and preferences</li>
              </ul>
              <p style={{ marginBottom: '1rem' }}>
                To confirm, please type <strong>DELETE</strong> below:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="input"
                placeholder="Type DELETE to confirm"
                style={{ marginBottom: '1.5rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => setShowDeleteConfirm(false)} 
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteAccount}
                  className="btn btn-danger"
                  disabled={deleteConfirmText !== 'DELETE'}
                  style={{ flex: 1 }}
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Link Confirmation Modal */}
      {showRegenerateConfirm && (
        <div className="modal-overlay" onClick={() => setShowRegenerateConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <header className="modal-header">
              <h2>Regenerate Share Link</h2>
              <button onClick={() => setShowRegenerateConfirm(false)} className="modal-close" aria-label="Close">
                ×
              </button>
            </header>
            <div className="modal-form" style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', color: '#dc3545', fontWeight: '600' }}>
                ⚠️ Warning: Use with extreme caution!
              </p>
              <p style={{ marginBottom: '1rem' }}>
                Regenerating your share link will:
              </p>
              <ul style={{ marginBottom: '1.5rem', marginLeft: '1.5rem', lineHeight: '1.8' }}>
                <li><strong>Remove all existing friend connections</strong></li>
                <li>Invalidate your current share link</li>
                <li>Create a new share link</li>
                <li>Require friends to re-add you with the new link</li>
              </ul>
              <p style={{ marginBottom: '1.5rem', color: '#6c757d' }}>
                This action will break the connection for anyone who has added you as a friend using your current share link.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => setShowRegenerateConfirm(false)} 
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleGenerateShareLink}
                  className="btn btn-danger"
                  disabled={loadingShareLink}
                  style={{ flex: 1 }}
                >
                  {loadingShareLink ? 'Regenerating...' : 'Regenerate Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
