import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { GameEntry, Platform, Format } from '../types';
import { 
  searchGames, 
  getGameImages, 
  getBoxartUrl,
  PLATFORM_IDS,
  REGION_LABELS,
  DEFAULT_REGIONS,
  isTheGamesDBConfigured,
} from '../services/thegamesdb';
import { saveGame } from '../services/database';
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
  
  // Filters
  const [platform, setPlatform] = useState<'all' | Platform>('all');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [onlyWithBoxart, setOnlyWithBoxart] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<number[]>(DEFAULT_REGIONS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // View
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  // Adding state
  const [addingGameId, setAddingGameId] = useState<number | null>(null);
  const [addedGames, setAddedGames] = useState<Set<number>>(new Set());
  
  // Quick add modal
  const [quickAddGame, setQuickAddGame] = useState<SearchResult | null>(null);
  const [quickAddFormat, setQuickAddFormat] = useState<Format>('Physical');
  
  const searchRequestIdRef = useRef(0);
  const hasTheGamesDB = isTheGamesDBConfigured();

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !hasTheGamesDB) return;
    
    const requestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    
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
        regions: selectedRegions.length > 0 ? selectedRegions : undefined,
      });
      
      if (requestId !== searchRequestIdRef.current) return;
      
      if (result.count === 0) {
        setResults([]);
        return;
      }
      
      // Fetch boxart for all results
      const resultsWithImages = await Promise.all(
        result.games.map(async (game) => {
          const images = await getGameImages(game.id);
          const boxartUrl = getBoxartUrl(images, game.id, 'medium');
          return {
            id: game.id,
            title: game.game_title,
            releaseDate: game.release_date,
            platform: 'Nintendo Switch',
            overview: game.overview,
            boxartUrl: boxartUrl || undefined,
            players: game.players,
            rating: game.rating,
          };
        })
      );
      
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
  }, [query, platform, yearFrom, yearTo, sortBy, onlyWithBoxart, hasTheGamesDB]);

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
        gameMetadata: {
          releaseDate: quickAddGame.releaseDate,
          summary: quickAddGame.overview,
          players: quickAddGame.players,
          rating: quickAddGame.rating,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await saveGame(newGame);
      setAddedGames(prev => new Set(prev).add(quickAddGame.id));
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
            onClick={handleSearch}
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
        
        <button
          type="button"
          className="btn-advanced-filters"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          {showAdvancedFilters ? '▼' : '▶'} More Filters
        </button>
        
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

      {/* Advanced Filters (Regions) */}
      {showAdvancedFilters && (
        <div className="advanced-filters-panel">
          <div className="filter-section">
            <h4>🌍 Regions</h4>
            <p className="filter-hint">Filter results by game region (English regions selected by default)</p>
            <div className="region-toggles">
              {Object.entries(REGION_LABELS).map(([id, label]) => {
                const regionId = parseInt(id);
                const isSelected = selectedRegions.includes(regionId);
                return (
                  <label key={id} className="region-toggle">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        if (isSelected) {
                          setSelectedRegions(prev => prev.filter(r => r !== regionId));
                        } else {
                          setSelectedRegions(prev => [...prev, regionId]);
                        }
                      }}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
            <div className="region-quick-actions">
              <button
                type="button"
                className="btn-region-preset"
                onClick={() => setSelectedRegions(DEFAULT_REGIONS)}
              >
                English Only
              </button>
              <button
                type="button"
                className="btn-region-preset"
                onClick={() => setSelectedRegions(Object.keys(REGION_LABELS).map(Number))}
              >
                All Regions
              </button>
              <button
                type="button"
                className="btn-region-preset"
                onClick={() => setSelectedRegions([])}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

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
