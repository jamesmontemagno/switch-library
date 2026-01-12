import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faBookOpen, faUserGroup } from '@fortawesome/free-solid-svg-icons';
import './BottomNavigation.css';

export function BottomNavigation() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bottom-navigation" aria-label="Bottom navigation">
      <Link 
        to="/search" 
        className={`bottom-nav-item ${isActive('/search') ? 'active' : ''}`}
        aria-label="Search"
      >
        <FontAwesomeIcon icon={faMagnifyingGlass} />
        <span>Search</span>
      </Link>
      <Link 
        to="/library" 
        className={`bottom-nav-item ${isActive('/library') ? 'active' : ''}`}
        aria-label="Library"
      >
        <FontAwesomeIcon icon={faBookOpen} />
        <span>Library</span>
      </Link>
      <Link 
        to="/friends" 
        className={`bottom-nav-item ${isActive('/friends') ? 'active' : ''}`}
        aria-label="Following"
      >
        <FontAwesomeIcon icon={faUserGroup} />
        <span>Following</span>
      </Link>
    </nav>
  );
}
