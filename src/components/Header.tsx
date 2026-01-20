import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { getShareProfile } from '../services/database';
import { ShareLibraryModal } from './ShareLibraryModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faBookOpen, faUserGroup, faUser, faLink, faChartLine } from '@fortawesome/free-solid-svg-icons';
import type { ShareProfile } from '../types';
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
  const { isAdmin } = useIsAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const [avatarError, setAvatarError] = useState(false);
  const [shareProfile, setShareProfile] = useState<ShareProfile | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  // Load share profile when authenticated
  useEffect(() => {
    const loadShareProfile = async () => {
      if (user) {
        try {
          const profile = await getShareProfile(user.id);
          setShareProfile(profile);
        } catch (error) {
          console.error('Failed to load share profile:', error);
        }
      } else {
        setShareProfile(null);
      }
    };
    loadShareProfile();
  }, [user]);

  const handleAuthClick = () => {
    navigate('/auth');
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleShareClick = () => {
    setShowShareModal(true);
  };

  const handleSharingEnabled = async () => {
    // Refresh share profile after enabling
    if (user) {
      try {
        const updatedProfile = await getShareProfile(user.id);
        setShareProfile(updatedProfile);
      } catch (error) {
        console.error('Failed to refresh share profile:', error);
      }
    }
  };

  // Use user avatar or fallback to person icon
  const avatarUrl = user?.avatarUrl || '';
  const showPersonIcon = !avatarUrl || avatarError;

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <img src={`${import.meta.env.BASE_URL}android-chrome-192x192.png`} alt="Switch" className="logo-icon" />
          <span className="logo-text">My Switch Library</span>
        </Link>

        <nav className="nav" aria-label="Main navigation">
          {isAuthenticated && (
            <>
              <Link to="/search" className={`nav-link nav-link-icon ${isActive('/search') ? 'active' : ''}`} aria-label="Search">
                <FontAwesomeIcon icon={faMagnifyingGlass} />
              </Link>
              <Link to="/library" className={`nav-link ${isActive('/library') ? 'active' : ''}`}>
                <FontAwesomeIcon icon={faBookOpen} />
                <span>Library</span>
              </Link>
              <Link to="/friends" className={`nav-link ${isActive('/friends') ? 'active' : ''}`}>
                <FontAwesomeIcon icon={faUserGroup} />
                <span>Following</span>
              </Link>
              {isAdmin && (
                <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>
                  <FontAwesomeIcon icon={faChartLine} />
                  <span>Admin</span>
                </Link>
              )}
              <button 
                onClick={handleShareClick} 
                className={`nav-link nav-link-button ${shareProfile?.enabled ? 'share-active' : ''}`}
                aria-label="Share library"
                title={shareProfile?.enabled ? 'Sharing enabled' : 'Share your library'}
              >
                <FontAwesomeIcon icon={faLink} />
                <span className="nav-link-text">Share</span>
              </button>
            </>
          )}
        </nav>

        <div className="auth-section">
          {isLoading ? (
            <span className="auth-loading">Loading...</span>
          ) : isAuthenticated && user ? (
            <button onClick={handleSettingsClick} className="user-avatar-button" aria-label="Settings">
              {showPersonIcon ? (
                <span className="user-avatar user-avatar-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={faUser} />
                </span>
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
                      // If Gravatar also fails, show the person icon
                      setAvatarError(true);
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

      {/* Share Library Modal */}
      {showShareModal && user && (
        <ShareLibraryModal 
          userId={user.id} 
          onClose={() => setShowShareModal(false)}
          onSharingEnabled={handleSharingEnabled}
        />
      )}
    </header>
  );
}
