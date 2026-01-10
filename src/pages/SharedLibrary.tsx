import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSEO } from '../hooks/useSEO';
import type { GameEntry, Format, Platform } from '../types';
import { loadSharedGames, getSharedUserProfile, getShareProfile, isFriend, loadGames, saveGame } from '../services/database';
import { AddFriendModal } from '../components/AddFriendModal';
import { UpsellBanner } from '../components/UpsellBanner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsLeftRight, faPlus, faCheck } from '@fortawesome/free-solid-svg-icons';
import './SharedLibrary.css';

type SortOption = 'title_asc' | 'title_desc' | 'added_newest' | 'platform' | 'format';
type ViewMode = 'grid' | 'list';
type PlatformFilter = 'all' | 'switch' | 'switch2';

interface SharedUserInfo {
  displayName: string;
  avatarUrl: string;
}

export function SharedLibrary() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [games, setGames] = useState<GameEntry[]>([]);
  const [userInfo, setUserInfo] = useState<SharedUserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('title_asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  
  // For compare functionality
  const [myShareId, setMyShareId] = useState<string | null>(null);
  
  // For friend functionality
  const [isAlreadyFriend, setIsAlreadyFriend] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);

  // For "Add to Collection" functionality
  const [myGames, setMyGames] = useState<GameEntry[]>([]);
  const [addingGameId, setAddingGameId] = useState<string | null>(null);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddGame, setQuickAddGame] = useState<GameEntry | null>(null);
  const [quickAddFormat, setQuickAddFormat] = useState<Format>('Physical');
  const [quickAddPlatform, setQuickAddPlatform] = useState<Platform>('Nintendo Switch');

  // Dynamic SEO for shared library
  useSEO({
    title: userInfo ? `${userInfo.displayName}'s Switch Library - ${games.length} Games` : 'Shared Switch Library',
    description: userInfo 
      ? `Check out ${userInfo.displayName}'s Nintendo Switch game collection with ${games.length} games (${games.filter(g => g.completed).length} completed). View their library and compare collections!`
      : 'View a shared Nintendo Switch game collection',
    url: `https://myswitchlibrary.com/shared/${shareId}`,
    type: 'profile',
  });

  useEffect(() => {
    async function loadData() {
      if (!shareId) {
        setError('Invalid share link');
        setIsLoading(false);
        return;
      }

      try {
        const [sharedGames, sharedUserInfo] = await Promise.all([
          loadSharedGames(shareId),
          getSharedUserProfile(shareId)
        ]);

        if (!sharedUserInfo) {
          setError('This library is not available or sharing has been disabled');
          setIsLoading(false);
          return;
        }

        setGames(sharedGames);
        setUserInfo(sharedUserInfo);
        
        // Get current user's share ID for compare feature, check if already friends, and load user's games
        if (user) {
          const [myProfile, alreadyFriend, userGames] = await Promise.all([
            getShareProfile(user.id),
            isFriend(user.id, shareId),
            loadGames(user.id)
          ]);
          if (myProfile?.enabled) {
            setMyShareId(myProfile.shareId);
          }
          setIsAlreadyFriend(alreadyFriend);
          setMyGames(userGames);
        }
      } catch (err) {
        console.error('Failed to load shared library:', err);
        setError('Failed to load library');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [shareId, user]);

  // Helper to check if a game is already in user's collection
  const isGameInMyCollection = (game: GameEntry): boolean => {
    if (!user) return false;
    
    // Match by thegamesdbId if available (most reliable)
    if (game.thegamesdbId) {
      return myGames.some(g => g.thegamesdbId === game.thegamesdbId);
    }
    
    // Fallback: match by title (case-insensitive)
    return myGames.some(g => g.title.toLowerCase() === game.title.toLowerCase());
  };

  // Open quick add modal with pre-selected platform
  const openQuickAddModal = (game: GameEntry) => {
    setQuickAddPlatform(game.platform);
    setQuickAddFormat('Physical'); // Default to Physical
    setQuickAddGame(game);
    setShowQuickAddModal(true);
  };

  // Handle adding a game to user's collection
  const handleAddToCollection = async () => {
    if (!quickAddGame || !user) return;
    
    setAddingGameId(quickAddGame.id);
    
    try {
      const newGame: GameEntry = {
        id: crypto.randomUUID(),
        userId: user.id,
        title: quickAddGame.title,
        platform: quickAddPlatform,
        format: quickAddFormat,
        status: 'Owned',
        thegamesdbId: quickAddGame.thegamesdbId,
        coverUrl: quickAddGame.coverUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Update UI immediately for instant feedback
      setMyGames(prev => [...prev, newGame]);
      setShowQuickAddModal(false);
      setQuickAddGame(null);
      setAddingGameId(null);
      
      // Save to database in background
      await saveGame(newGame, myGames);
    } catch (err) {
      console.error('Failed to add game:', err);
      setAddingGameId(null);
      // Revert optimistic update on error
      if (quickAddGame) {
        setMyGames(prev => prev.filter(g => g.id !== quickAddGame.id));
      }
    }
  };

  const filteredGames = games
    .filter(game => {
      const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlatform = platformFilter === 'all' ||
        (platformFilter === 'switch' && game.platform === 'Nintendo Switch') ||
        (platformFilter === 'switch2' && game.platform === 'Nintendo Switch 2');
      return matchesSearch && matchesPlatform;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title_asc':
          return a.title.localeCompare(b.title);
        case 'title_desc':
          return b.title.localeCompare(a.title);
        case 'added_newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'platform':
          return a.platform.localeCompare(b.platform);
        case 'format':
          return a.format.localeCompare(b.format);
        default:
          return 0;
      }
    });

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
      <div className="shared-library">
        <div className="loading-container">
          <div className="loading-spinner" aria-label="Loading" />
          <p>Loading shared library...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shared-library">
        <div className="error-state">
          <div className="error-icon">🔒</div>
          <h2>Library Not Available</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')} className="btn-home">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-library">
      {/* Show upsell banner if user is not logged in */}
      {!user && <UpsellBanner />}
      
      <header className="shared-header">
        <div className="shared-user-info">
          {userInfo?.avatarUrl && (
            <img src={userInfo.avatarUrl} alt={userInfo.displayName} className="shared-avatar" />
          )}
          <div>
            <h1>{userInfo?.displayName}'s Library</h1>
            <p className="shared-stats">
              {stats.total} games • {stats.completed} completed • {stats.physical} physical • {stats.digital} digital
            </p>
          </div>
        </div>
        <div className="shared-actions">
          {user && myShareId && myShareId !== shareId && (
            <Link to={`/compare/${myShareId}/${shareId}`} className="btn-compare">
              <FontAwesomeIcon icon={faArrowsLeftRight} /> Compare Libraries
            </Link>
          )}
          {user && shareId && myShareId !== shareId && (
            isAlreadyFriend ? (
              <Link to="/friends" className="btn-friend-status">
                ✓ In Friends List
              </Link>
            ) : (
              <button onClick={() => setShowAddFriendModal(true)} className="btn-add-friend">
                + Add Friend
              </button>
            )
          )}
        </div>
      </header>

      <div className="shared-toolbar">
        <input
          type="search"
          placeholder="Search games..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as PlatformFilter)}
          className="filter-select"
        >
          <option value="all">All Platforms</option>
          <option value="switch">Nintendo Switch</option>
          <option value="switch2">Nintendo Switch 2</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="filter-select"
        >
          <option value="title_asc">Title (A-Z)</option>
          <option value="title_desc">Title (Z-A)</option>
          <option value="added_newest">Recently Added</option>
          <option value="platform">Platform</option>
          <option value="format">Format</option>
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
        </div>
      </div>

      {filteredGames.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎮</div>
          <h2>No games found</h2>
          <p>{games.length === 0 ? 'This library is empty' : 'Try a different search term'}</p>
        </div>
      ) : (
        <>
          <div className="results-info">
            Showing {filteredGames.length} of {games.length} games
          </div>
          <div className={`games-${viewMode}`}>
            {filteredGames.map(game => {
              const inMyCollection = isGameInMyCollection(game);
              const isAdding = addingGameId === game.id;
              
              return (
                <article key={game.id} className={`game-card ${viewMode}`}>
                  <div className="game-cover">
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
                    {user && inMyCollection && (
                      <div className="in-collection-badge" title="In Your Collection">
                        <FontAwesomeIcon icon={faCheck} />
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
                    {user && (
                      <div className="game-actions">
                        {inMyCollection ? (
                          <div className="in-collection-text">
                            <FontAwesomeIcon icon={faCheck} /> In Your Collection
                          </div>
                        ) : (
                          <button
                            onClick={() => openQuickAddModal(game)}
                            disabled={isAdding}
                            className="btn-add-to-collection"
                            title="Add to my collection"
                          >
                            <FontAwesomeIcon icon={faPlus} />
                            {isAdding ? ' Adding...' : ' Add to Collection'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
      
      {showAddFriendModal && shareId && userInfo && (
        <AddFriendModal
          onClose={() => setShowAddFriendModal(false)}
          onAdd={async () => {
            if (user && shareId) {
              const alreadyFriend = await isFriend(user.id, shareId);
              setIsAlreadyFriend(alreadyFriend);
            }
          }}
          prefilledShareId={shareId}
          prefilledNickname={userInfo.displayName}
        />
      )}

      {/* Quick Add Modal */}
      {showQuickAddModal && quickAddGame && (
        <div className="modal-overlay" onClick={() => setShowQuickAddModal(false)} role="dialog" aria-modal="true">
          <div className="modal add-game-modal" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Add to My Collection</h2>
              <button onClick={() => setShowQuickAddModal(false)} className="modal-close" aria-label="Close">
                ✕
              </button>
            </header>
            <div className="modal-content">
              <div className="game-preview">
                {quickAddGame.coverUrl && (
                  <img src={quickAddGame.coverUrl} alt={quickAddGame.title} className="game-preview-cover" />
                )}
                <h3>{quickAddGame.title}</h3>
              </div>
              
              <div className="form-group">
                <label htmlFor="add-platform">Platform</label>
                <select
                  id="add-platform"
                  value={quickAddPlatform}
                  onChange={(e) => setQuickAddPlatform(e.target.value as Platform)}
                  className="form-select"
                >
                  <option value="Nintendo Switch">Nintendo Switch</option>
                  <option value="Nintendo Switch 2">Nintendo Switch 2</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="add-format">Format</label>
                <select
                  id="add-format"
                  value={quickAddFormat}
                  onChange={(e) => setQuickAddFormat(e.target.value as Format)}
                  className="form-select"
                >
                  <option value="Physical">Physical</option>
                  <option value="Digital">Digital</option>
                </select>
              </div>

              <div className="modal-actions">
                <button onClick={() => setShowQuickAddModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button 
                  onClick={handleAddToCollection} 
                  className="btn-primary"
                  disabled={addingGameId === quickAddGame.id}
                >
                  {addingGameId === quickAddGame.id ? 'Adding...' : 'Add to Collection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
