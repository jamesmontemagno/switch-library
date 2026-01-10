import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Header.css';

// Simple MD5-like hash for Gravatar (Note: For production, use a proper MD5 library)
async function getMD5Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// Generate Gravatar URL from email
async function getGravatarUrl(email: string | undefined): Promise<string> {
  if (!email) return '';
  
  try {
    const hash = await getMD5Hash(email.toLowerCase().trim());
    return `https://www.gravatar.com/avatar/${hash}?d=404&s=36`;
  } catch {
    return '';
  }
}

export function Header() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const handleAuthClick = () => {
    navigate('/auth');
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  // Use user avatar or fallback to logo
  const avatarUrl = user?.avatarUrl || '';
  const showLogo = !avatarUrl;

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <img src={`${import.meta.env.BASE_URL}switch.svg`} alt="Switch" className="logo-icon" />
          <span className="logo-text">My Switch Library</span>
        </Link>

        <nav className="nav" aria-label="Main navigation">
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
            <button onClick={handleSettingsClick} className="user-avatar-button" aria-label="Settings">
              {showLogo ? (
                <img 
                  src={`${import.meta.env.BASE_URL}switch.svg`} 
                  alt="Settings" 
                  className="user-avatar" 
                />
              ) : (
                <img 
                  src={avatarUrl} 
                  alt="Settings" 
                  className="user-avatar"
                  onError={async (e) => {
                    // Try Gravatar first
                    const gravatarUrl = await getGravatarUrl(user.email);
                    if (gravatarUrl && e.currentTarget.src !== gravatarUrl) {
                      e.currentTarget.src = gravatarUrl;
                    } else {
                      // If Gravatar also fails, show the logo
                      e.currentTarget.src = `${import.meta.env.BASE_URL}switch.svg`;
                    }
                  }}
                />
              )}
            </button>
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
