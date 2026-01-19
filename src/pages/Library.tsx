import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { useSEO } from '../hooks/useSEO';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { GameEntry, Platform, ShareProfile } from '../types';
import { loadGames, saveGame, deleteGame as deleteGameFromDb, getShareProfile } from '../services/database';
import { cacheLibraryData, loadCachedLibraryData } from '../services/offlineCache';
import { EditGameModal } from '../components/EditGameModal';
import { ShareLibraryModal } from '../components/ShareLibraryModal';
import { SharePromptBanner } from '../components/SharePromptBanner';
import { SegmentedControl } from '../components/SegmentedControl';
import { Button } from '../components/Button';
import { logger } from '../services/logger';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPenToSquare, faGamepad, faTrash, faCartShopping, faTrophy, faLink, faMagnifyingGlass, faTableCells, faList, faGripLines, faPlus, faStar } from '@fortawesome/free-solid-svg-icons';
import './Library.css';

const DISMISSED_SHARE_PROMPT_KEY = 'dismissedSharePrompt';

type SortOption = 'title_asc' | 'title_desc' | 'added_newest' | 'added_oldest' | 'purchase_newest' | 'purchase_oldest' | 'platform' | 'format' | 'completed_first' | 'not_completed_first';
type ViewMode = 'grid' | 'list' | 'compact';
type FormatFilter = 'all' | 'Physical' | 'Digital';

export function Library() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { preferences, updatePreferences } = usePreferences();
  const isOnline = useOnlineStatus();
  
  logger.component('Library', 'mount');
  
  useSEO({
    title: 'My Library - My Switch Library',
    description: 'Manage your Nintendo Switch game collection. Sort, filter, and organize your physical and digital games across Nintendo Switch and Switch 2.',
    url: 'https://myswitchlibrary.com/library',
  });
  
  const [games, setGames] = useState<GameEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingGame, setEditingGame] = useState<GameEntry | null>(null);
  const [gameToDelete, setGameToDelete] = useState<GameEntry | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>(preferences.library?.filterPlatform || 'all');
  const [filterFormat, setFilterFormat] = useState<FormatFilter>(preferences.library?.filterFormat || 'all');
  const [filterCompleted, setFilterCompleted] = useState<'all' | 'completed' | 'not_completed'>(preferences.library?.filterCompleted || 'all');
  const [filterBestPick, setFilterBestPick] = useState<'all' | 'best_picks_only' | 'not_best_picks'>(preferences.library?.filterBestPick || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(preferences.library?.sortBy || 'added_newest');
  const [viewMode, setViewMode] = useState<ViewMode>(preferences.library?.viewMode || 'grid');
  
  // Mobile filters toggle
  const [showFilters, setShowFilters] = useState(false);
  
  // Share state
  const [shareProfile, setShareProfile] = useState<ShareProfile | null>(null);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [dismissedSharePrompt, setDismissedSharePrompt] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_SHARE_PROMPT_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Save preferences when filters/sort/view change
  useEffect(() => {
    updatePreferences({
      library: {
        filterPlatform,
        filterFormat,
        filterCompleted,
        filterBestPick,
        sortBy,
        viewMode,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterPlatform, filterFormat, filterCompleted, filterBestPick, sortBy, viewMode]);

  // Load games on mount
  const fetchGames = useCallback(async () => {
    if (!user) return;
    logger.info('Fetching library games', { userId: user.id });
    
    // Load from cache immediately for instant display
    const cachedGames = loadCachedLibraryData(user.id);
    if (cachedGames) {
      setGames(cachedGames);
      setIsLoading(false);
      logger.info('Library data loaded from cache instantly', { gamesCount: cachedGames.length });
    } else {
      setIsLoading(true);
    }
    
    try {
      if (isOnline) {
        // Online: fetch fresh data from database and update cache
        const [userGames, userShareProfile] = await Promise.all([
          loadGames(user.id),
          getShareProfile(user.id)
        ]);
        setGames(userGames);
        setShareProfile(userShareProfile);
        
        // Cache for offline use and future instant loads
        cacheLibraryData(user.id, userGames);
        
        logger.info('Library data refreshed from database', { 
          gamesCount: userGames.length, 
          hasShareProfile: !!userShareProfile 
        });
      } else {
        // Offline: we already loaded from cache above
        if (!cachedGames) {
          logger.info('No cached library data available');
          setGames([]);
        }
        // Don't fetch share profile when offline
        setShareProfile(null);
      }
    } catch (error) {
      console.error('Failed to load games:', error);
      // If we didn't have cache and there's an error, try loading from cache one more time
      if (!cachedGames) {
        const fallbackCachedGames = loadCachedLibraryData(user.id);
        if (fallbackCachedGames) {
          setGames(fallbackCachedGames);
        }
      }
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // isOnline intentionally omitted - we check it at runtime but don't want to refetch on status changes

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
      const matchesBestPick = filterBestPick === 'all' ||
        (filterBestPick === 'best_picks_only' && game.isBestPick) ||
        (filterBestPick === 'not_best_picks' && !game.isBestPick);
      const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPlatform && matchesFormat && matchesCompleted && matchesBestPick && matchesSearch;
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

  const handleDeleteGame = async (id: string) => {
    // Prevent deletion when offline
    if (!isOnline) {
      alert('You are offline. Game deletion is not available in offline mode.');
      return;
    }
    
    const gameToDelete = games.find(g => g.id === id);
    if (gameToDelete) {
      setGameToDelete(gameToDelete);
    }
  };

  const confirmDelete = async () => {
    if (!gameToDelete) return;
    
    // Double-check online status
    if (!isOnline) {
      alert('You are offline. Game deletion is not available in offline mode.');
      setGameToDelete(null);
      return;
    }
    
    const success = await deleteGameFromDb(gameToDelete.id);
    if (success) {
      setGames(prev => prev.filter(g => g.id !== gameToDelete.id));
    }
    setGameToDelete(null);
  };

  const handleEditGame = async (updatedGame: GameEntry) => {
    // Prevent editing when offline
    if (!isOnline) {
      alert('You are offline. Game editing is not available in offline mode.');
      setEditingGame(null);
      return;
    }
    
    const savedGame = await saveGame(updatedGame, games);
    if (savedGame) {
      setGames(prev => prev.map(g => g.id === savedGame.id ? savedGame : g));
    }
    setEditingGame(null);
  };

  const handleSharingEnabled = async () => {
    // Prevent sharing changes when offline
    if (!isOnline) {
      return;
    }
    
    // Refresh share profile after enabling sharing in modal
    if (!user) return;
    try {
      const updatedProfile = await getShareProfile(user.id);
      setShareProfile(updatedProfile);
    } catch (error) {
      console.error('Failed to refresh share profile:', error);
    }
  };

  const handleDismissSharePrompt = () => {
    setDismissedSharePrompt(true);
    try {
      localStorage.setItem(DISMISSED_SHARE_PROMPT_KEY, 'true');
    } catch (error) {
      console.error('Failed to save dismissal preference:', error);
    }
  };

  const handleSharePromptClick = () => {
    setShowSharePanel(true);
  };

  // Show share prompt if:
  // 1. User has at least one game
  // 2. Sharing is not enabled
  // 3. User hasn't dismissed the prompt
  const shouldShowSharePrompt = games.length > 0 && !shareProfile?.enabled && !dismissedSharePrompt;

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
          <Button
            variant="secondary"
            size="lg"
            icon={<FontAwesomeIcon icon={faLink} />}
            onClick={() => {
              if (!isOnline) {
                alert('You are offline. Sharing settings are not available in offline mode.');
                return;
              }
              setShowSharePanel(!showSharePanel);
            }}
            className={`btn-share ${shareProfile?.enabled ? 'active' : ''}`}
            disabled={!isOnline}
            title={!isOnline ? 'Sharing not available offline' : undefined}
          >
            {showSharePanel ? 'Hide Sharing' : 'Share'}
          </Button>
          <Button
            variant="primary"
            size="lg"
            icon={<FontAwesomeIcon icon={faPlus} />}
            onClick={() => {
              if (!isOnline) {
                alert('You are offline. Adding games is not available in offline mode.');
                return;
              }
              navigate('/search');
            }}
            disabled={!isOnline}
            title={!isOnline ? 'Adding games not available offline' : undefined}
          >
            Add Games
          </Button>
        </div>
      </header>

      {/* Share Library Modal */}
      {showSharePanel && user && (
        <ShareLibraryModal 
          userId={user.id} 
          onClose={() => setShowSharePanel(false)}
          onSharingEnabled={handleSharingEnabled}
        />
      )}

      {/* Mobile Toolbar Header */}
      <div className="toolbar-mobile-header">
        <button 
          className="btn-toggle-filters"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          aria-label="Toggle filters and sort"
        >
          <span>🔧 Filters & Sort</span>
          <span className="toggle-icon">{showFilters ? '▲' : '▼'}</span>
        </button>
        <div className="view-toggle-mobile">
          <SegmentedControl
            options={[
              { value: 'grid', label: 'Grid View', icon: <FontAwesomeIcon icon={faTableCells} /> },
              { value: 'compact', label: 'Compact View', icon: <FontAwesomeIcon icon={faGripLines} /> },
            ]}
            value={viewMode}
            onChange={setViewMode}
            ariaLabel="View mode"
            variant="buttons"
            size="sm"
            iconOnly
          />
        </div>
      </div>

      <div className={`library-toolbar ${showFilters ? 'toolbar-expanded' : 'toolbar-collapsed'}`}>
        <input
          type="search"
          placeholder="Search library..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          aria-label="Search library"
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
          value={filterBestPick}
          onChange={(e) => setFilterBestPick(e.target.value as 'all' | 'best_picks_only' | 'not_best_picks')}
          className="filter-select"
          aria-label="Filter by best pick"
        >
          <option value="all">All Games</option>
          <option value="best_picks_only">⭐ Best Picks Only</option>
          <option value="not_best_picks">Not Best Picks</option>
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
        <div className="view-toggle-desktop">
          <SegmentedControl
            options={[
              { value: 'grid', label: 'Grid View', icon: <FontAwesomeIcon icon={faTableCells} /> },
              { value: 'list', label: 'List View', icon: <FontAwesomeIcon icon={faList} /> },
              { value: 'compact', label: 'Compact View', icon: <FontAwesomeIcon icon={faGripLines} /> },
            ]}
            value={viewMode}
            onChange={setViewMode}
            ariaLabel="View mode"
            variant="buttons"
            size="sm"
            iconOnly
          />
        </div>
      </div>

      {/* Share Prompt Banner */}
      {shouldShowSharePrompt && (
        <SharePromptBanner 
          onShareClick={handleSharePromptClick}
          onDismiss={handleDismissSharePrompt}
        />
      )}

      {filteredGames.length === 0 ? (
        <div className="empty-state">
          {games.length === 0 ? (
            <>
              <div className="empty-icon"><FontAwesomeIcon icon={faGamepad} /></div>
              <h2>No games yet</h2>
              <p>Start building your collection by adding your first game!</p>
              <Button
                variant="primary"
                size="lg"
                icon={<FontAwesomeIcon icon={faPlus} />}
                onClick={() => navigate('/search')}
              >
                Add Games
              </Button>
            </>
          ) : (
            <>
              <div className="empty-icon"><FontAwesomeIcon icon={faMagnifyingGlass} /></div>
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
                isOnline={isOnline}
              />
            ))}
          </div>
        </>
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
              <Button
                variant="secondary"
                size="md"
                onClick={() => setGameToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={confirmDelete}
              >
                Delete Game
              </Button>
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
  isOnline: boolean;
}

function GameCard({ game, viewMode, onDelete, onEdit, isOnline }: GameCardProps) {
  const navigate = useNavigate();
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons
    const target = e.target as HTMLElement;
    if (target.closest('.game-actions') || target.closest('.list-actions') || target.closest('.compact-actions')) {
      return;
    }
    
    // Prevent navigation to details when offline
    if (!isOnline) {
      alert('You are offline. Game details cannot be viewed in offline mode.');
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
            <div className="cover-placeholder-small"><FontAwesomeIcon icon={faGamepad} /></div>
          )}
          {game.isBestPick && (
            <div className="best-pick-badge small" title="Best Pick">
              <FontAwesomeIcon icon={faStar} />
            </div>
          )}
        </div>
        <div className="compact-info">
          <h3 className="compact-title">
            {game.isBestPick && <FontAwesomeIcon icon={faStar} style={{ color: '#fbbf24', marginRight: '0.3rem', fontSize: '0.85em' }} />}
            {game.title}
          </h3>
          <div className="compact-meta">
            <span className={`platform-tag small ${game.platform === 'Nintendo Switch' ? 'switch' : 'switch2'}`}>
              {game.platform === 'Nintendo Switch' ? 'Switch' : 'Switch 2'}
            </span>
            <span className={`format-tag small ${game.format.toLowerCase()}`}>
              {game.format}
            </span>
            <span className={`completed-checkbox ${game.completed ? 'checked' : ''}`} title={game.completed ? 'Completed' : 'Not completed'}>
              {game.completed && <FontAwesomeIcon icon={faCheck} />}
            </span>
          </div>
        </div>
        <div className="compact-actions">
          <button onClick={onEdit} className="edit-btn" aria-label={`Edit ${game.title}`} disabled={!isOnline} title={!isOnline ? 'Editing not available offline' : undefined}><FontAwesomeIcon icon={faPenToSquare} /></button>
          <button onClick={onDelete} className="delete-btn" aria-label={`Delete ${game.title}`} disabled={!isOnline} title={!isOnline ? 'Deleting not available offline' : undefined}><FontAwesomeIcon icon={faTrash} /></button>
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
              <FontAwesomeIcon icon={faGamepad} />
            </div>
          )}
          {game.isBestPick && (
            <div className="best-pick-badge" title="Best Pick">
              <FontAwesomeIcon icon={faStar} />
            </div>
          )}
        </div>
        <div className="list-info">
          <h3 className="game-title">
            {game.isBestPick && <FontAwesomeIcon icon={faStar} style={{ color: '#fbbf24', marginRight: '0.5rem' }} />}
            {game.title}
          </h3>
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
              <span className="date-info"><FontAwesomeIcon icon={faCartShopping} /> Purchased: {formatDate(game.purchaseDate)}</span>
            )}
            {game.completedDate && (
              <span className="date-info"><FontAwesomeIcon icon={faTrophy} /> Completed: {formatDate(game.completedDate)}</span>
            )}
            <span className={`completed-checkbox ${game.completed ? 'checked' : ''}`} title={game.completed ? 'Completed' : 'Not completed'}>
              {game.completed && <FontAwesomeIcon icon={faCheck} />}
            </span>
            {game.notes && (
              <p className="list-notes">{game.notes}</p>
            )}
          </div>
        </div>
        <div className="list-actions">
          <button onClick={onEdit} className="edit-btn" aria-label={`Edit ${game.title}`} disabled={!isOnline} title={!isOnline ? 'Editing not available offline' : undefined}><FontAwesomeIcon icon={faPenToSquare} /></button>
          <button onClick={onDelete} className="delete-btn" aria-label={`Delete ${game.title}`} disabled={!isOnline} title={!isOnline ? 'Deleting not available offline' : undefined}><FontAwesomeIcon icon={faTrash} /></button>
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
            <FontAwesomeIcon icon={faGamepad} />
          </div>
        )}
        {game.isBestPick && (
          <div className="best-pick-badge" title="Best Pick">
            <FontAwesomeIcon icon={faStar} />
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
        {(game.purchaseDate || game.completedDate || game.completed) && (
          <div className="game-dates">
            {game.purchaseDate && (
              <span className="date-info" title="Purchase Date">
                <FontAwesomeIcon icon={faCartShopping} /> {formatDate(game.purchaseDate)}
              </span>
            )}
            {game.completedDate && (
              <span className="date-info" title="Completion Date">
                <FontAwesomeIcon icon={faTrophy} /> {formatDate(game.completedDate)}
              </span>
            )}
            <span className={`completed-checkbox ${game.completed ? 'checked' : ''}`} title={game.completed ? 'Completed' : 'Not completed'}>
              {game.completed && <FontAwesomeIcon icon={faCheck} />}
            </span>
          </div>
        )}
        <div className="game-actions">
          <button 
            onClick={onEdit} 
            className="edit-btn"
            aria-label={`Edit ${game.title}`}
            disabled={!isOnline}
            title={!isOnline ? 'Editing not available offline' : undefined}
          >
            <FontAwesomeIcon icon={faPenToSquare} />
          </button>
          <button 
            onClick={onDelete} 
            className="delete-btn"
            aria-label={`Delete ${game.title}`}
            disabled={!isOnline}
            title={!isOnline ? 'Deleting not available offline' : undefined}
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>
    </article>
  );
}


