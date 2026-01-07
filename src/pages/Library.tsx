import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { GameEntry, Platform, Format } from '../types';
import './Library.css';

// For MVP, we'll use localStorage for game storage
// In production, this would be connected to a backend
const GAMES_STORAGE_KEY = 'switch-library-games';

function loadGames(userId: string): GameEntry[] {
  try {
    const stored = localStorage.getItem(GAMES_STORAGE_KEY);
    if (stored) {
      const allGames = JSON.parse(stored) as GameEntry[];
      return allGames.filter(game => game.userId === userId);
    }
  } catch {
    console.error('Failed to load games');
  }
  return [];
}

function saveGames(games: GameEntry[]): void {
  try {
    // Load existing games from other users
    const stored = localStorage.getItem(GAMES_STORAGE_KEY);
    const allGames = stored ? JSON.parse(stored) as GameEntry[] : [];
    const otherUsersGames = allGames.filter(g => !games.some(ng => ng.userId === g.userId));
    localStorage.setItem(GAMES_STORAGE_KEY, JSON.stringify([...otherUsersGames, ...games]));
  } catch {
    console.error('Failed to save games');
  }
}

export function Library() {
  const { user } = useAuth();
  const [games, setGames] = useState<GameEntry[]>(() => 
    user ? loadGames(user.id) : []
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGames = games.filter(game => {
    const matchesPlatform = filterPlatform === 'all' || game.platform === filterPlatform;
    const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  const addGame = (game: Omit<GameEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    
    const newGame: GameEntry = {
      ...game,
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const updatedGames = [...games, newGame];
    setGames(updatedGames);
    saveGames(updatedGames);
    setShowAddModal(false);
  };

  const deleteGame = (id: string) => {
    const updatedGames = games.filter(g => g.id !== id);
    setGames(updatedGames);
    saveGames(updatedGames);
  };

  const stats = {
    total: games.length,
    switch: games.filter(g => g.platform === 'Nintendo Switch').length,
    switch2: games.filter(g => g.platform === 'Nintendo Switch 2').length,
    physical: games.filter(g => g.format === 'Physical').length,
    digital: games.filter(g => g.format === 'Digital').length,
  };

  return (
    <div className="library">
      <header className="library-header">
        <div>
          <h1>My Library</h1>
          <p className="library-stats">
            {stats.total} games • {stats.switch} Switch • {stats.switch2} Switch 2
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
            <GameCard key={game.id} game={game} onDelete={() => deleteGame(game.id)} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddGameModal
          onClose={() => setShowAddModal(false)}
          onAdd={addGame}
        />
      )}
    </div>
  );
}

interface GameCardProps {
  game: GameEntry;
  onDelete: () => void;
}

function GameCard({ game, onDelete }: GameCardProps) {
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
        <button 
          onClick={onDelete} 
          className="delete-btn"
          aria-label={`Delete ${game.title}`}
        >
          🗑️
        </button>
      </div>
    </article>
  );
}

interface AddGameModalProps {
  onClose: () => void;
  onAdd: (game: Omit<GameEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
}

function AddGameModal({ onClose, onAdd }: AddGameModalProps) {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<Platform>('Nintendo Switch');
  const [format, setFormat] = useState<Format>('Physical');
  const [barcode, setBarcode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAdd({
      title: title.trim(),
      platform,
      format,
      barcode: barcode.trim() || undefined,
      status: 'Owned',
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="modal-title">Add Game</h2>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            ✕
          </button>
        </header>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="title">Game Title *</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter game title"
              required
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="platform">Platform</label>
              <select
                id="platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
              >
                <option value="Nintendo Switch">Nintendo Switch</option>
                <option value="Nintendo Switch 2">Nintendo Switch 2</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="format">Format</label>
              <select
                id="format"
                value={format}
                onChange={(e) => setFormat(e.target.value as Format)}
              >
                <option value="Physical">Physical</option>
                <option value="Digital">Digital</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="barcode">Barcode (optional)</label>
            <input
              id="barcode"
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Enter UPC/EAN barcode"
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={!title.trim()}>
              Add Game
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
