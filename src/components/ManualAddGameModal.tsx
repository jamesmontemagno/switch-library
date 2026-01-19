import { useState } from 'react';
import type { GameEntry, Platform, Format } from '../types';
import { SegmentedControl } from './SegmentedControl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGamepad, faBox, faCloud } from '@fortawesome/free-solid-svg-icons';
import './AddGameModal.css';

interface ManualAddGameModalProps {
  onClose: () => void;
  onAdd: (game: Omit<GameEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void | Promise<void>;
}

export function ManualAddGameModal({ onClose, onAdd }: ManualAddGameModalProps) {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<Platform>('Nintendo Switch');
  const [format, setFormat] = useState<Format>('Physical');
  
  // Additional details (optional)
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [completed, setCompleted] = useState(false);
  const [completedDate, setCompletedDate] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAdd({
      title: title.trim(),
      platform,
      purchaseDate: purchaseDate || undefined,
      completed: completed || undefined,
      completedDate: completedDate || undefined,
      isFavorite: isFavorite || undefined,
      format,
      status: 'Owned',
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal add-game-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="modal-title">Add Game Manually</h2>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            ✕
          </button>
        </header>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="title">Game Title *</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter game title"
              required
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Platform</label>
              <SegmentedControl
                options={[
                  { value: 'Nintendo Switch', label: 'Switch', icon: <FontAwesomeIcon icon={faGamepad} /> },
                  { value: 'Nintendo Switch 2', label: 'Switch 2', icon: <FontAwesomeIcon icon={faGamepad} /> },
                ]}
                value={platform}
                onChange={(value) => setPlatform(value as Platform)}
                ariaLabel="Platform"
                variant="buttons"
                fullWidth
              />
            </div>

            <div className="form-group">
              <label>Format</label>
              <SegmentedControl
                options={[
                  { value: 'Physical', label: 'Physical', icon: <FontAwesomeIcon icon={faBox} /> },
                  { value: 'Digital', label: 'Digital', icon: <FontAwesomeIcon icon={faCloud} /> },
                ]}
                value={format}
                onChange={(value) => setFormat(value as Format)}
                ariaLabel="Game format"
                variant="buttons"
                fullWidth
              />
            </div>
          </div>

          {/* Additional Details (Optional) */}
          <div className="form-group">
            <button
              type="button"
              onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
              className="btn-toggle-section"
            >
              {showAdditionalDetails ? '▼' : '▶'} Additional Details (Optional)
            </button>
            
            {showAdditionalDetails && (
              <div className="additional-details">
                <div className="form-group">
                  <label htmlFor="purchaseDate">Purchase Date</label>
                  <input
                    id="purchaseDate"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-label checkbox-label-improved">
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={(e) => {
                        setCompleted(e.target.checked);
                        if (!e.target.checked) {
                          setCompletedDate('');
                        }
                      }}
                    />
                    <span className="checkbox-text">✓ Completed/Beaten</span>
                  </label>
                </div>

                {completed && (
                  <div className="form-group">
                    <label htmlFor="completedDate">Completion Date</label>
                    <input
                      id="completedDate"
                      type="date"
                      value={completedDate}
                      onChange={(e) => setCompletedDate(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="checkbox-label checkbox-label-improved">
                    <input
                      type="checkbox"
                      checked={isFavorite}
                      onChange={(e) => setIsFavorite(e.target.checked)}
                    />
                    <span className="checkbox-text">⭐ Mark as Favorite</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={!title.trim()}>
              Add Game
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
