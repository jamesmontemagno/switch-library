import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSEO } from '../hooks/useSEO';
import type { GameEntry, Format, Platform } from '../types';
import { loadSharedGames, getSharedUserProfile, getShareProfile, isFollowing, loadGames, saveGame, getFollowers } from '../services/database';
import { AddFriendModal } from '../components/AddFriendModal';
import { ShareLibraryModal } from '../components/ShareLibraryModal';
import { UpsellBanner } from '../components/UpsellBanner';
import { SegmentedControl } from '../components/SegmentedControl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsLeftRight, faPlus, faCheck, faUserCheck, faTableCells, faList } from '@fortawesome/free-solid-svg-icons';
import './SharedLibrary.css';

type SortOption = 'title_asc' | 'title_desc' | 'added_newest' | 'platform' | 'format';
type ViewMode = 'grid' | 'list';
type PlatformFilter = 'all' | 'switch' | 'switch2';

// Relationship state: whether you follow them and/or they follow you
interface FollowRelationship {
  youFollowThem: boolean;
  theyFollowYou: boolean;
}

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
  
  // Mobile filters toggle
  const [showFilters, setShowFilters] = useState(false);
  
  // For compare functionality
  const [myShareId, setMyShareId] = useState<string | null>(null);
  
  // For follow functionality
  const [followRelationship, setFollowRelationship] = useState<FollowRelationship>({
    youFollowThem: false,
    theyFollowYou: false
  });
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Check the follow relationship state
  const checkFollowRelationship = useCallback(async () => {
    if (!user || !shareId) return;
    
    // Check if we follow them
    const youFollowThem = await isFollowing(user.id, shareId);
    
    // Check if they follow us by looking at our followers
    const myFollowers = await getFollowers(user.id);
    const theyFollowYou = myFollowers.some(f => f.followerShareId === shareId);
    
    setFollowRelationship({ youFollowThem, theyFollowYou });
  }, [user, shareId]);

  // Handler for when sharing is enabled
  const handleSharingEnabled = useCallback(async () => {
    if (!user) return;
    try {
      const myProfile = await getShareProfile(user.id);
      if (myProfile?.enabled) {
        setMyShareId(myProfile.shareId);
        setToast({ message: 'Sharing enabled successfully! You can now follow others and compare libraries.', type: 'success' });
      }
    } catch (error) {
      console.error('Failed to refresh share profile:', error);
    }
  }, [user]);

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
        
        // Get current user's share ID for compare feature, check relationship, and load user's games
        if (user) {
          const [myProfile, userGames] = await Promise.all([
            getShareProfile(user.id),
            loadGames(user.id)
          ]);
          if (myProfile?.enabled) {
            setMyShareId(myProfile.shareId);
          }
          setMyGames(userGames);
          
          // Check relationship state
          await checkFollowRelationship();
        }
      } catch (err) {
        console.error('Failed to load shared library:', err);
        setError('Failed to load library');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [shareId, user, checkFollowRelationship]);

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
            <>
              {followRelationship.youFollowThem ? (
                <Link to="/friends" className="btn-friend-status">
                  <FontAwesomeIcon icon={faUserCheck} /> Following
                  {followRelationship.theyFollowYou && ' • Follows You'}
                </Link>
              ) : (
                <button onClick={() => setShowAddFriendModal(true)} className="btn-add-friend">
                  + Follow
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Toast notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}

      {/* CTA for authenticated users to enable sharing */}
      {user && !myShareId && (
        <div style={{
          padding: '1rem',
          margin: '0 0 1.5rem 0',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}>
          <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>✨</span>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Share Your Library Too!</strong>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Enable sharing on your library to follow other users, compare collections, and join the community.
            </p>
            <button
              onClick={() => setShowShareModal(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              Enable Sharing
            </button>
          </div>
        </div>
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
              { value: 'list', label: 'List View', icon: <FontAwesomeIcon icon={faList} /> },
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

      <div className={`shared-toolbar ${showFilters ? 'toolbar-expanded' : 'toolbar-collapsed'}`}>
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
        <div className="view-toggle-desktop">
          <SegmentedControl
            options={[
              { value: 'grid', label: 'Grid View', icon: <FontAwesomeIcon icon={faTableCells} /> },
              { value: 'list', label: 'List View', icon: <FontAwesomeIcon icon={faList} /> },
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
            // Refresh the relationship state after following
            await checkFollowRelationship();
            setToast({ message: `Now following ${userInfo.displayName}!`, type: 'success' });
          }}
          prefilledShareId={shareId}
          prefilledNickname={userInfo.displayName}
        />
      )}

      {showShareModal && user && (
        <ShareLibraryModal
          userId={user.id}
          onClose={() => setShowShareModal(false)}
          onSharingEnabled={handleSharingEnabled}
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
