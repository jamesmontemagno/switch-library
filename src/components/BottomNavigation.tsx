import { Link, useLocation } from 'react-router-dom';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faBookOpen, faUserGroup, faChartLine, faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import './BottomNavigation.css';

export function BottomNavigation() {
  const location = useLocation();
  const { isAdmin } = useIsAdmin();

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
      <Link 
        to="/calendar" 
        className={`bottom-nav-item ${isActive('/calendar') ? 'active' : ''}`}
        aria-label="Upcoming releases"
      >
        <FontAwesomeIcon icon={faCalendarDays} />
        <span>Upcoming</span>
      </Link>
      {isAdmin && (
        <Link 
          to="/admin" 
          className={`bottom-nav-item ${isActive('/admin') ? 'active' : ''}`}
          aria-label="Admin"
        >
          <FontAwesomeIcon icon={faChartLine} />
          <span>Admin</span>
        </Link>
      )}
    </nav>
  );
}
