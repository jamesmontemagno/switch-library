import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Header.css';

export function Header() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const handleAuthClick = () => {
    navigate('/auth');
  };

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <img src={`${import.meta.env.BASE_URL}switch.svg`} alt="Switch" className="logo-icon" />
          <span className="logo-text">My Switch Library</span>
        </Link>

        <nav className="nav" aria-label="Main navigation">
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
            Home
          </Link>
          <Link to="/search" className={`nav-link ${isActive('/search') ? 'active' : ''}`}>
            Search
          </Link>
          {isAuthenticated && (
            <Link to="/library" className={`nav-link ${isActive('/library') ? 'active' : ''}`}>
              My Library
            </Link>
          )}
        </nav>

        <div className="auth-section">
          {isLoading ? (
            <span className="auth-loading">Loading...</span>
          ) : isAuthenticated && user ? (
            <div className="user-menu">
              <img src={user.avatarUrl} alt={user.displayName} className="user-avatar" />
              <span className="user-name">{user.displayName}</span>
              <button onClick={logout} className="btn btn-secondary">
                Sign Out
              </button>
            </div>
          ) : (
            <button onClick={handleAuthClick} className="btn btn-primary">
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
