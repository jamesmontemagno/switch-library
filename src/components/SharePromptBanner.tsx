import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faXmark } from '@fortawesome/free-solid-svg-icons';
import './SharePromptBanner.css';

interface SharePromptBannerProps {
  onShareClick: () => void;
  onDismiss: () => void;
}

export function SharePromptBanner({ onShareClick, onDismiss }: SharePromptBannerProps) {
  return (
    <div className="share-prompt-banner" role="alert" aria-live="polite">
      <div className="share-prompt-icon">
        <FontAwesomeIcon icon={faUsers} />
      </div>
      <div className="share-prompt-content">
        <h3 className="share-prompt-title">Share Your Collection with Friends!</h3>
        <p className="share-prompt-description">
          Let friends see your library and compare collections. Get a shareable link in seconds.
        </p>
      </div>
      <div className="share-prompt-actions">
        <button 
          onClick={onShareClick}
          className="btn-primary"
          aria-label="Enable library sharing"
        >
          Enable Sharing
        </button>
        <button 
          onClick={onDismiss}
          className="btn-dismiss"
          aria-label="Dismiss sharing prompt"
        >
          <FontAwesomeIcon icon={faXmark} /> Dismiss
        </button>
      </div>
    </div>
  );
}
