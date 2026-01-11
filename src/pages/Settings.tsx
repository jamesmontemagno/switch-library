import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { useSEO } from '../hooks/useSEO';
import { getShareProfile, deleteUserAccount } from '../services/database';
import { ShareLibraryModal } from '../components/ShareLibraryModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon, faDesktop, faShare } from '@fortawesome/free-solid-svg-icons';
import './Settings.css';

export function Settings() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = usePreferences();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingEnabled, setSharingEnabled] = useState(false);
  
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
        setSharingEnabled(profile.enabled);
      }
    };
    
    loadShareProfile();
  }, [user]);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  const handleSharingEnabled = async () => {
    setSharingEnabled(true);
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
            Share your collection with friends or compare libraries
          </p>
          <div className="setting-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={() => setShowShareModal(true)} className="btn btn-primary">
                <FontAwesomeIcon icon={faShare} /> Manage Sharing Settings
              </button>
              {sharingEnabled && (
                <span style={{ 
                  padding: '0.4rem 1rem',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  borderRadius: '20px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(34, 197, 94, 0.4)'
                }}>
                  ON
                </span>
              )}
            </div>
          </div>
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

      {/* Share Library Modal */}
      {showShareModal && user && (
        <ShareLibraryModal
          userId={user.id}
          onClose={() => setShowShareModal(false)}
          onSharingEnabled={handleSharingEnabled}
        />
      )}
    </div>
  );
}
