import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGamepad } from '@fortawesome/free-solid-svg-icons';
import { useSEO } from '../hooks/useSEO';
import './NotFound.css';

export function NotFound() {
  useSEO({
    title: '404 - Page Not Found',
    description: 'The page you are looking for does not exist',
  });
  
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
