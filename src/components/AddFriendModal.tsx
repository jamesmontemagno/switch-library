import { useState } from 'react';
import { getSharedUserProfile, isFriend, addFriend } from '../services/database';
import { useAuth } from '../hooks/useAuth';
import './AddGameModal.css';

interface AddFriendModalProps {
  onClose: () => void;
  onAdd: () => void | Promise<void>;
  prefilledShareId?: string;
  prefilledNickname?: string;
}

export function AddFriendModal({ onClose, onAdd, prefilledShareId, prefilledNickname }: AddFriendModalProps) {
  const { user } = useAuth();
  const [shareInput, setShareInput] = useState(prefilledShareId || '');
  const [nickname, setNickname] = useState(prefilledNickname || '');
  const [extractedShareId, setExtractedShareId] = useState(prefilledShareId || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');
  const [profileData, setProfileData] = useState<{ displayName: string; avatarUrl: string } | null>(null);

  // Extract UUID from share URL or direct ID
  const extractShareId = (input: string): string | null => {
    const trimmed = input.trim();
    
    // Try to match UUID pattern
    const uuidMatch = trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    
    if (uuidMatch) {
      return uuidMatch[1];
    }
    
    return null;
  };

  // Fetch profile when user finishes typing or clicks fetch
  const handleFetchProfile = async () => {
    if (!user) return;
    
    setError('');
    setProfileData(null);
    
    const shareId = extractShareId(shareInput);
    
    if (!shareId) {
      setError('Invalid share URL or ID. Please provide a valid share link.');
      return;
    }

    setExtractedShareId(shareId);
    setIsFetching(true);

    try {
      // Check if already a friend
      const alreadyFriend = await isFriend(user.id, shareId);
      if (alreadyFriend) {
        setError('This user is already in your friends list.');
        setIsFetching(false);
        return;
      }

      // Fetch the profile
      const profile = await getSharedUserProfile(shareId);
      
      if (!profile) {
        setError('Profile not found or sharing is disabled for this user.');
        setIsFetching(false);
        return;
      }

      setProfileData(profile);
      
      // Auto-fill nickname if not already set
      if (!nickname) {
        setNickname(profile.displayName);
      }
    } catch (err) {
      setError('Failed to fetch profile. Please try again.');
      console.error('Error fetching profile:', err);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    if (!extractedShareId || !profileData) {
      setError('Please fetch a valid profile first.');
      return;
    }

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setError('Nickname is required.');
      return;
    }

    if (trimmedNickname.length > 50) {
      setError('Nickname must be 50 characters or less.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await addFriend(user.id, extractedShareId, trimmedNickname);
      
      if (result) {
        await onAdd();
        onClose();
      } else {
        setError('Failed to add friend. Please try again.');
      }
    } catch (err) {
      setError('Failed to add friend. Please try again.');
      console.error('Error adding friend:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const characterCount = nickname.length;
  const isOverLimit = characterCount > 50;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="add-friend-modal-title">
      <div className="modal add-game-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="add-friend-modal-title">Add Friend</h2>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            ✕
          </button>
        </header>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="share-input">Share URL or ID *</label>
            <input
              id="share-input"
              type="text"
              value={shareInput}
              onChange={(e) => setShareInput(e.target.value)}
              onBlur={handleFetchProfile}
              placeholder="https://...shared/abc-123 or abc-123"
              required
              autoFocus={!prefilledShareId}
              disabled={isFetching || isLoading}
            />
            <button
              type="button"
              onClick={handleFetchProfile}
              disabled={!shareInput.trim() || isFetching || isLoading}
              className="btn-fetch"
              style={{ marginTop: '0.5rem' }}
            >
              {isFetching ? 'Fetching...' : 'Fetch Profile'}
            </button>
          </div>

          {profileData && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img
                src={profileData.avatarUrl || '/switch.svg'}
                alt={profileData.displayName}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/switch.svg';
                }}
              />
              <div>
                <strong>{profileData.displayName}</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', opacity: 0.7 }}>
                  Sharing enabled
                </p>
              </div>
            </div>
          )}

          {profileData && (
            <div className="form-group">
              <label htmlFor="nickname">
                Nickname * ({characterCount}/50)
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter a nickname"
                required
                maxLength={50}
                disabled={isLoading}
                style={isOverLimit ? { borderColor: 'var(--error-color, red)' } : undefined}
              />
              {isOverLimit && (
                <p style={{ color: 'var(--error-color, red)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
                  Nickname is too long
                </p>
              )}
            </div>
          )}

          {error && (
            <div style={{ 
              padding: '0.75rem', 
              backgroundColor: 'rgba(220, 38, 38, 0.1)', 
              color: 'var(--error-color, red)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel" disabled={isLoading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={isLoading || !profileData || !nickname.trim() || isOverLimit}
            >
              {isLoading ? 'Adding...' : 'Add Friend'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
