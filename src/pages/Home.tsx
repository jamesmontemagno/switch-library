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
              with rich metadata.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🎮</div>
            <h3>Game Database</h3>
            <p>
              Powered by TheGamesDB for rich game metadata including cover art, 
              release dates, and more.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔗</div>
            <h3>Share & Compare</h3>
            <p>
              Share your collection with friends via a link and compare 
              libraries to find games in common.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">☁️</div>
            <h3>Cloud Sync</h3>
            <p>
              Your library is saved to your account and accessible 
              from any device.
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
