import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGamepad } from '@fortawesome/free-solid-svg-icons';
import './NotFound.css';

export function NotFound() {
  return (
    <div className="not-found">
      <div className="not-found-content">
        <div className="not-found-icon">
          <FontAwesomeIcon icon={faGamepad} />
        </div>
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="back-home">
          Go Back Home
        </Link>
      </div>
    </div>
  );
}
