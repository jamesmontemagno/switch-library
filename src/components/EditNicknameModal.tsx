import { useState } from 'react';
import { updateFriendNickname } from '../services/database';
import { useAuth } from '../hooks/useAuth';
import './AddGameModal.css';

interface EditNicknameModalProps {
  friendId: string;
  currentNickname: string;
  onClose: () => void;
  onUpdate: () => void | Promise<void>;
}

export function EditNicknameModal({ friendId, currentNickname, onClose, onUpdate }: EditNicknameModalProps) {
  const { user } = useAuth();
  const [nickname, setNickname] = useState(currentNickname);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setError('Nickname cannot be empty.');
      return;
    }

    if (trimmedNickname.length > 50) {
      setError('Nickname must be 50 characters or less.');
      return;
    }

    setIsUpdating(true);
    setError('');

    try {
      const success = await updateFriendNickname(user.id, friendId, trimmedNickname);
      
      if (success) {
        await onUpdate();
        onClose();
      } else {
        setError('Failed to update nickname. Please try again.');
      }
    } catch (err) {
      setError('Failed to update nickname. Please try again.');
      console.error('Error updating nickname:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const characterCount = nickname.length;
  const isOverLimit = characterCount > 50;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="edit-nickname-modal-title">
      <div className="modal add-game-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="edit-nickname-modal-title">Edit Nickname</h2>
          <button onClick={onClose} className="modal-close" aria-label="Close" disabled={isUpdating}>
            ✕
          </button>
        </header>
        <form onSubmit={handleSubmit} className="modal-form">
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
              autoFocus
              disabled={isUpdating}
              style={isOverLimit ? { borderColor: 'var(--error-color, red)' } : undefined}
            />
            {isOverLimit && (
              <p style={{ color: 'var(--error-color, red)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
                Nickname is too long
              </p>
            )}
          </div>

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
            <button type="button" onClick={onClose} className="btn-cancel" disabled={isUpdating}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={isUpdating || !nickname.trim() || isOverLimit || nickname.trim() === currentNickname}
            >
              {isUpdating ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
