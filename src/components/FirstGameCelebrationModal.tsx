import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import './FirstGameCelebrationModal.css';

interface FirstGameCelebrationModalProps {
  onEnableSharing: () => void;
  onDismiss: () => void;
  gameTitle: string;
}

export function FirstGameCelebrationModal({ onEnableSharing, onDismiss, gameTitle }: FirstGameCelebrationModalProps) {
  return (
    <div className="celebration-modal-overlay" onClick={onDismiss}>
      <div className="celebration-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="celebration-title">
        <div className="celebration-icon" aria-hidden="true">
          🎉
        </div>
        <h2 id="celebration-title" className="celebration-title">
          Great Start!
        </h2>
        <p className="celebration-message">
          You've added <strong>{gameTitle}</strong> to your collection! 
          Want to share your library with friends and see what they're playing?
        </p>
        <div className="celebration-actions">
          <button 
            onClick={onEnableSharing}
            className="btn-primary"
            aria-label="Enable library sharing"
          >
            <FontAwesomeIcon icon={faUsers} /> Enable Sharing
          </button>
          <button 
            onClick={onDismiss}
            className="btn-secondary"
            aria-label="Continue without sharing"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
