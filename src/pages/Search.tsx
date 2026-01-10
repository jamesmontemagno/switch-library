import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { GameEntry, Platform, Format } from '../types';
import { 
  searchGames, 
  PLATFORM_IDS,
  isTheGamesDBConfigured,
  getStoredAllowance,
  isAllowanceExhausted,
} from '../services/thegamesdb';
import { saveGame, loadGames } from '../services/database';
import './Search.css';

type SortOption = 'relevance' | 'release_desc' | 'release_asc' | 'title_asc' | 'title_desc';
type ViewMode = 'grid' | 'list';

interface SearchResult {
  id: number;
  title: string;
  releaseDate?: string;
  platform: string;
  overview?: string;
  boxartUrl?: string;
  players?: number;
  rating?: string;
}

export function Search() {
  const { user, isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // User's existing games (for demo mode support)
  const [userGames, setUserGames] = useState<GameEntry[]>([]);
  
  // Filters
  const [platform, setPlatform] = useState<'all' | Platform>('all');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [onlyWithBoxart, setOnlyWithBoxart] = useState(false);
  
  // View
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  
  // API Allowance
  const [showAllowanceWarning, setShowAllowanceWarning] = useState(false);
  const [allowanceInfo, setAllowanceInfo] = useState<{ remaining: number; extra: number } | null>(null);
  
  // Adding state
  const [addingGameId, setAddingGameId] = useState<number | null>(null);
  const [addedGames, setAddedGames] = useState<Set<number>>(new Set());
  
  // Quick add modal
  const [quickAddGame, setQuickAddGame] = useState<SearchResult | null>(null);
  const [quickAddFormat, setQuickAddFormat] = useState<Format>('Physical');
  
  const searchRequestIdRef = useRef(0);
  const hasTheGamesDB = isTheGamesDBConfigured();

  // Load user's games on mount (for demo mode)
  useEffect(() => {
    if (user) {
      loadGames(user.id).then(games => setUserGames(games));
    }
    
    // Check API allowance on mount
    const stored = getStoredAllowance();
    if (stored) {
      setAllowanceInfo({ remaining: stored.remaining, extra: stored.extra });
      if (isAllowanceExhausted()) {
        setShowAllowanceWarning(true);
      }
    }
  }, [user]);

  const handleSearch = useCallback(async (page: number = 1) => {
    if (!query.trim() || !hasTheGamesDB) return;
    
    const requestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    
    // Reset to page 1 if this is a new search (not pagination)
    if (page === 1) {
      setCurrentPage(1);
    }
    
    try {
      // Determine platform ID - always restrict to Switch platforms
      let platformId: number = PLATFORM_IDS.NINTENDO_SWITCH;
      if (platform === 'Nintendo Switch') {
        platformId = PLATFORM_IDS.NINTENDO_SWITCH;
      } else if (platform === 'Nintendo Switch 2') {
        platformId = PLATFORM_IDS.NINTENDO_SWITCH_2;
      }
      // 'all' still searches Switch platform (our app is Switch-only)
      
      const result = await searchGames(query.trim(), {
        platformId,
        page,
      });
      
      if (requestId !== searchRequestIdRef.current) return;
      
      // Update allowance info
      if (result.remaining_monthly_allowance !== undefined) {
        setAllowanceInfo({
          remaining: result.remaining_monthly_allowance,
          extra: result.extra_allowance || 0
        });
        
        // Show warning if allowance is exhausted or low
        if (result.remaining_monthly_allowance === 0) {
          setShowAllowanceWarning(true);
        } else if (result.remaining_monthly_allowance < 50 && !hasSearched) {
          setShowAllowanceWarning(true);
        }
      }
      
      if (result.count === 0) {
        setResults([]);
        return;
      }
      
      // Map results with boxart from search results (no additional API calls needed)
      const resultsWithImages = result.games.map((game) => {
        // Boxart is now included in the search results
        const boxartUrl = game.boxart ? game.boxart.medium || game.boxart.original : undefined;
        
        return {
          id: game.id,
          title: game.game_title,
          releaseDate: game.release_date,
          platform: 'Nintendo Switch',
          overview: game.overview,
          boxartUrl,
          players: game.players,
          rating: game.rating,
        };
      });
      
      // Apply filters
      let filtered = resultsWithImages;
      
      if (onlyWithBoxart) {
        filtered = filtered.filter(r => !!r.boxartUrl);
      }
      
      if (yearFrom) {
        filtered = filtered.filter(r => {
          if (!r.releaseDate) return false;
          const year = parseInt(r.releaseDate.split('-')[0]);
          return year >= parseInt(yearFrom);
        });
      }
      
      if (yearTo) {
        filtered = filtered.filter(r => {
          if (!r.releaseDate) return false;
          const year = parseInt(r.releaseDate.split('-')[0]);
          return year <= parseInt(yearTo);
        });
      }
      
      // Apply sorting
      const parseDate = (d?: string) => (d ? new Date(d).getTime() : 0);
      filtered = [...filtered].sort((a, b) => {
        switch (sortBy) {
          case 'title_asc':
            return a.title.localeCompare(b.title);
          case 'title_desc':
            return b.title.localeCompare(a.title);
          case 'release_asc':
            return parseDate(a.releaseDate) - parseDate(b.releaseDate);
          case 'release_desc':
            return parseDate(b.releaseDate) - parseDate(a.releaseDate);
          default:
            return 0; // Keep original order for relevance
        }
      });
      
      setResults(filtered);
      
      // Assume there are more results if we got a full page
      // TheGamesDB typically returns 20 results per page
      setHasMoreResults(filtered.length >= 20);
    } catch (err) {
      if (requestId === searchRequestIdRef.current) {
        setError('Search failed. Please try again.');
        console.error('Search error:', err);
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, platform, yearFrom, yearTo, sortBy, onlyWithBoxart, hasTheGamesDB, currentPage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddGame || !user) return;
    
    setAddingGameId(quickAddGame.id);
    
    try {
      const newGame: GameEntry = {
        id: crypto.randomUUID(),
        userId: user.id,
        title: quickAddGame.title,
        platform: platform === 'all' ? 'Nintendo Switch' : platform,
        format: quickAddFormat,
        status: 'Owned',
        thegamesdbId: quickAddGame.id,
        coverUrl: quickAddGame.boxartUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Pass userGames for demo mode (localStorage) support
      const savedGame = await saveGame(newGame, userGames);
      if (savedGame) {
        setUserGames(prev => [...prev, savedGame]);
        setAddedGames(prev => new Set(prev).add(quickAddGame.id));
      }
      setQuickAddGame(null);
    } catch (err) {
      console.error('Failed to add game:', err);
    } finally {
      setAddingGameId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (!hasTheGamesDB) {
    return (
      <div className="search-page">
        <div className="search-not-configured">
          <div className="config-icon">🔧</div>
          <h2>Search Not Available</h2>
          <p>TheGamesDB API key is not configured. Please add your API key to enable game search.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="search-page">
      <header className="search-header">
        <h1>🔍 Game Search</h1>
        <p>Search TheGamesDB to find and add games to your collection</p>
      </header>

      {/* Search Bar */}
      <div className="search-bar-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search for games..."
            className="search-input-main"
            autoFocus
          />
          <button
            onClick={() => handleSearch(1)}
            disabled={!query.trim() || isSearching}
            className="search-btn-main"
          >
            {isSearching ? '⏳' : '🔍'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="search-filters-bar">
        <div className="filter-item">
          <label>Platform</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as 'all' | Platform)}>
            <option value="all">All Switch</option>
            <option value="Nintendo Switch">Nintendo Switch</option>
            <option value="Nintendo Switch 2">Nintendo Switch 2</option>
          </select>
        </div>
        
        <div className="filter-item">
          <label>Year From</label>
          <input
            type="number"
            min="2017"
            max="2030"
            placeholder="From"
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value)}
          />
        </div>
        
        <div className="filter-item">
          <label>Year To</label>
          <input
            type="number"
            min="2017"
            max="2030"
            placeholder="To"
            value={yearTo}
            onChange={(e) => setYearTo(e.target.value)}
          />
        </div>
        
        <div className="filter-item">
          <label>Sort By</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
            <option value="relevance">Relevance</option>
            <option value="release_desc">Release Date (Newest)</option>
            <option value="release_asc">Release Date (Oldest)</option>
            <option value="title_asc">Title (A-Z)</option>
            <option value="title_desc">Title (Z-A)</option>
          </select>
        </div>
        
        <label className="filter-checkbox-item">
          <input
            type="checkbox"
            checked={onlyWithBoxart}
            onChange={(e) => setOnlyWithBoxart(e.target.checked)}
          />
          <span>With Boxart Only</span>
        </label>
        
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

      {/* Results */}
      <div className="search-results-container">
        {isSearching && (
          <div className="search-loading">
            <div className="loading-spinner" />
            <p>Searching games...</p>
          </div>
        )}

        {error && (
          <div className="search-error">
            <p>⚠️ {error}</p>
          </div>
        )}

        {!isSearching && hasSearched && results.length === 0 && (
          <div className="search-no-results">
            <div className="no-results-icon">🎮</div>
            <h3>No games found</h3>
            <p>Try adjusting your search query or filters</p>
          </div>
        )}

        {!isSearching && results.length > 0 && (
          <>
            <div className="results-count">
              Found {results.length} game{results.length !== 1 ? 's' : ''}
            </div>
            
            {/* Pagination Controls - Top */}
            {(currentPage > 1 || hasMoreResults) && (
              <div className="pagination-controls">
                <button
                  onClick={() => {
                    setCurrentPage(prev => prev - 1);
                    handleSearch(currentPage - 1);
                  }}
                  disabled={currentPage === 1 || isSearching}
                  className="btn-pagination"
                >
                  ← Previous
                </button>
                <span className="page-indicator">
                  Page {currentPage}
                </span>
                <button
                  onClick={() => {
                    setCurrentPage(prev => prev + 1);
                    handleSearch(currentPage + 1);
                  }}
                  disabled={!hasMoreResults || isSearching}
                  className="btn-pagination"
                >
                  Next →
                </button>
              </div>
            )}
            
            <div className={`results-${viewMode}`}>
              {results.map((game) => (
                <article key={game.id} className={`result-card ${viewMode}`}>
                  <div className="result-cover">
                    {game.boxartUrl ? (
                      <img src={game.boxartUrl} alt={game.title} loading="lazy" />
                    ) : (
                      <div className="cover-placeholder">
                        <span>🎮</span>
                      </div>
                    )}
                    {addedGames.has(game.id) && (
                      <div className="added-badge">✓ Added</div>
                    )}
                  </div>
                  <div className="result-info">
                    <h3 className="result-title">{game.title}</h3>
                    <div className="result-meta">
                      <span className="release-date">📅 {formatDate(game.releaseDate)}</span>
                      {game.players && <span className="players">👥 {game.players} player{game.players > 1 ? 's' : ''}</span>}
                      {game.rating && <span className="rating">⭐ {game.rating}</span>}
                    </div>
                    {viewMode === 'list' && game.overview && (
                      <p className="result-overview">
                        {game.overview.length > 200 
                          ? `${game.overview.substring(0, 200)}...` 
                          : game.overview}
                      </p>
                    )}
                    <div className="result-actions">
                      {isAuthenticated ? (
                        addedGames.has(game.id) ? (
                          <button className="btn-added" disabled>
                            ✓ In Collection
                          </button>
                        ) : (
                          <button
                            className="btn-add-to-collection"
                            onClick={() => setQuickAddGame(game)}
                            disabled={addingGameId === game.id}
                          >
                            {addingGameId === game.id ? '⏳ Adding...' : '+ Add to Collection'}
                          </button>
                        )
                      ) : (
                        <span className="login-hint">Sign in to add games</span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            
            {/* Pagination Controls - Bottom */}
            {(currentPage > 1 || hasMoreResults) && (
              <div className="pagination-controls pagination-bottom">
                <button
                  onClick={() => {
                    setCurrentPage(prev => prev - 1);
                    handleSearch(currentPage - 1);
                  }}
                  disabled={currentPage === 1 || isSearching}
                  className="btn-pagination"
                >
                  ← Previous
                </button>
                <span className="page-indicator">
                  Page {currentPage}
                </span>
                <button
                  onClick={() => {
                    setCurrentPage(prev => prev + 1);
                    handleSearch(currentPage + 1);
                  }}
                  disabled={!hasMoreResults || isSearching}
                  className="btn-pagination"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {!hasSearched && !isSearching && (
          <div className="search-prompt">
            <div className="prompt-icon">🎮</div>
            <h3>Find Your Next Game</h3>
            <p>Search for Nintendo Switch games to add to your collection</p>
            <div className="search-tips">
              <h4>Search Tips:</h4>
              <ul>
                <li>Search by game title</li>
                <li>Use filters to narrow results</li>
                <li>Click "Add to Collection" to save games</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* API Allowance Warning Modal */}
      {showAllowanceWarning && allowanceInfo && (
        <div className="modal-overlay" onClick={() => setShowAllowanceWarning(false)}>
          <div className="allowance-warning-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>{allowanceInfo.remaining === 0 ? '⚠️ API Limit Reached' : '⚠️ API Limit Warning'}</h2>
              <button onClick={() => setShowAllowanceWarning(false)} className="modal-close">✕</button>
            </header>
            <div className="allowance-warning-content">
              {allowanceInfo.remaining === 0 ? (
                <>
                  <p className="warning-message">
                    You have exhausted your monthly API allowance for TheGamesDB.
                  </p>
                  <p className="warning-detail">
                    You will not be able to search for new games until your allowance resets at the start of next month.
                  </p>
                </>
              ) : (
                <>
                  <p className="warning-message">
                    Your TheGamesDB API allowance is running low.
                  </p>
                  <p className="warning-detail">
                    Remaining requests: <strong>{allowanceInfo.remaining}</strong>
                    {allowanceInfo.extra > 0 && <> (+ {allowanceInfo.extra} extra)</>}
                  </p>
                  <p className="warning-hint">
                    Consider limiting your searches to preserve your allowance for the rest of the month.
                  </p>
                </>
              )}
              <div className="allowance-actions">
                <button 
                  className="btn-understand" 
                  onClick={() => setShowAllowanceWarning(false)}
                >
                  I Understand
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Modal */}
      {quickAddGame && (
        <div className="modal-overlay" onClick={() => setQuickAddGame(null)}>
          <div className="quick-add-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Add to Collection</h2>
              <button onClick={() => setQuickAddGame(null)} className="modal-close">✕</button>
            </header>
            <div className="quick-add-content">
              <div className="quick-add-game-info">
                {quickAddGame.boxartUrl && (
                  <img src={quickAddGame.boxartUrl} alt={quickAddGame.title} className="quick-add-cover" />
                )}
                <div className="quick-add-details">
                  <h3>{quickAddGame.title}</h3>
                  <p className="release-date">📅 {formatDate(quickAddGame.releaseDate)}</p>
                </div>
              </div>
              <div className="quick-add-options">
                <div className="form-group">
                  <label htmlFor="format">Format</label>
                  <select
                    id="format"
                    value={quickAddFormat}
                    onChange={(e) => setQuickAddFormat(e.target.value as Format)}
                  >
                    <option value="Physical">Physical</option>
                    <option value="Digital">Digital</option>
                  </select>
                </div>
              </div>
              <div className="quick-add-actions">
                <button className="btn-cancel" onClick={() => setQuickAddGame(null)}>
                  Cancel
                </button>
                <button className="btn-confirm-add" onClick={handleQuickAdd}>
                  Add to Collection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
