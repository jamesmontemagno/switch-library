import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faGamepad, faCalendar, faGlobe, faTrophy, faShoppingCart } from '@fortawesome/free-solid-svg-icons';
import { getGameById, getGenres, getDevelopers, getPublishers, mapIdsToNames, getRegionName, type TheGamesDBGame } from '../services/thegamesdb';
import './GameDetailsModal.css';

interface GameDetailsModalProps {
  gameId: number;
  onClose: () => void;
}

export function GameDetailsModal({ gameId, onClose }: GameDetailsModalProps) {
  const [gameData, setGameData] = useState<TheGamesDBGame | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [genreNames, setGenreNames] = useState<string[]>([]);
  const [developerNames, setDeveloperNames] = useState<string[]>([]);
  const [publisherNames, setPublisherNames] = useState<string[]>([]);

  useEffect(() => {
    const fetchGameDetails = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await getGameById(gameId);
        setGameData(data);
        
        if (data) {
          const [genres, developers, publishers] = await Promise.all([
            getGenres(),
            getDevelopers(),
            getPublishers()
          ]);
          
          setGenreNames(mapIdsToNames(data.genres, genres));
          setDeveloperNames(mapIdsToNames(data.developers, developers));
          setPublisherNames(mapIdsToNames(data.publishers, publishers));
        }
      } catch (err) {
        console.error('Failed to load game details:', err);
        setError('Failed to load game details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGameDetails();
  }, [gameId]);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'TBA';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getCoverUrl = () => {
    if (!gameData?.boxart) return null;
    return gameData.boxart.medium || gameData.boxart.small || gameData.boxart.thumb || gameData.boxart.original;
  };

  const getAmazonSearchUrl = (gameTitle: string) => {
    const searchQuery = `${gameTitle} nintendo switch`;
    const params = new URLSearchParams({
      k: searchQuery,
      tag: 'jamesmontemagno-20',
      linkCode: 'sl2',
      linkId: 'c39dc3a5b6ed08ee2c4f1bc5c4b45225',
      ref: 'as_li_ss_tl'
    });
    return `https://www.amazon.com/s?${params.toString()}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="game-details-modal" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="modal-close-button" aria-label="Close">
          <FontAwesomeIcon icon={faXmark} />
        </button>

        {isLoading && (
          <div className="details-loading">
            <div className="loading-spinner" />
            <p>Loading game details...</p>
          </div>
        )}

        {error && (
          <div className="details-error">
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && gameData && (
          <div className="details-content">
            <div className="details-hero">
              <div className="hero-cover">
                {getCoverUrl() ? (
                  <img src={getCoverUrl()!} alt={gameData.game_title} />
                ) : (
                  <div className="cover-placeholder-large">
                    <FontAwesomeIcon icon={faGamepad} />
                  </div>
                )}
              </div>

              <div className="hero-info">
                <h1>{gameData.game_title}</h1>
                
                <div className="meta-badges">
                  {gameData.platform && (
                    <span className={`platform-badge ${gameData.platform === 19 ? 'switch2' : 'switch'}`}>
                      {gameData.platform === 19 ? 'Nintendo Switch 2' : 'Nintendo Switch'}
                    </span>
                  )}
                  {gameData.region_id !== undefined && (
                    <span className="region-badge">
                      <FontAwesomeIcon icon={faGlobe} /> {getRegionName(gameData.region_id)}
                    </span>
                  )}
                </div>

                {gameData.overview && (
                  <div className="game-overview">
                    <p>{gameData.overview}</p>
                  </div>
                )}

                <div className="hero-actions">
                  <a
                    href={getAmazonSearchUrl(gameData.game_title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-amazon"
                  >
                    <FontAwesomeIcon icon={faShoppingCart} /> Buy on Amazon
                  </a>
                </div>
              </div>
            </div>

            <div className="details-sections">
              {/* Release Information */}
              <section className="details-section">
                <h2>Release Information</h2>
                <div className="info-grid">
                  {gameData.release_date && (
                    <div className="info-item">
                      <span className="info-label">
                        <FontAwesomeIcon icon={faCalendar} /> Release Date
                      </span>
                      <span className="info-value">{formatDate(gameData.release_date)}</span>
                    </div>
                  )}
                  {gameData.region_id !== undefined && (
                    <div className="info-item">
                      <span className="info-label">
                        <FontAwesomeIcon icon={faGlobe} /> Region
                      </span>
                      <span className="info-value">{getRegionName(gameData.region_id)}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Game Information */}
              {(genreNames.length > 0 || developerNames.length > 0 || publisherNames.length > 0) && (
                <section className="details-section">
                  <h2>Game Information</h2>
                  <div className="info-grid">
                    {genreNames.length > 0 && (
                      <div className="info-item">
                        <span className="info-label">Genres</span>
                        <span className="info-value">{genreNames.join(', ')}</span>
                      </div>
                    )}
                    {developerNames.length > 0 && (
                      <div className="info-item">
                        <span className="info-label">Developer{developerNames.length > 1 ? 's' : ''}</span>
                        <span className="info-value">{developerNames.join(', ')}</span>
                      </div>
                    )}
                    {publisherNames.length > 0 && (
                      <div className="info-item">
                        <span className="info-label">Publisher{publisherNames.length > 1 ? 's' : ''}</span>
                        <span className="info-value">{publisherNames.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Additional Info */}
              {gameData.players && (
                <section className="details-section">
                  <h2>Additional Info</h2>
                  <div className="info-grid">
                    {gameData.players && (
                      <div className="info-item">
                        <span className="info-label">
                          <FontAwesomeIcon icon={faTrophy} /> Players
                        </span>
                        <span className="info-value">{gameData.players}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
