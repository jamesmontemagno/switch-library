import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import type { GameEntry, Platform, ShareProfile } from '../types';
import { loadGames, saveGame, deleteGame as deleteGameFromDb, getShareProfile, enableSharing, disableSharing, regenerateShareId, updateSharePrivacy, updateDisplayName, getUserProfile } from '../services/database';
import { ManualAddGameModal } from '../components/ManualAddGameModal';
import { EditGameModal } from '../components/EditGameModal';
import './Library.css';

type SortOption = 'title_asc' | 'title_desc' | 'added_newest' | 'added_oldest' | 'purchase_newest' | 'purchase_oldest' | 'platform' | 'format' | 'completed_first' | 'not_completed_first';
type ViewMode = 'grid' | 'list' | 'compact';
type FormatFilter = 'all' | 'Physical' | 'Digital';

export function Library() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { preferences, updatePreferences } = usePreferences();
  const [games, setGames] = useState<GameEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGame, setEditingGame] = useState<GameEntry | null>(null);
  const [gameToDelete, setGameToDelete] = useState<GameEntry | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>(preferences.library?.filterPlatform || 'all');
  const [filterFormat, setFilterFormat] = useState<FormatFilter>(preferences.library?.filterFormat || 'all');
  const [filterCompleted, setFilterCompleted] = useState<'all' | 'completed' | 'not_completed'>(preferences.library?.filterCompleted || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(preferences.library?.sortBy || 'added_newest');
  const [viewMode, setViewMode] = useState<ViewMode>(preferences.library?.viewMode || 'grid');
  
  // Share state
  const [shareProfile, setShareProfile] = useState<ShareProfile | null>(null);
  const [isLoadingShare, setIsLoadingShare] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Profile editing state
  const [displayName, setDisplayName] = useState('');
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  // Save preferences when filters/sort/view change
  useEffect(() => {
    updatePreferences({
      library: {
        filterPlatform,
        filterFormat,
        filterCompleted,
        sortBy,
        viewMode,
      },
    });
  }, [filterPlatform, filterFormat, filterCompleted, sortBy, viewMode, updatePreferences]);

  // Load games on mount
  const fetchGames = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [userGames, userShareProfile, userProfile] = await Promise.all([
        loadGames(user.id),
        getShareProfile(user.id),
        getUserProfile(user.id)
      ]);
      setGames(userGames);
      setShareProfile(userShareProfile);
      if (userProfile) {
        setDisplayName(userProfile.displayName);
      }
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const filteredGames = games
    .filter(game => {
      const matchesPlatform = filterPlatform === 'all' || game.platform === filterPlatform;
      const matchesFormat = filterFormat === 'all' || game.format === filterFormat;
      const matchesCompleted = filterCompleted === 'all' || 
        (filterCompleted === 'completed' && game.completed) || 
        (filterCompleted === 'not_completed' && !game.completed);
      const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPlatform && matchesFormat && matchesCompleted && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title_asc':
          return a.title.localeCompare(b.title);
        case 'title_desc':
          return b.title.localeCompare(a.title);
        case 'added_newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'added_oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'purchase_newest':
          if (!a.purchaseDate && !b.purchaseDate) return 0;
          if (!a.purchaseDate) return 1;
          if (!b.purchaseDate) return -1;
          return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
        case 'purchase_oldest':
          if (!a.purchaseDate && !b.purchaseDate) return 0;
          if (!a.purchaseDate) return 1;
          if (!b.purchaseDate) return -1;
          return new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();
        case 'platform':
          return a.platform.localeCompare(b.platform);
        case 'format':
          return a.format.localeCompare(b.format);
        case 'completed_first':
          return (b.completed ? 1 : 0) - (a.completed ? 1 : 0);
        case 'not_completed_first':
          return (a.completed ? 1 : 0) - (b.completed ? 1 : 0);
        default:
          return 0;
      }
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
    const gameToDelete = games.find(g => g.id === id);
    if (gameToDelete) {
      setGameToDelete(gameToDelete);
    }
  };

  const confirmDelete = async () => {
    if (!gameToDelete) return;
    
    const success = await deleteGameFromDb(gameToDelete.id);
    if (success) {
      setGames(prev => prev.filter(g => g.id !== gameToDelete.id));
    }
    setGameToDelete(null);
  };

  const handleEditGame = async (updatedGame: GameEntry) => {
    const savedGame = await saveGame(updatedGame, games);
    if (savedGame) {
      setGames(prev => prev.map(g => g.id === savedGame.id ? savedGame : g));
    }
    setEditingGame(null);
  };

  // Share handlers
  const handleToggleSharing = async () => {
    if (!user) return;
    setIsLoadingShare(true);
    try {
      if (shareProfile?.enabled) {
        const success = await disableSharing(user.id);
        if (success) {
          setShareProfile(prev => prev ? { ...prev, enabled: false } : null);
        }
      } else {
        const newProfile = await enableSharing(user.id);
        if (newProfile) {
          setShareProfile(newProfile);
        }
      }
    } catch (error) {
      console.error('Failed to toggle sharing:', error);
    } finally {
      setIsLoadingShare(false);
    }
  };

  const handleRegenerateLink = async () => {
    if (!user) return;
    setIsLoadingShare(true);
    try {
      const newProfile = await regenerateShareId(user.id);
      if (newProfile) {
        setShareProfile(newProfile);
      }
    } catch (error) {
      console.error('Failed to regenerate link:', error);
    } finally {
      setIsLoadingShare(false);
    }
  };

  const getShareUrl = () => {
    if (!shareProfile) return '';
    const baseUrl = window.location.origin + import.meta.env.BASE_URL;
    return `${baseUrl}shared/${shareProfile.shareId}`;
  };

  const handleCopyLink = async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  // Display name handler
  const handleSaveDisplayName = async () => {
    if (!user || !displayName.trim()) return;
    setSavingDisplayName(true);
    try {
      const success = await updateDisplayName(user.id, displayName.trim());
      if (success) {
        setEditingDisplayName(false);
      }
    } catch (error) {
      console.error('Failed to update display name:', error);
    } finally {
      setSavingDisplayName(false);
    }
  };

  // Privacy toggle handlers
  const handleToggleShowName = async () => {
    if (!user || !shareProfile) return;
    setIsLoadingShare(true);
    try {
      const updated = await updateSharePrivacy(user.id, { 
        showDisplayName: !shareProfile.showDisplayName 
      });
      if (updated) {
        setShareProfile(updated);
      }
    } catch (error) {
      console.error('Failed to toggle show name:', error);
    } finally {
      setIsLoadingShare(false);
    }
  };

  const handleToggleShowAvatar = async () => {
    if (!user || !shareProfile) return;
    setIsLoadingShare(true);
    try {
      const updated = await updateSharePrivacy(user.id, { 
        showAvatar: !shareProfile.showAvatar 
      });
      if (updated) {
        setShareProfile(updated);
      }
    } catch (error) {
      console.error('Failed to toggle show avatar:', error);
    } finally {
      setIsLoadingShare(false);
    }
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
        <div className="header-actions">
          <button 
            onClick={() => setShowSharePanel(!showSharePanel)} 
            className={`btn-share ${shareProfile?.enabled ? 'active' : ''}`}
          >
            🔗 {showSharePanel ? 'Hide Sharing' : 'Share'}
          </button>
          <button onClick={() => navigate('/search')} className="btn-search">
            🔍 Search Games
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-add">
            + Add Manually
          </button>
        </div>
      </header>

      {/* Share Panel */}
      {showSharePanel && (
        <div className="share-panel">
          <div className="share-panel-header">
            <h3>🔗 Share Your Library</h3>
            <p>Share your collection with friends or compare libraries</p>
          </div>
          
          {/* Profile Settings */}
          <div className="share-section">
            <h4>👤 Display Name</h4>
            <div className="profile-edit-row">
              {editingDisplayName ? (
                <>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="profile-input"
                    placeholder="Your display name"
                  />
                  <button 
                    onClick={handleSaveDisplayName} 
                    disabled={savingDisplayName || !displayName.trim()}
                    className="btn-save-profile"
                  >
                    {savingDisplayName ? '...' : '✓ Save'}
                  </button>
                  <button 
                    onClick={() => setEditingDisplayName(false)}
                    className="btn-cancel-profile"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <span className="current-name">{displayName || 'Not set'}</span>
                  <button 
                    onClick={() => setEditingDisplayName(true)}
                    className="btn-edit-profile"
                  >
                    ✏️ Edit
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="share-section">
            <h4>⚙️ Sharing Settings</h4>
            <div className="share-panel-content">
              <div className="share-toggle-row">
                <span>Sharing is {shareProfile?.enabled ? 'enabled' : 'disabled'}</span>
                <button
                  onClick={handleToggleSharing}
                  disabled={isLoadingShare}
                  className={`btn-toggle ${shareProfile?.enabled ? 'on' : 'off'}`}
                >
                  {isLoadingShare ? '...' : shareProfile?.enabled ? 'ON' : 'OFF'}
                </button>
              </div>
              
              {shareProfile?.enabled && (
                <>
                  <div className="share-link-row">
                    <input
                      type="text"
                      value={getShareUrl()}
                      readOnly
                      className="share-url-input"
                    />
                    <button onClick={handleCopyLink} className="btn-copy">
                      {copySuccess ? '✓ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                  
                  {/* Privacy Settings */}
                  <div className="privacy-settings">
                    <h5>🔒 Privacy</h5>
                    <div className="privacy-toggle-row">
                      <span>Show my display name</span>
                      <button
                        onClick={handleToggleShowName}
                        disabled={isLoadingShare}
                        className={`btn-toggle small ${shareProfile?.showDisplayName ? 'on' : 'off'}`}
                      >
                        {shareProfile?.showDisplayName ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    <div className="privacy-toggle-row">
                      <span>Show my avatar</span>
                      <button
                        onClick={handleToggleShowAvatar}
                        disabled={isLoadingShare}
                        className={`btn-toggle small ${shareProfile?.showAvatar ? 'on' : 'off'}`}
                      >
                        {shareProfile?.showAvatar ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="share-actions-row">
                    <button 
                      onClick={handleRegenerateLink} 
                      className="btn-regenerate"
                      disabled={isLoadingShare}
                    >
                      🔄 Generate New Link
                    </button>
                    <button 
                      onClick={() => navigate(`/shared/${shareProfile.shareId}`)}
                      className="btn-preview"
                    >
                      👁️ Preview
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
        <select
          value={filterFormat}
          onChange={(e) => setFilterFormat(e.target.value as FormatFilter)}
          className="filter-select"
          aria-label="Filter by format"
        >
          <option value="all">All Formats</option>
          <option value="Physical">Physical</option>
          <option value="Digital">Digital</option>
        </select>
        <select
          value={filterCompleted}
          onChange={(e) => setFilterCompleted(e.target.value as 'all' | 'completed' | 'not_completed')}
          className="filter-select"
          aria-label="Filter by completion"
        >
          <option value="all">All Games</option>
          <option value="completed">Completed</option>
          <option value="not_completed">Not Completed</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="filter-select sort-select"
          aria-label="Sort by"
        >
          <option value="added_newest">Added (Newest)</option>
          <option value="added_oldest">Added (Oldest)</option>
          <option value="title_asc">Title (A-Z)</option>
          <option value="title_desc">Title (Z-A)</option>
          <option value="purchase_newest">Purchased (Newest)</option>
          <option value="purchase_oldest">Purchased (Oldest)</option>
          <option value="platform">Platform</option>
          <option value="format">Format</option>
          <option value="completed_first">Completed First</option>
          <option value="not_completed_first">Not Completed First</option>
        </select>
        <div className="view-toggle">
          <button
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            ▦
          </button>
          <button
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            ☰
          </button>
          <button
            className={`view-btn ${viewMode === 'compact' ? 'active' : ''}`}
            onClick={() => setViewMode('compact')}
            title="Compact View"
          >
            ▤
          </button>
        </div>
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
        <>
          <div className="results-info">
            Showing {filteredGames.length} of {games.length} games
          </div>
          <div className={`games-${viewMode}`}>
            {filteredGames.map(game => (
              <GameCard 
                key={game.id} 
                game={game} 
                viewMode={viewMode}
                onDelete={() => handleDeleteGame(game.id)}
                onEdit={() => setEditingGame(game)}
              />
            ))}
          </div>
        </>
      )}

      {showAddModal && (
        <ManualAddGameModal
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
      
      {gameToDelete && (
        <div className="modal-overlay" onClick={() => setGameToDelete(null)}>
          <div className="delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>⚠️ Delete Game</h2>
              <button onClick={() => setGameToDelete(null)} className="modal-close">✕</button>
            </header>
            <div className="modal-content">
              <p>Are you sure you want to delete <strong>{gameToDelete.title}</strong> from your library?</p>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setGameToDelete(null)}>
                Cancel
              </button>
              <button className="btn-delete" onClick={confirmDelete}>
                Delete Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface GameCardProps {
  game: GameEntry;
  viewMode: ViewMode;
  onDelete: () => void;
  onEdit: () => void;
}

function GameCard({ game, viewMode, onDelete, onEdit }: GameCardProps) {
  const navigate = useNavigate();
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons
    if ((e.target as HTMLElement).closest('.game-actions')) {
      return;
    }
    navigate(`/game/${game.id}`);
  };

  // Compact view - minimal info in a row
  if (viewMode === 'compact') {
    return (
      <article className="game-card compact" onClick={handleCardClick}>
        <div className="compact-cover">
          {game.coverUrl ? (
            <img src={game.coverUrl} alt={game.title} />
          ) : (
            <div className="cover-placeholder-small">🎮</div>
          )}
        </div>
        <div className="compact-info">
          <h3 className="compact-title">{game.title}</h3>
          <div className="compact-meta">
            <span className={`platform-tag small ${game.platform === 'Nintendo Switch' ? 'switch' : 'switch2'}`}>
              {game.platform === 'Nintendo Switch' ? 'Switch' : 'Switch 2'}
            </span>
            <span className={`format-tag small ${game.format.toLowerCase()}`}>
              {game.format}
            </span>
            {game.completed && <span className="completed-tag">✓ Completed</span>}
          </div>
        </div>
        <div className="compact-actions">
          <button onClick={onEdit} className="edit-btn" aria-label={`Edit ${game.title}`}>✏️</button>
          <button onClick={onDelete} className="delete-btn" aria-label={`Delete ${game.title}`}>🗑️</button>
        </div>
      </article>
    );
  }

  // List view - horizontal card with more details
  if (viewMode === 'list') {
    return (
      <article className="game-card list" onClick={handleCardClick}>
        <div className="list-cover">
          {game.coverUrl ? (
            <img src={game.coverUrl} alt={game.title} />
          ) : (
            <div className="cover-placeholder">
              <span>🎮</span>
            </div>
          )}
          {game.completed && (
            <div className="completed-badge" title="Completed">✓</div>
          )}
        </div>
        <div className="list-info">
          <h3 className="game-title">{game.title}</h3>
          <div className="game-meta">
            <span className={`platform-tag ${game.platform === 'Nintendo Switch' ? 'switch' : 'switch2'}`}>
              {game.platform === 'Nintendo Switch' ? 'Switch' : 'Switch 2'}
            </span>
            <span className={`format-tag ${game.format.toLowerCase()}`}>
              {game.format}
            </span>
          </div>
          <div className="list-details">
            {game.purchaseDate && (
              <span className="date-info">🛒 Purchased: {formatDate(game.purchaseDate)}</span>
            )}
            {game.completedDate && (
              <span className="date-info">🏆 Completed: {formatDate(game.completedDate)}</span>
            )}
            {game.notes && (
              <p className="list-notes">{game.notes}</p>
            )}
          </div>
        </div>
        <div className="list-actions">
          <button onClick={onEdit} className="edit-btn" aria-label={`Edit ${game.title}`}>✏️</button>
          <button onClick={onDelete} className="delete-btn" aria-label={`Delete ${game.title}`}>🗑️</button>
        </div>
      </article>
    );
  }

  // Grid view (default)
  return (
    <article className="game-card grid" onClick={handleCardClick}>
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


