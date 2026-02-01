import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb, faGamepad, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { getGameRecommendations, PLATFORM_IDS, type BulkGameResult } from '../services/thegamesdb';
import './GameRecommendations.css';

interface GameRecommendationsProps {
  gameId: number;
  gameTitle: string;
}

export function GameRecommendations({ gameId, gameTitle }: GameRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<BulkGameResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadRecommendations = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const results = await getGameRecommendations(gameId, 10);
        if (mounted) {
          setRecommendations(results);
        }
      } catch (err) {
        console.error('Failed to load recommendations:', err);
        if (mounted) {
          setError('Failed to load recommendations');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadRecommendations();

    return () => {
      mounted = false;
    };
  }, [gameId]);

  const scroll = (direction: 'left' | 'right') => {
    const container = document.querySelector('.recommendations-scroll');
    if (!container) return;

    const scrollAmount = 220; // Card width + gap
    const newPosition = direction === 'left'
      ? Math.max(0, scrollPosition - scrollAmount)
      : scrollPosition + scrollAmount;

    container.scrollTo({ left: newPosition, behavior: 'smooth' });
    setScrollPosition(newPosition);
  };

  // Don't render if no recommendations
  if (!isLoading && recommendations.length === 0) {
    return null;
  }

  return (
    <section className="game-recommendations" aria-labelledby="recommendations-heading">
      <header className="recommendations-header">
        <h2 id="recommendations-heading">
          <FontAwesomeIcon icon={faLightbulb} className="recommendations-icon" />
          Similar to {gameTitle}
        </h2>

        {recommendations.length > 3 && (
          <div className="scroll-controls">
            <button
              onClick={() => scroll('left')}
              className="scroll-btn"
              aria-label="Scroll left"
              disabled={scrollPosition === 0}
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <button
              onClick={() => scroll('right')}
              className="scroll-btn"
              aria-label="Scroll right"
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
        )}
      </header>

      {isLoading && (
        <div className="recommendations-loading">
          <div className="loading-spinner" />
          <span>Finding similar games...</span>
        </div>
      )}

      {error && (
        <p className="recommendations-error">{error}</p>
      )}

      {!isLoading && !error && recommendations.length > 0 && (
        <div className="recommendations-scroll">
          {recommendations.map(game => (
            <Link
              key={game.id}
              to={`/search?query=${encodeURIComponent(game.title)}`}
              className="recommendation-card"
            >
              <div className="recommendation-cover">
                {game.coverUrl ? (
                  <img src={game.coverUrl} alt={game.title} loading="lazy" />
                ) : (
                  <div className="cover-placeholder">
                    <FontAwesomeIcon icon={faGamepad} />
                  </div>
                )}
                <span className={`platform-badge ${game.platformId === PLATFORM_IDS.NINTENDO_SWITCH_2 ? 'switch2' : 'switch'}`}>
                  {game.platformId === PLATFORM_IDS.NINTENDO_SWITCH_2 ? 'S2' : 'S1'}
                </span>
              </div>
              <div className="recommendation-info">
                <h3 className="recommendation-title">{game.title}</h3>
                {game.releaseDate && (
                  <span className="recommendation-year">
                    {new Date(game.releaseDate).getFullYear()}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
