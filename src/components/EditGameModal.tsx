import { useState } from 'react';
import type { GameEntry, Platform, Format, GameStatus, GameCondition } from '../types';
import './AddGameModal.css';

interface EditGameModalProps {
  game: GameEntry;
  onClose: () => void;
  onSave: (game: GameEntry) => void | Promise<void>;
}

export function EditGameModal({ game, onClose, onSave }: EditGameModalProps) {
  const [title, setTitle] = useState(game.title);
  const [platform, setPlatform] = useState<Platform>(game.platform);
  const [format, setFormat] = useState<Format>(game.format);
  const [status, setStatus] = useState<GameStatus>(game.status);
  const [condition, setCondition] = useState<GameCondition | ''>(game.condition || '');
  const [notes, setNotes] = useState(game.notes || '');
  const [purchaseDate, setPurchaseDate] = useState(game.purchaseDate || '');
  const [completed, setCompleted] = useState(game.completed || false);
  const [completedDate, setCompletedDate] = useState(game.completedDate || '');
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(
    Boolean(game.purchaseDate || game.completed || game.completedDate || game.notes)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const updatedGame: GameEntry = {
      ...game,
      title: title.trim(),
      platform,
      format,
      status,
      condition: condition || undefined,
      notes: notes.trim() || undefined,
      purchaseDate: purchaseDate || undefined,
      completed: completed || undefined,
      completedDate: completedDate || undefined,
      updatedAt: new Date().toISOString(),
    };

    onSave(updatedGame);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal add-game-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="modal-title">Edit Game</h2>
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
              <label htmlFor="platform">Platform</label>
              <select
                id="platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
              >
                <option value="Nintendo Switch">Nintendo Switch</option>
                <option value="Nintendo Switch 2">Nintendo Switch 2</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="format">Format</label>
              <select
                id="format"
                value={format}
                onChange={(e) => setFormat(e.target.value as Format)}
              >
                <option value="Physical">Physical</option>
                <option value="Digital">Digital</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as GameStatus)}
              >
                <option value="Owned">Owned</option>
                <option value="Wishlist">Wishlist</option>
                <option value="Borrowed">Borrowed</option>
                <option value="Lent">Lent</option>
                <option value="Sold">Sold</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="condition">Condition</label>
              <select
                id="condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as GameCondition | '')}
              >
                <option value="">Not specified</option>
                <option value="New">New</option>
                <option value="Like New">Like New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this game..."
              rows={3}
            />
          </div>

          {/* Additional Details */}
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
                  <label className="checkbox-label">
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
                    <span>Completed/Beaten</span>
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
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={!title.trim()}>
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
