import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { GameEntry } from '../types';
import { loadSharedGames, getSharedUserProfile, getShareProfile } from '../services/database';
import './SharedLibrary.css';

type SortOption = 'title_asc' | 'title_desc' | 'added_newest' | 'platform' | 'format';
type ViewMode = 'grid' | 'list';

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
  
  // For compare functionality
  const [myShareId, setMyShareId] = useState<string | null>(null);

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
        
        // Get current user's share ID for compare feature
        if (user) {
          const myProfile = await getShareProfile(user.id);
          if (myProfile?.enabled) {
            setMyShareId(myProfile.shareId);
          }
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

  const filteredGames = games
    .filter(game => game.title.toLowerCase().includes(searchQuery.toLowerCase()))
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
              📊 Compare Libraries
            </Link>
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
            {filteredGames.map(game => (
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
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
