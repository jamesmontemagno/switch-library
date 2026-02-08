import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSEO } from '../hooks/useSEO';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { GameEntry } from '../types';
import { loadGames, saveGame } from '../services/database';
import { getGameById, getGenres, getDevelopers, getPublishers, mapIdsToNames, getRegionName } from '../services/thegamesdb';
import type { TheGamesDBGame } from '../services/thegamesdb';
import { EditGameModal } from '../components/EditGameModal';
import { GameRecommendations } from '../components/GameRecommendations';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faGamepad, faCheck } from '@fortawesome/free-solid-svg-icons';
import './GameDetails.css';

export function GameDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [game, setGame] = useState<GameEntry | null>(null);
  const [apiData, setApiData] = useState<TheGamesDBGame | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingGame, setEditingGame] = useState<GameEntry | null>(null);
  
  // Lookup data for mapping IDs to names
  const [genreNames, setGenreNames] = useState<string[]>([]);
  const [developerNames, setDeveloperNames] = useState<string[]>([]);
  const [publisherNames, setPublisherNames] = useState<string[]>([]);
  
  // Dynamic page title based on game
  useSEO({
    title: game ? `${game.title} - Game Details` : 'Game Details',
    description: game 
      ? `View details for ${game.title} on ${game.platform}. ${game.completed ? 'Completed' : 'In your library'}.`
      : 'View game details from your Nintendo Switch library',
  });

  useEffect(() => {
    async function fetchGameDetails() {
      if (!user || !id) {
        setIsLoading(false);
        return;
      }

      // When offline, redirect back to library since we can't fetch additional details
      if (!isOnline) {
        alert('You are offline. Game details cannot be loaded in offline mode. Returning to library.');
        navigate('/library');
        return;
      }

      try {
        // Load the game from our database
        const userGames = await loadGames(user.id);
        const foundGame = userGames.find(g => g.id === id);
        
        if (!foundGame) {
          navigate('/library');
          return;
        }

        setGame(foundGame);

        // If we have a TheGamesDB ID, fetch additional details
        if (foundGame.thegamesdbId) {
          const gameData = await getGameById(foundGame.thegamesdbId);
          console.log('API Data:', gameData);
          setApiData(gameData);
          
          // Fetch lookup data for genres, developers, publishers
          if (gameData) {
            const [genres, developers, publishers] = await Promise.all([
              getGenres(),
              getDevelopers(),
              getPublishers()
            ]);
            
            setGenreNames(mapIdsToNames(gameData.genres, genres));
            setDeveloperNames(mapIdsToNames(gameData.developers, developers));
            setPublisherNames(mapIdsToNames(gameData.publishers, publishers));
            
            // If we don't have a cover URL yet and boxart is available, save it
            if (!foundGame.coverUrl && gameData.boxart) {
              const coverUrl = gameData.boxart.thumb || gameData.boxart.small || gameData.boxart.medium || gameData.boxart.original;
              if (coverUrl) {
                const updatedGame = { ...foundGame, coverUrl };
                await saveGame(updatedGame);
                setGame(updatedGame);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load game details:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchGameDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, navigate]); // isOnline intentionally omitted - we check it at runtime but don't want to refetch on status changes

  const handleEditGame = async (updatedGame: GameEntry) => {
    // Prevent editing when offline
    if (!isOnline) {
      alert('You are offline. Game editing is not available in offline mode.');
      setEditingGame(null);
      return;
    }
    
    const savedGame = await saveGame(updatedGame);
    if (savedGame) {
      setGame(savedGame);
    }
    setEditingGame(null);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'Not set';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="game-details">
        <div className="loading-container">
          <div className="loading-spinner" aria-label="Loading" />
          <p>Loading game details...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="game-details">
        <div className="error-state">
          <h2>Game not found</h2>
          <button onClick={() => navigate('/library')} className="btn-primary">
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-details">
      <div className="details-header">
        <button onClick={() => navigate('/library')} className="back-button">
          ← Back to Library
        </button>
        <button onClick={() => setEditingGame(game)} className="edit-button">
          <FontAwesomeIcon icon={faPenToSquare} /> Edit Game
        </button>
      </div>

      <div className="details-content">
        <div className="details-hero">
          <div className="hero-cover">
            {game.coverUrl ? (
              <img src={game.coverUrl} alt={game.title} />
            ) : (
              <div className="cover-placeholder-large">
                <FontAwesomeIcon icon={faGamepad} />
              </div>
            )}
          </div>

          <div className="hero-info">
            <h1>{game.title}</h1>
            
            <div className="meta-tags">
              <span className={`platform-tag ${game.platform === 'Nintendo Switch' ? 'switch' : 'switch2'}`}>
                {game.platform}
              </span>
              <span className={`format-tag ${game.format.toLowerCase()}`}>
                {game.format}
              </span>
              <span className={`status-tag ${game.status.toLowerCase()}`}>
                {game.status}
              </span>
              {game.condition && (
                <span className="condition-tag">
                  {game.condition}
                </span>
              )}
              {game.completed && (
                <span className="completed-checkbox checked" title="Completed">
                  <FontAwesomeIcon icon={faCheck} />
                </span>
              )}
            </div>

            {apiData?.overview && (
              <div className="game-overview">
                <h2>Overview</h2>
                <p>{apiData.overview}</p>
              </div>
            )}
          </div>
        </div>

        <div className="details-sections">
          <section className="details-section">
            <h2>Your Collection Info</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Purchase Date</span>
                <span className="info-value">{formatDate(game.purchaseDate)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Completed Date</span>
                <span className="info-value">{formatDate(game.completedDate)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Added to Library</span>
                <span className="info-value">{formatDate(game.createdAt)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Last Updated</span>
                <span className="info-value">{formatDate(game.updatedAt)}</span>
              </div>
            </div>
            {game.notes && (
              <div className="notes-section">
                <h3>Notes</h3>
                <p>{game.notes}</p>
              </div>
            )}
          </section>

          {apiData && (
            <section className="details-section">
              <h2>Game Information</h2>
              <div className="info-grid">
                {apiData.release_date && (
                  <div className="info-item">
                    <span className="info-label">Release Date</span>
                    <span className="info-value">{formatDate(apiData.release_date)}</span>
                  </div>
                )}
                {apiData.region_id !== undefined && apiData.region_id !== null && (
                  <div className="info-item">
                    <span className="info-label">Region</span>
                    <span className="info-value">{getRegionName(apiData.region_id)}</span>
                  </div>
                )}
                {apiData.players && (
                  <div className="info-item">
                    <span className="info-label">Players</span>
                    <span className="info-value">{apiData.players}</span>
                  </div>
                )}
                {apiData.rating && (
                  <div className="info-item">
                    <span className="info-label">Rating</span>
                    <span className="info-value">{apiData.rating}</span>
                  </div>
                )}
                {apiData.coop && (
                  <div className="info-item">
                    <span className="info-label">Co-op</span>
                    <span className="info-value">{apiData.coop}</span>
                  </div>
                )}
                {publisherNames.length > 0 && (
                  <div className="info-item">
                    <span className="info-label">Publishers</span>
                    <span className="info-value">{publisherNames.join(', ')}</span>
                  </div>
                )}
                {developerNames.length > 0 && (
                  <div className="info-item">
                    <span className="info-label">Developers</span>
                    <span className="info-value">{developerNames.join(', ')}</span>
                  </div>
                )}
                {genreNames.length > 0 && (
                  <div className="info-item">
                    <span className="info-label">Genres</span>
                    <span className="info-value">{genreNames.join(', ')}</span>
                  </div>
                )}
                {apiData.last_updated && (
                  <div className="info-item">
                    <span className="info-label">Last Updated</span>
                    <span className="info-value">{formatDate(apiData.last_updated)}</span>
                  </div>
                )}
                {game.thegamesdbId && (
                  <div className="info-item">
                    <span className="info-label">TheGamesDB ID</span>
                    <span className="info-value">
                      <a 
                        href={`https://thegamesdb.net/game.php?id=${game.thegamesdbId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {game.thegamesdbId} →
                      </a>
                    </span>
                  </div>
                )}
              </div>
              
              {/* System Requirements Section */}
              {(apiData.os || apiData.processor || apiData.ram || apiData.hdd || apiData.video || apiData.sound) && (
                <>
                  <h3>System Requirements</h3>
                  <div className="info-grid">
                    {apiData.os && (
                      <div className="info-item">
                        <span className="info-label">OS</span>
                        <span className="info-value">{apiData.os}</span>
                      </div>
                    )}
                    {apiData.processor && (
                      <div className="info-item">
                        <span className="info-label">Processor</span>
                        <span className="info-value">{apiData.processor}</span>
                      </div>
                    )}
                    {apiData.ram && (
                      <div className="info-item">
                        <span className="info-label">RAM</span>
                        <span className="info-value">{apiData.ram}</span>
                      </div>
                    )}
                    {apiData.hdd && (
                      <div className="info-item">
                        <span className="info-label">Storage</span>
                        <span className="info-value">{apiData.hdd}</span>
                      </div>
                    )}
                    {apiData.video && (
                      <div className="info-item">
                        <span className="info-label">Video</span>
                        <span className="info-value">{apiData.video}</span>
                      </div>
                    )}
                    {apiData.sound && (
                      <div className="info-item">
                        <span className="info-label">Sound</span>
                        <span className="info-value">{apiData.sound}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {/* YouTube & Alternates */}
              {apiData.youtube && (
                <div className="youtube-section">
                  <h3>Trailer</h3>
                  <a 
                    href={`https://www.youtube.com/watch?v=${apiData.youtube}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="youtube-link"
                  >
                    🎥 Watch on YouTube
                  </a>
                </div>
              )}
              
              {apiData.alternates && apiData.alternates.length > 0 && (
                <div className="alternates-section">
                  <h3>Alternate Names</h3>
                  <p>{apiData.alternates.join(', ')}</p>
                </div>
              )}
            </section>
          )}

          {/* Game Recommendations - show if we have a TheGamesDB ID */}
          {game.thegamesdbId && (
            <GameRecommendations 
              gameId={game.thegamesdbId} 
              gameTitle={game.title} 
            />
          )}
        </div>
      </div>

      {editingGame && (
        <EditGameModal
          game={editingGame}
          onClose={() => setEditingGame(null)}
          onSave={handleEditGame}
        />
      )}
    </div>
  );
}
