import { useState } from 'react';
import { removeFriend } from '../services/database';
import { useAuth } from '../hooks/useAuth';
import './AddGameModal.css';

interface RemoveFriendModalProps {
  friendId: string;
  friendNickname: string;
  onClose: () => void;
  onRemove: () => void | Promise<void>;
}

export function RemoveFriendModal({ friendId, friendNickname, onClose, onRemove }: RemoveFriendModalProps) {
  const { user } = useAuth();
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState('');

  const handleRemove = async () => {
    if (!user) return;

    setIsRemoving(true);
    setError('');

    try {
      const success = await removeFriend(user.id, friendId);
      
      if (success) {
        await onRemove();
        onClose();
      } else {
        setError('Failed to remove friend. Please try again.');
      }
    } catch (err) {
      setError('Failed to remove friend. Please try again.');
      console.error('Error removing friend:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="remove-friend-modal-title">
      <div className="modal add-game-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="remove-friend-modal-title">Remove Friend</h2>
          <button onClick={onClose} className="modal-close" aria-label="Close" disabled={isRemoving}>
            ✕
          </button>
        </header>
        <div className="modal-form">
          <p style={{ margin: '0 0 1rem', lineHeight: '1.6' }}>
            Are you sure you want to remove <strong>{friendNickname}</strong> from your friends?
          </p>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', opacity: 0.7 }}>
            This action cannot be undone.
          </p>

          {error && (
            <div style={{ 
              padding: '0.75rem', 
              backgroundColor: 'rgba(220, 38, 38, 0.1)', 
              color: 'var(--error-color, red)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel" disabled={isRemoving}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="btn-delete"
              disabled={isRemoving}
            >
              {isRemoving ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
