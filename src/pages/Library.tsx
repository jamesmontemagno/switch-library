import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { GameEntry, Platform } from '../types';
import { loadGames, saveGame, deleteGame as deleteGameFromDb } from '../services/database';
import { AddGameModal } from '../components/AddGameModal';
import { EditGameModal } from '../components/EditGameModal';
import './Library.css';

export function Library() {
  const { user } = useAuth();
  const [games, setGames] = useState<GameEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGame, setEditingGame] = useState<GameEntry | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load games on mount
  const fetchGames = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const userGames = await loadGames(user.id);
      setGames(userGames);
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const filteredGames = games.filter(game => {
    const matchesPlatform = filterPlatform === 'all' || game.platform === filterPlatform;
    const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  const addGame = async (game: Omit<GameEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    
    const newGame: GameEntry = {
      ...game,
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const savedGame = await saveGame(newGame, games);
    if (savedGame) {
      setGames(prev => [...prev, savedGame]);
    }
    setShowAddModal(false);
  };

  const handleDeleteGame = async (id: string) => {
    const success = await deleteGameFromDb(id);
    if (success) {
      setGames(prev => prev.filter(g => g.id !== id));
    }
  };

  const handleEditGame = async (updatedGame: GameEntry) => {
    const savedGame = await saveGame(updatedGame, games);
    if (savedGame) {
      setGames(prev => prev.map(g => g.id === savedGame.id ? savedGame : g));
    }
    setEditingGame(null);
  };

  const stats = {
    total: games.length,
    switch: games.filter(g => g.platform === 'Nintendo Switch').length,
    switch2: games.filter(g => g.platform === 'Nintendo Switch 2').length,
    physical: games.filter(g => g.format === 'Physical').length,
    digital: games.filter(g => g.format === 'Digital').length,
    completed: games.filter(g => g.completed).length,
  };

  if (isLoading) {
    return (
      <div className="library">
        <div className="loading-container">
          <div className="loading-spinner" aria-label="Loading" />
          <p>Loading your library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="library">
      <header className="library-header">
        <div>
          <h1>My Library</h1>
          <p className="library-stats">
            {stats.total} games • {stats.completed} completed • {stats.switch} Switch • {stats.switch2} Switch 2
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-add">
          + Add Game
        </button>
      </header>

      <div className="library-toolbar">
        <input
          type="search"
          placeholder="Search games..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          aria-label="Search games"
        />
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value as Platform | 'all')}
          className="filter-select"
          aria-label="Filter by platform"
        >
          <option value="all">All Platforms</option>
          <option value="Nintendo Switch">Nintendo Switch</option>
          <option value="Nintendo Switch 2">Nintendo Switch 2</option>
        </select>
      </div>

      {filteredGames.length === 0 ? (
        <div className="empty-state">
          {games.length === 0 ? (
            <>
              <div className="empty-icon">🎮</div>
              <h2>No games yet</h2>
              <p>Start building your collection by adding your first game!</p>
              <button onClick={() => setShowAddModal(true)} className="btn-add">
                + Add Your First Game
              </button>
            </>
          ) : (
            <>
              <div className="empty-icon">🔍</div>
              <h2>No matches found</h2>
              <p>Try adjusting your search or filters.</p>
            </>
          )}
        </div>
      ) : (
        <div className="games-grid">
          {filteredGames.map(game => (
            <GameCard 
              key={game.id} 
              game={game} 
              onDelete={() => handleDeleteGame(game.id)}
              onEdit={() => setEditingGame(game)}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddGameModal
          onClose={() => setShowAddModal(false)}
          onAdd={addGame}
        />
      )}
      
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

interface GameCardProps {
  game: GameEntry;
  onDelete: () => void;
  onEdit: () => void;
}

function GameCard({ game, onDelete, onEdit }: GameCardProps) {
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <article className="game-card">
      <div className="game-cover">
        {game.coverUrl ? (
          <img src={game.coverUrl} alt={game.title} />
        ) : (
          <div className="cover-placeholder">
            <span>🎮</span>
          </div>
        )}
        {game.completed && (
          <div className="completed-badge" title="Completed">
            ✓
          </div>
        )}
      </div>
      <div className="game-info">
        <h3 className="game-title">{game.title}</h3>
        <div className="game-meta">
          <span className={`platform-tag ${game.platform === 'Nintendo Switch' ? 'switch' : 'switch2'}`}>
            {game.platform === 'Nintendo Switch' ? 'Switch' : 'Switch 2'}
          </span>
          <span className={`format-tag ${game.format.toLowerCase()}`}>
            {game.format}
          </span>
        </div>
        {(game.purchaseDate || game.completedDate) && (
          <div className="game-dates">
            {game.purchaseDate && (
              <span className="date-info" title="Purchase Date">
                🛒 {formatDate(game.purchaseDate)}
              </span>
            )}
            {game.completedDate && (
              <span className="date-info" title="Completion Date">
                🏆 {formatDate(game.completedDate)}
              </span>
            )}
          </div>
        )}
        <div className="game-actions">
          <button 
            onClick={onEdit} 
            className="edit-btn"
            aria-label={`Edit ${game.title}`}
          >
            ✏️
          </button>
          <button 
            onClick={onDelete} 
            className="delete-btn"
            aria-label={`Delete ${game.title}`}
          >
            🗑️
          </button>
        </div>
      </div>
    </article>
  );
}


