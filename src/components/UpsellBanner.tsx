import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRocket, faUsers, faArrowsLeftRight } from '@fortawesome/free-solid-svg-icons';
import './UpsellBanner.css';

export function UpsellBanner() {
  return (
    <div className="upsell-banner">
      <div className="upsell-content">
        <div className="upsell-icon">
          <FontAwesomeIcon icon={faRocket} />
        </div>
        <div className="upsell-text">
          <h3>Start Your Own Game Collection</h3>
          <p>Sign up to create your library, add friends, and compare your game collections!</p>
        </div>
        <div className="upsell-features">
          <div className="feature-item">
            <FontAwesomeIcon icon={faRocket} />
            <span>Build Your Library</span>
          </div>
          <div className="feature-item">
            <FontAwesomeIcon icon={faUsers} />
            <span>Add Friends</span>
          </div>
          <div className="feature-item">
            <FontAwesomeIcon icon={faArrowsLeftRight} />
            <span>Compare Collections</span>
          </div>
        </div>
        <div className="upsell-actions">
          <Link to="/auth" className="btn-signup">
            Sign Up Free
          </Link>
          <Link to="/auth" className="btn-login">
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}
