import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { GameEntry } from '../types';
import { loadGames, saveGame } from '../services/database';
import { getGameById, getGameImages, getBoxartUrl } from '../services/thegamesdb';
import type { TheGamesDBGame } from '../services/thegamesdb';
import { EditGameModal } from '../components/EditGameModal';
import './GameDetails.css';

export function GameDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameEntry | null>(null);
  const [apiData, setApiData] = useState<TheGamesDBGame | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingGame, setEditingGame] = useState<GameEntry | null>(null);

  useEffect(() => {
    async function fetchGameDetails() {
      if (!user || !id) {
        setIsLoading(false);
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
          setApiData(gameData);
          
          // If we don't have a cover URL yet, try to get one
          if (!foundGame.coverUrl && gameData) {
            const images = await getGameImages(foundGame.thegamesdbId);
            const coverUrl = getBoxartUrl(images, foundGame.thegamesdbId);
            if (coverUrl) {
              const updatedGame = { ...foundGame, coverUrl };
              await saveGame(updatedGame);
              setGame(updatedGame);
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
  }, [id, user, navigate]);

  const handleEditGame = async (updatedGame: GameEntry) => {
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
          ✏️ Edit Game
        </button>
      </div>

      <div className="details-content">
        <div className="details-hero">
          <div className="hero-cover">
            {game.coverUrl ? (
              <img src={game.coverUrl} alt={game.title} />
            ) : (
              <div className="cover-placeholder-large">
                <span>🎮</span>
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
                <span className="completed-tag">
                  ✓ Completed
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
            </section>
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
