import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSEO } from '../hooks/useSEO';
import './Home.css';

export function Home() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useSEO({
    title: 'My Switch Library - Track Your Nintendo Switch Game Collection',
    description: 'Track, organize, and share your Nintendo Switch and Switch 2 game collection. Search games, add physical and digital titles, and manage your library with ease.',
    url: 'https://myswitchlibrary.com/',
  });

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/library');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="home">
      <section className="hero">
        <h1 className="hero-title">
          Track Your Nintendo Switch Collection
        </h1>
        <p className="hero-subtitle">
          Search games, manually add titles, and share your library with friends.
          Keep track of every game you own across Nintendo Switch and Switch 2.
        </p>
        <button onClick={handleGetStarted} className="hero-cta">
          {isAuthenticated ? 'Go to My Library' : 'Get Started'}
        </button>
      </section>

      <section className="features">
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">✍️</div>
            <h3>Easy Entry</h3>
            <p>
              Quickly add games manually or search TheGamesDB to find your titles
              with rich metadata, cover art, and automatic details.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📋</div>
            <h3>Track Everything</h3>
            <p>
              Monitor physical and digital formats, purchase dates, completion status, 
              game condition, and personal notes for each title.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🎮</div>
            <h3>Wishlist & Status</h3>
            <p>
              Organize games by status: owned, wishlist, borrowed, lent, or sold.
              Keep track of what you want and what you've traded.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔗</div>
            <h3>Share & Compare</h3>
            <p>
              Share your collection with friends, save their libraries to your friends list for quick access, and easily compare collections to find games in common.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Powerful Organization</h3>
            <p>
              Search, filter by platform and format, sort by various criteria, 
              and switch between grid, list, or compact view modes.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">☁️</div>
            <h3>Cloud Sync</h3>
            <p>
              Your library is saved to your account and accessible 
              from any device. Works offline too with demo mode.
            </p>
          </div>
        </div>
      </section>

      <section className="platforms">
        <h2>Supported Platforms</h2>
        <div className="platform-badges">
          <span className="platform-badge switch">Nintendo Switch</span>
          <span className="platform-badge switch2">Nintendo Switch 2</span>
        </div>
      </section>
    </div>
  );
}
