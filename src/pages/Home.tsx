import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSEO } from '../hooks/useSEO';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faClipboardList, faGamepad, faShareNodes, faMagnifyingGlass, faCloud, faCalendarDays, faArrowRight, faGlobe } from '@fortawesome/free-solid-svg-icons';
import { getUpcomingGames, getRegionName, type BulkGameResult } from '../services/thegamesdb';
import { GameDetailsModal } from '../components/GameDetailsModal';
import './Home.css';

export function Home() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  
  const [upcomingGames, setUpcomingGames] = useState<BulkGameResult[]>([]);
  const [isLoadingUpcoming, setIsLoadingUpcoming] = useState(true);
  const [viewingGameId, setViewingGameId] = useState<number | null>(null);

  useSEO({
    title: 'My Switch Library - Track Your Nintendo Switch Game Collection',
    description: 'Track, organize, and share your Nintendo Switch and Switch 2 game collection. Search games, add physical and digital titles, and manage your library with ease.',
    url: 'https://myswitchlibrary.com/',
  });

  // Load a few upcoming games
  useEffect(() => {
    const loadUpcoming = async () => {
      if (!isOnline) {
        setIsLoadingUpcoming(false);
        return;
      }
      
      try {
        const result = await getUpcomingGames(60, undefined, 1, 6);
        setUpcomingGames(result.games);
      } catch (error) {
        console.error('Failed to load upcoming games:', error);
      } finally {
        setIsLoadingUpcoming(false);
      }
    };
    
    loadUpcoming();
  }, [isOnline]);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/library');
    } else {
      navigate('/auth');
    }
  };

  const formatReleaseDate = (dateString?: string) => {
    if (!dateString) return 'TBA';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="home">
      <div className="beta-banner" role="status">
        <span className="beta-badge">Public Beta</span>
        <span className="beta-text">This app is in public beta. Features may change and data sync is still in progress.</span>
      </div>

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
            <div className="feature-icon"><FontAwesomeIcon icon={faPenToSquare} /></div>
            <h3>Easy Entry</h3>
            <p>
              Quickly add games manually or search TheGamesDB to find your titles
              with rich metadata, cover art, and automatic details.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><FontAwesomeIcon icon={faClipboardList} /></div>
            <h3>Track Everything</h3>
            <p>
              Monitor physical and digital formats, purchase dates, completion status, 
              game condition, and personal notes for each title.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><FontAwesomeIcon icon={faGamepad} /></div>
            <h3>Wishlist & Status</h3>
            <p>
              Organize games by status: owned, wishlist, borrowed, lent, or sold.
              Keep track of what you want and what you've traded.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><FontAwesomeIcon icon={faShareNodes} /></div>
            <h3>Share & Compare</h3>
            <p>
              Share your collection with friends, save their libraries to your friends list for quick access, and easily compare collections to find games in common.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><FontAwesomeIcon icon={faMagnifyingGlass} /></div>
            <h3>Powerful Organization</h3>
            <p>
              Search, filter by platform and format, sort by various criteria, 
              and switch between grid, list, or compact view modes.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><FontAwesomeIcon icon={faCloud} /></div>
            <h3>Cloud Sync</h3>
            <p>
              Your library is saved to your account and accessible 
              from any device.
            </p>
          </div>
        </div>
      </section>

      {/* Upcoming Games Section */}
      {isOnline && (
        <section className="upcoming-preview">
          <div className="upcoming-header">
            <h2>
              <FontAwesomeIcon icon={faCalendarDays} className="section-icon" />
              Upcoming Releases
            </h2>
            <Link to="/calendar" className="view-all-link">
              View Full Calendar <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          </div>
          
          {isLoadingUpcoming ? (
            <div className="upcoming-loading">Loading upcoming games...</div>
          ) : upcomingGames.length > 0 ? (
            <div className="upcoming-grid">
              {upcomingGames.map((game) => (
                <div
                  key={game.id} 
                  className="upcoming-card"
                  onClick={() => setViewingGameId(game.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {game.coverUrl ? (
                    <img 
                      src={game.coverUrl} 
                      alt={game.title}
                      className="upcoming-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="upcoming-cover-placeholder">
                      <FontAwesomeIcon icon={faGamepad} />
                    </div>
                  )}
                  <div className="upcoming-info">
                    <h3 className="upcoming-title">{game.title}</h3>
                    <div className="upcoming-meta">
                      <span className="upcoming-date">{formatReleaseDate(game.releaseDate)}</span>
                      <span className={`upcoming-platform ${game.platform === 'Nintendo Switch 2' ? 'switch2' : 'switch'}`}>
                        {game.platform === 'Nintendo Switch 2' ? 'Switch 2' : 'Switch'}
                      </span>
                      {game.region_id !== undefined && (
                        <span className="upcoming-region">
                          <FontAwesomeIcon icon={faGlobe} /> {getRegionName(game.region_id)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-upcoming">No upcoming games found.</p>
          )}
        </section>
      )}

      {/* Game Details Modal */}
      {viewingGameId && (
        <GameDetailsModal
          gameId={viewingGameId}
          onClose={() => setViewingGameId(null)}
        />
      )}

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
