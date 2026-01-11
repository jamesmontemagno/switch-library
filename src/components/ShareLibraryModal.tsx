import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  enableSharing, 
  disableSharing, 
  updateSharePrivacy, 
  updateDisplayName as updateDisplayNameDb,
  getShareProfile,
  getUserProfile
} from '../services/database';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLink, 
  faUser, 
  faGear, 
  faCheck, 
  faXmark, 
  faPenToSquare, 
  faClipboard, 
  faLock, 
  faEye 
} from '@fortawesome/free-solid-svg-icons';
import type { ShareProfile } from '../types';
import './AddGameModal.css';

interface ShareLibraryModalProps {
  userId: string;
  onClose: () => void;
  onSharingEnabled?: () => void;
}

export function ShareLibraryModal({ userId, onClose, onSharingEnabled }: ShareLibraryModalProps) {
  const navigate = useNavigate();
  const [shareProfile, setShareProfile] = useState<ShareProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [isLoadingShare, setIsLoadingShare] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load share profile and display name on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [profile, userProfile] = await Promise.all([
          getShareProfile(userId),
          getUserProfile(userId)
        ]);
        setShareProfile(profile);
        if (userProfile) {
          setDisplayName(userProfile.displayName);
        }
      } catch (error) {
        console.error('Failed to load share data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [userId]);

  const handleToggleSharing = async () => {
    setIsLoadingShare(true);
    try {
      if (shareProfile?.enabled) {
        const success = await disableSharing(userId);
        if (success) {
          setShareProfile(prev => prev ? { ...prev, enabled: false } : null);
        }
      } else {
        const newProfile = await enableSharing(userId);
        if (newProfile) {
          setShareProfile(newProfile);
          onSharingEnabled?.();
        }
      }
    } catch (error) {
      console.error('Failed to toggle sharing:', error);
    } finally {
      setIsLoadingShare(false);
    }
  };

  const getShareUrl = () => {
    if (!shareProfile) return '';
    const baseUrl = window.location.origin + import.meta.env.BASE_URL;
    return `${baseUrl}shared/${shareProfile.shareId}`;
  };

  const handleCopyLink = async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!displayName.trim()) return;
    setSavingDisplayName(true);
    try {
      const success = await updateDisplayNameDb(userId, displayName.trim());
      if (success) {
        setEditingDisplayName(false);
      }
    } catch (error) {
      console.error('Failed to update display name:', error);
    } finally {
      setSavingDisplayName(false);
    }
  };

  const handleToggleShowName = async () => {
    if (!shareProfile) return;
    setIsLoadingShare(true);
    try {
      const updated = await updateSharePrivacy(userId, { 
        showDisplayName: !shareProfile.showDisplayName 
      });
      if (updated) {
        setShareProfile(updated);
      }
    } catch (error) {
      console.error('Failed to toggle show name:', error);
    } finally {
      setIsLoadingShare(false);
    }
  };

  const handleToggleShowAvatar = async () => {
    if (!shareProfile) return;
    setIsLoadingShare(true);
    try {
      const updated = await updateSharePrivacy(userId, { 
        showAvatar: !shareProfile.showAvatar 
      });
      if (updated) {
        setShareProfile(updated);
      }
    } catch (error) {
      console.error('Failed to toggle show avatar:', error);
    } finally {
      setIsLoadingShare(false);
    }
  };

  const handlePreview = () => {
    if (shareProfile?.shareId) {
      navigate(`/shared/${shareProfile.shareId}`);
      onClose();
    }
  };

  if (isLoading) {
    return (
      <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
        <div className="modal add-game-modal" onClick={e => e.stopPropagation()}>
          <header className="modal-header">
            <h2 id="share-modal-title"><FontAwesomeIcon icon={faLink} /> Share Your Library</h2>
            <button onClick={onClose} className="modal-close" aria-label="Close">
              ✕
            </button>
          </header>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <div className="loading-spinner" aria-label="Loading" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <div className="modal add-game-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <header className="modal-header">
          <h2 id="share-modal-title"><FontAwesomeIcon icon={faLink} /> Share Your Library</h2>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            ✕
          </button>
        </header>
        
        <div className="modal-form" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            Share your collection with friends or compare libraries
          </p>
          
          {/* Profile Settings */}
          <div className="form-group">
            <label><FontAwesomeIcon icon={faUser} /> Display Name</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {editingDisplayName ? (
                <>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                    style={{ flex: 1 }}
                  />
                  <button 
                    onClick={handleSaveDisplayName} 
                    disabled={savingDisplayName || !displayName.trim()}
                    className="btn-submit"
                    style={{ padding: '0.5rem 0.75rem' }}
                  >
                    {savingDisplayName ? '...' : <><FontAwesomeIcon icon={faCheck} /></>}
                  </button>
                  <button 
                    onClick={() => setEditingDisplayName(false)}
                    className="btn-cancel"
                    style={{ padding: '0.5rem 0.75rem' }}
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontWeight: '500' }}>{displayName || 'Not set'}</span>
                  <button 
                    onClick={() => setEditingDisplayName(true)}
                    className="btn-submit"
                    style={{ padding: '0.5rem 0.75rem' }}
                  >
                    <FontAwesomeIcon icon={faPenToSquare} /> Edit
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Sharing Settings */}
          <div className="form-group">
            <label><FontAwesomeIcon icon={faGear} /> Sharing Settings</label>
            <div style={{ 
              padding: '1rem', 
              backgroundColor: 'var(--surface-alt)', 
              borderRadius: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <span>Sharing is {shareProfile?.enabled ? 'enabled' : 'disabled'}</span>
              <button
                onClick={handleToggleSharing}
                disabled={isLoadingShare}
                className="btn-submit"
                style={{
                  backgroundColor: shareProfile?.enabled ? 'var(--success)' : 'var(--text-secondary)',
                  minWidth: '60px',
                  borderRadius: '20px',
                  padding: '0.4rem 1rem',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  border: shareProfile?.enabled ? '2px solid var(--success)' : 'none',
                  boxShadow: shareProfile?.enabled ? '0 2px 8px rgba(34, 197, 94, 0.3)' : 'none'
                }}
              >
                {isLoadingShare ? '...' : shareProfile?.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            
            {shareProfile?.enabled && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' }}>
                    Share Link
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={getShareUrl()}
                      readOnly
                      style={{ flex: 1 }}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button onClick={handleCopyLink} className="btn-submit">
                      {copySuccess ? <><FontAwesomeIcon icon={faCheck} /> Copied!</> : <><FontAwesomeIcon icon={faClipboard} /> Copy</>}
                    </button>
                  </div>
                </div>
                
                {/* Privacy Settings */}
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: 'var(--surface-alt)', 
                  borderRadius: '0.5rem',
                  marginBottom: '1rem'
                }}>
                  <h4 style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <FontAwesomeIcon icon={faLock} /> Privacy
                  </h4>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <span style={{ fontSize: '0.875rem' }}>Show my display name</span>
                    <button
                      onClick={handleToggleShowName}
                      disabled={isLoadingShare}
                      className="btn-submit"
                      style={{
                        backgroundColor: shareProfile?.showDisplayName ? 'var(--success)' : 'var(--text-secondary)',
                        minWidth: '50px',
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.75rem',
                        borderRadius: '16px',
                        fontWeight: '600',
                        border: shareProfile?.showDisplayName ? '2px solid var(--success)' : 'none',
                        boxShadow: shareProfile?.showDisplayName ? '0 2px 6px rgba(34, 197, 94, 0.25)' : 'none'
                      }}
                    >
                      {shareProfile?.showDisplayName ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '0.875rem' }}>Show my avatar</span>
                    <button
                      onClick={handleToggleShowAvatar}
                      disabled={isLoadingShare}
                      className="btn-submit"
                      style={{
                        backgroundColor: shareProfile?.showAvatar ? 'var(--success)' : 'var(--text-secondary)',
                        minWidth: '50px',
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.75rem',
                        borderRadius: '16px',
                        fontWeight: '600',
                        border: shareProfile?.showAvatar ? '2px solid var(--success)' : 'none',
                        boxShadow: shareProfile?.showAvatar ? '0 2px 6px rgba(34, 197, 94, 0.25)' : 'none'
                      }}
                    >
                      {shareProfile?.showAvatar ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
                
                <button 
                  onClick={handlePreview}
                  className="btn-submit"
                  style={{ width: '100%' }}
                >
                  <FontAwesomeIcon icon={faEye} /> Preview Shared Library
                </button>
              </>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="btn-cancel">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
