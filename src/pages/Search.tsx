import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { useSEO } from '../hooks/useSEO';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faWrench, faGamepad, faCalendar, faUsers, faStar, faBox, faCloud, faTriangleExclamation, faXmark, faHourglassHalf, faTableCells, faList, faGripLines, faFire, faArrowTrendUp } from '@fortawesome/free-solid-svg-icons';
import type { GameEntry, Platform, Format, TrendingGame, TrendingResponse } from '../types';
import { 
  searchGames, 
  PLATFORM_IDS,
  isTheGamesDBConfigured,
  getStoredAllowance,
  isAllowanceExhausted,
  getRegionName,
} from '../services/thegamesdb';
import { saveGame, loadGames, getMonthlySearchCount, logSearchUsage, deleteGame as deleteGameFromDb, getTrendingGames } from '../services/database';
import { UsageLimitModal } from '../components/UsageLimitModal';
import { ManualAddGameModal } from '../components/ManualAddGameModal';
import { FirstGameCelebrationModal } from '../components/FirstGameCelebrationModal';
import { ShareLibraryModal } from '../components/ShareLibraryModal';
import { SegmentedControl } from '../components/SegmentedControl';
import './Search.css';

const FIRST_GAME_CELEBRATION_KEY = 'hasSeenFirstGameCelebration';

type SortOption = 'relevance' | 'release_desc' | 'release_asc' | 'title_asc' | 'title_desc';
type ViewMode = 'grid' | 'list' | 'compact';
type SearchMode = 'search' | 'trending';

interface SearchResult {
  id: number;
  title: string;
  releaseDate?: string;
  platform: string;
  platformId: number;
  overview?: string;
  boxartUrl?: string;
  players?: number;
  rating?: string;
  region_id?: number;
}

// TrendingGameCard component for displaying games in the Trending section
interface TrendingGameCardProps {
  game: TrendingGame;
  userGames: GameEntry[];
  isAuthenticated: boolean;
  onQuickAdd: (game: { thegamesdbId: number; title?: string; coverUrl?: string; platformId?: number }) => void;
  addingGameId: number | null;
}

function TrendingGameCard({ game, userGames, isAuthenticated, onQuickAdd, addingGameId }: TrendingGameCardProps) {
  const isInLibrary = userGames.some(g => g.thegamesdbId === game.thegamesdbId);
  const isAdding = addingGameId === game.thegamesdbId;
  
  return (
    <article className="result-card grid trending">
      <div className="result-cover">
        {game.coverUrl ? (
          <img src={game.coverUrl} alt={game.title || 'Game cover'} loading="lazy" />
        ) : (
          <div className="cover-placeholder">
            <span><FontAwesomeIcon icon={faGamepad} /></span>
          </div>
        )}
        {isInLibrary && (
          <div className="added-badge">✓ In Library</div>
        )}
        {game.addCount && game.addCount > 1 && (
          <div className="add-count-badge">
            <FontAwesomeIcon icon={faUsers} /> {game.addCount}
          </div>
        )}
      </div>
      <div className="result-info">
        <h3 className="result-title">{game.title || `Game #${game.thegamesdbId}`}</h3>
        <div className="result-meta">
          {game.platformId && (
            <span className={`platform-badge ${game.platformId === PLATFORM_IDS.NINTENDO_SWITCH_2 ? 'switch2' : 'switch'}`}>
              {game.platformId === PLATFORM_IDS.NINTENDO_SWITCH_2 ? 'Switch 2' : 'Switch'}
            </span>
          )}
          {game.region_id !== undefined && <span className="region-badge">{getRegionName(game.region_id)}</span>}
          {game.releaseDate && (
            <span className="release-date"><FontAwesomeIcon icon={faCalendar} /> {game.releaseDate.split('-')[0]}</span>
          )}
        </div>
        <div className="result-actions">
          {isAuthenticated ? (
            isInLibrary ? (
              <span className="in-library-text">In your library</span>
            ) : (
              <button
                className="btn-add-to-collection"
                onClick={() => onQuickAdd(game)}
                disabled={isAdding}
              >
                {isAdding ? <><FontAwesomeIcon icon={faHourglassHalf} /> Adding...</> : '+ Add to Collection'}
              </button>
            )
          ) : (
            <span className="login-hint">Sign in to add games</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function Search() {
  const { user, isAuthenticated } = useAuth();
  const { preferences, updatePreferences } = usePreferences();
  const isOnline = useOnlineStatus();
  
  useSEO({
    title: 'Search Nintendo Switch Games - My Switch Library',
    description: 'Search and add Nintendo Switch and Switch 2 games to your collection. Browse games from TheGamesDB with cover art, release dates, and detailed information.',
    url: 'https://myswitchlibrary.com/search',
  });
  
  // Search mode - search is default, trending loads on demand
  const [mode, setMode] = useState<SearchMode>('search');
  
  const [query, setQuery] = useState('');
  const [rawResults, setRawResults] = useState<SearchResult[]>([]); // Store unfiltered results
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Trending state
  const [trendingData, setTrendingData] = useState<TrendingResponse | null>(null);
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);
  const [hasTrendingLoaded, setHasTrendingLoaded] = useState(false);
  
  // User's existing games (for demo mode support)
  const [userGames, setUserGames] = useState<GameEntry[]>([]);
  
  // Filters - initialized from saved preferences
  const [platform, setPlatform] = useState<'all' | Platform>(preferences.search?.platform || 'all');
  const [region, setRegion] = useState<'all' | number>(preferences.search?.region || 'all');
  const [sortBy, setSortBy] = useState<SortOption>(preferences.search?.sortBy || 'relevance');
  
  // View - initialized from saved preferences
  const [viewMode, setViewMode] = useState<ViewMode>(preferences.search?.viewMode || 'grid');
  
  // Mobile filters toggle
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  
  // API Allowance
  const [showAllowanceWarning, setShowAllowanceWarning] = useState(false);
  const [allowanceInfo, setAllowanceInfo] = useState<{ remaining: number; extra: number } | null>(null);
  
  // Usage tracking
  const [showUsageLimitModal, setShowUsageLimitModal] = useState(false);
  const [usageInfo, setUsageInfo] = useState<{ count: number; limit: number; month: string } | null>(null);
  
  // Adding state
  const [addingGameId, setAddingGameId] = useState<number | null>(null);
  
  // Removing state
  const [removingGameId, setRemovingGameId] = useState<number | null>(null);
  const [gameToDelete, setGameToDelete] = useState<{ gameEntry: GameEntry; searchResult: SearchResult } | null>(null);
  
  // Quick add modal
  const [quickAddGame, setQuickAddGame] = useState<SearchResult | null>(null);
  const [quickAddFormat, setQuickAddFormat] = useState<Format>('Physical');
  const [quickAddPlatform, setQuickAddPlatform] = useState<Platform>('Nintendo Switch');
  const [quickAddCompleted, setQuickAddCompleted] = useState(false);
  
  // Manual add modal
  const [showManualAddModal, setShowManualAddModal] = useState(false);
  
  // First game celebration modal
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [firstGameTitle, setFirstGameTitle] = useState('');
  const [hasSeenCelebration, setHasSeenCelebration] = useState(() => {
    try {
      return localStorage.getItem(FIRST_GAME_CELEBRATION_KEY) === 'true';
    } catch {
      return false;
    }
  });
  
  // Share modal (for celebration flow)
  const [showShareModal, setShowShareModal] = useState(false);
  
  const searchRequestIdRef = useRef(0);
  const hasTheGamesDB = isTheGamesDBConfigured();

  // Save preferences when filters/sort/view change
  useEffect(() => {
    updatePreferences({
      search: {
        platform,
        region,
        sortBy,
        viewMode,
      },
    });
  }, [platform, region, sortBy, viewMode, updatePreferences]);

  // Load user's games on mount (for demo mode)
  useEffect(() => {
    if (user) {
      loadGames(user.id).then(games => setUserGames(games));
      // Load usage info on mount
      getMonthlySearchCount(user.id).then(usage => setUsageInfo(usage));
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

  // Load trending data when switching to trending mode (on demand)
  const loadTrendingData = useCallback(async () => {
    if (hasTrendingLoaded || isTrendingLoading) return;
    
    setIsTrendingLoading(true);
    try {
      const data = await getTrendingGames(user?.id);
      setTrendingData(data);
      setHasTrendingLoaded(true);
    } catch (err) {
      console.error('Failed to load trending data:', err);
    } finally {
      setIsTrendingLoading(false);
    }
  }, [user?.id, hasTrendingLoaded, isTrendingLoading]);

  // Load trending when mode changes to trending
  useEffect(() => {
    if (mode === 'trending' && !hasTrendingLoaded) {
      loadTrendingData();
    }
  }, [mode, hasTrendingLoaded, loadTrendingData]);

  // Apply filters and sorting reactively whenever rawResults or filter states change
  const results = useMemo(() => {
    let filtered = [...rawResults];
    
    if (region !== 'all') {
      filtered = filtered.filter(r => r.region_id === region);
    }
    
    // Apply sorting
    const parseDate = (d?: string) => (d ? new Date(d).getTime() : 0);
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title_asc':
          return a.title.localeCompare(b.title);
        case 'title_desc':
          return b.title.localeCompare(a.title);
        case 'release_asc':
          return parseDate(a.releaseDate) - parseDate(b.releaseDate);
        case 'release_desc':
          return parseDate(b.releaseDate) - parseDate(a.releaseDate);
        default: {
          // For relevance (default), prioritize North American releases
          // region_id 1 = North America
          const aIsNA = a.region_id === 1;
          const bIsNA = b.region_id === 1;
          if (aIsNA && !bIsNA) return -1;
          if (!aIsNA && bIsNA) return 1;
          return 0; // Keep original order for same region
        }
      }
    });
    
    return filtered;
  }, [rawResults, region, sortBy]);

  const handleSearch = useCallback(async (page: number = 1) => {
    if (!query.trim() || !hasTheGamesDB) return;
    
    // Check usage limit before searching (only for non-cached searches)
    if (user && usageInfo && usageInfo.count >= usageInfo.limit) {
      // Check if this query is cached first
      const cacheKey = `${query.toLowerCase().trim()}_${platform === 'Nintendo Switch' ? PLATFORM_IDS.NINTENDO_SWITCH : platform === 'Nintendo Switch 2' ? PLATFORM_IDS.NINTENDO_SWITCH_2 : PLATFORM_IDS.NINTENDO_SWITCH}_${page}`;
      const cached = localStorage.getItem('thegamesdb_search_cache');
      if (cached) {
        try {
          const cache = JSON.parse(cached);
          const cachedResult = cache[cacheKey];
          const SEARCH_CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
          if (cachedResult && Date.now() - cachedResult.timestamp < SEARCH_CACHE_EXPIRY_MS) {
            // Cached result available, allow search to proceed
          } else {
            // No cached result and limit reached, show modal
            setShowUsageLimitModal(true);
            return;
          }
        } catch {
          // Error checking cache, show modal to be safe
          setShowUsageLimitModal(true);
          return;
        }
      } else {
        // No cache and limit reached
        setShowUsageLimitModal(true);
        return;
      }
    }
    
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
      
      // Check if this query is already cached BEFORE calling searchGames
      // (searchGames will cache the result after the API call, so checking after would be wrong)
      const cacheKey = `${query.toLowerCase().trim()}_${platformId}_${page}`;
      const cached = localStorage.getItem('thegamesdb_search_cache');
      let wasCachedBeforeSearch = false;
      if (cached) {
        try {
          const cache = JSON.parse(cached);
          const cachedResult = cache[cacheKey];
          const SEARCH_CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
          if (cachedResult && Date.now() - cachedResult.timestamp < SEARCH_CACHE_EXPIRY_MS) {
            wasCachedBeforeSearch = true;
          }
        } catch {
          // Ignore cache check errors
        }
      }
      
      const result = await searchGames(query.trim(), {
        platformId,
        page,
      });
      
      if (requestId !== searchRequestIdRef.current) return;
      
      // Log the search if it wasn't cached and we have a user
      if (!wasCachedBeforeSearch && user) {
        await logSearchUsage(user.id, query.trim());
        // Refresh usage info
        const updatedUsage = await getMonthlySearchCount(user.id);
        setUsageInfo(updatedUsage);
      }
      
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
        setRawResults([]);
        return;
      }
      
      // Map results with boxart from search results (no additional API calls needed)
      const resultsWithImages = result.games.map((game) => {
        // Boxart is now included in the search results
        const boxartUrl = game.boxart ? (game.boxart.thumb || game.boxart.small || game.boxart.medium || game.boxart.original) : undefined;
        
        // Determine platform name from platform ID
        const platformName = game.platform === PLATFORM_IDS.NINTENDO_SWITCH_2 
          ? 'Nintendo Switch 2' 
          : 'Nintendo Switch';
        
        return {
          id: game.id,
          title: game.game_title,
          releaseDate: game.release_date,
          platform: platformName,
          platformId: game.platform,
          overview: game.overview,
          boxartUrl,
          players: game.players,
          rating: game.rating,
          region_id: game.region_id,
        };
      });
      
      // Store raw results - filtering/sorting is done reactively in useMemo
      setRawResults(resultsWithImages);
      
      // Assume there are more results if we got a full page
      // TheGamesDB typically returns 20 results per page
      setHasMoreResults(resultsWithImages.length >= 20);
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
  }, [query, platform, hasTheGamesDB, user, usageInfo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Helper to check if a game is in the user's library
  const getGameInLibrary = (thegamesdbId: number): GameEntry | undefined => {
    return userGames.find(g => g.thegamesdbId === thegamesdbId);
  };

  // Open quick add modal with smart platform detection
  // Works with both SearchResult and TrendingGame
  type TrendingGameInput = { thegamesdbId: number; title?: string; coverUrl?: string; platformId?: number };
  const openQuickAdd = (game: SearchResult | TrendingGameInput) => {
    // Normalize the game object - handle both SearchResult (id, boxartUrl) and TrendingGame (thegamesdbId, coverUrl)
    const isSearchResult = 'id' in game && 'boxartUrl' in game;
    const gameId = isSearchResult ? (game as SearchResult).id : (game as TrendingGameInput).thegamesdbId;
    const gameTitle = game.title || 'Unknown Game';
    const gamePlatformId = game.platformId;
    const gameCoverUrl = isSearchResult ? (game as SearchResult).boxartUrl : (game as TrendingGameInput).coverUrl;
    
    // Auto-detect platform based on the game's platform ID from TheGamesDB
    const detectedPlatform = gamePlatformId === PLATFORM_IDS.NINTENDO_SWITCH_2 
      ? 'Nintendo Switch 2' 
      : 'Nintendo Switch';
    setQuickAddPlatform(detectedPlatform);
    setQuickAddGame({
      id: gameId,
      title: gameTitle,
      platformId: gamePlatformId || PLATFORM_IDS.NINTENDO_SWITCH,
      platform: detectedPlatform,
      boxartUrl: gameCoverUrl,
    });
  };

  const handleQuickAdd = async () => {
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
        completed: quickAddCompleted || undefined,
        thegamesdbId: quickAddGame.id,
        coverUrl: quickAddGame.boxartUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Check if this is the first game
      const isFirstGame = userGames.length === 0 && !hasSeenCelebration;
      
      // Update UI immediately for instant feedback
      setUserGames(prev => [...prev, newGame]);
      setQuickAddGame(null);
      setQuickAddCompleted(false); // Reset completed state
      setAddingGameId(null);
      
      // Show celebration modal if first game
      if (isFirstGame) {
        setFirstGameTitle(quickAddGame.title);
        setShowCelebrationModal(true);
      }
      
      // Save to database in background (fire and forget) - mark as new game for trending
      saveGame(newGame, userGames, true).catch(err => {
        console.error('Failed to save game in background:', err);
        // Optionally: show a toast notification to user about the failure
        // and revert the optimistic update
      });
    } catch (err) {
      console.error('Failed to add game:', err);
      setAddingGameId(null);
    }
  };

  const handleRemoveGame = async (searchResult: SearchResult) => {
    const gameInLibrary = getGameInLibrary(searchResult.id);
    if (gameInLibrary) {
      setGameToDelete({ gameEntry: gameInLibrary, searchResult });
    }
  };

  const confirmDelete = async () => {
    if (!gameToDelete) return;
    
    setRemovingGameId(gameToDelete.searchResult.id);
    
    try {
      const success = await deleteGameFromDb(gameToDelete.gameEntry.id);
      if (success) {
        setUserGames(prev => prev.filter(g => g.id !== gameToDelete.gameEntry.id));
      }
    } catch (err) {
      console.error('Failed to remove game:', err);
    } finally {
      setRemovingGameId(null);
      setGameToDelete(null);
    }
  };

  const handleManualAdd = async (game: Omit<GameEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    
    const newGame: GameEntry = {
      ...game,
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Check if this is the first game
    const isFirstGame = userGames.length === 0 && !hasSeenCelebration;
    
    // Update UI immediately for instant feedback
    setUserGames(prev => [...prev, newGame]);
    setShowManualAddModal(false);
    
    // Show celebration modal if first game
    if (isFirstGame) {
      setFirstGameTitle(game.title);
      setShowCelebrationModal(true);
    }
    
    // Save to database in background (fire and forget)
    saveGame(newGame, userGames).catch(err => {
      console.error('Failed to save game in background:', err);
      // Optionally: show a toast notification to user about the failure
      // and revert the optimistic update
    });
  };

  const handleCelebrationEnableSharing = () => {
    setShowCelebrationModal(false);
    setShowShareModal(true);
    try {
      localStorage.setItem(FIRST_GAME_CELEBRATION_KEY, 'true');
      setHasSeenCelebration(true);
    } catch (error) {
      console.error('Failed to save celebration preference:', error);
    }
  };

  const handleCelebrationDismiss = () => {
    setShowCelebrationModal(false);
    try {
      localStorage.setItem(FIRST_GAME_CELEBRATION_KEY, 'true');
      setHasSeenCelebration(true);
    } catch (error) {
      console.error('Failed to save celebration preference:', error);
    }
  };

  const handleSharingEnabled = async () => {
    // Refresh happens automatically in the modal
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
          <div className="config-icon"><FontAwesomeIcon icon={faWrench} /></div>
          <h2>Search Not Available</h2>
          <p>TheGamesDB API key is not configured. Please add your API key to enable game search.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="search-page">
      {/* Offline Warning */}
      {!isOnline && (
        <div className="offline-banner" style={{
          background: 'var(--warning)',
          color: 'white',
          padding: '1rem',
          textAlign: 'center',
          marginBottom: '1rem',
          borderRadius: '8px',
          fontWeight: '500'
        }}>
          <FontAwesomeIcon icon={faTriangleExclamation} /> You are offline. Search is not available. Please check your internet connection.
        </div>
      )}
      
      <header className="search-header">
        <div>
          <h1><FontAwesomeIcon icon={faMagnifyingGlass} /> Game Search</h1>
          <p>Search TheGamesDB to find and add games to your collection</p>
        </div>
      </header>

      {/* Mode Toggle - Search / Trending */}
      <div className="mode-toggle-container">
        <SegmentedControl
          options={[
            { value: 'search', label: 'Search', icon: <FontAwesomeIcon icon={faMagnifyingGlass} /> },
            { value: 'trending', label: 'Trending', icon: <FontAwesomeIcon icon={faFire} /> },
          ]}
          value={mode}
          onChange={(value) => {
            if (!isOnline) {
              alert('You are offline. Search and trending features are not available in offline mode.');
              return;
            }
            setMode(value as 'search' | 'trending');
          }}
          ariaLabel="Search mode"
          variant="default"
        />
      </div>

      {/* Search Mode Content */}
      {mode === 'search' && (
        <>
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
                disabled={!isOnline}
              />
              <button
                onClick={() => handleSearch(1)}
                disabled={!query.trim() || isSearching || !isOnline}
                className="search-btn-main"
                title={!isOnline ? 'Search not available offline' : undefined}
              >
                {isSearching ? <FontAwesomeIcon icon={faHourglassHalf} /> : <FontAwesomeIcon icon={faMagnifyingGlass} />}
              </button>
            </div>
          </div>

      {/* Filters - Mobile Toggle Button */}
      <div className="filters-mobile-header">
        <button 
          className="btn-toggle-filters"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          aria-label="Toggle filters"
        >
          <span><FontAwesomeIcon icon={faWrench} /> Filters & Sort</span>
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

      {/* Filters */}
      <div className={`search-filters-bar ${showFilters ? 'filters-expanded' : 'filters-collapsed'}`}>
        <div className="filter-item">
          <label>Platform</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as 'all' | Platform)}>
            <option value="all">All Switch</option>
            <option value="Nintendo Switch">Nintendo Switch</option>
            <option value="Nintendo Switch 2">Nintendo Switch 2</option>
          </select>
        </div>
        
        <div className="filter-item">
          <label>Region</label>
          <select value={region} onChange={(e) => setRegion(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}>
            <option value="all">All Regions</option>
            <option value="1">North America</option>
            <option value="3">Japan</option>
            <option value="4">Australia</option>
            <option value="5">Asia</option>
            <option value="6">Europe</option>
            <option value="7">South America</option>
            <option value="8">Africa</option>
            <option value="9">Middle East</option>
          </select>
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
            <p><FontAwesomeIcon icon={faTriangleExclamation} /> {error}</p>
          </div>
        )}

        {!isSearching && hasSearched && results.length === 0 && (
          <div className="search-no-results">
            <div className="no-results-icon"><FontAwesomeIcon icon={faGamepad} /></div>
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
              {results.map((game) => {
                const gameInLibrary = getGameInLibrary(game.id);
                const isRemoving = removingGameId === game.id;
                
                // Compact view - minimal info in a row
                if (viewMode === 'compact') {
                  return (
                    <article key={game.id} className={`result-card ${viewMode}`}>
                      <div className="result-cover-compact">
                        {game.boxartUrl ? (
                          <img src={game.boxartUrl} alt={game.title} loading="lazy" />
                        ) : (
                          <div className="cover-placeholder-small">
                            <FontAwesomeIcon icon={faGamepad} />
                          </div>
                        )}
                        {gameInLibrary && (
                          <div className="added-badge-small">✓</div>
                        )}
                      </div>
                      <div className="result-info-compact">
                        <h3 className="result-title-compact">{game.title}</h3>
                        <div className="result-meta-compact">
                          <span className={`platform-badge small ${game.platformId === 5021 ? 'switch2' : 'switch'}`}>
                            {game.platformId === 5021 ? 'S2' : 'S1'}
                          </span>
                          {game.region_id !== undefined && <span className="region-badge small">{getRegionName(game.region_id)}</span>}
                        </div>
                      </div>
                      <div className="result-actions-compact">
                        {isAuthenticated ? (
                          gameInLibrary ? (
                            <button
                              className="btn-icon-only btn-remove"
                              onClick={() => handleRemoveGame(game)}
                              disabled={isRemoving}
                              title="Remove from Library"
                              aria-label={`Remove ${game.title} from library`}
                            >
                              {isRemoving ? <FontAwesomeIcon icon={faHourglassHalf} /> : <FontAwesomeIcon icon={faXmark} />}
                            </button>
                          ) : (
                            <button
                              className="btn-icon-only btn-add"
                              onClick={() => openQuickAdd(game)}
                              disabled={addingGameId === game.id}
                              title="Add to Collection"
                              aria-label={`Add ${game.title} to collection`}
                            >
                              {addingGameId === game.id ? <FontAwesomeIcon icon={faHourglassHalf} /> : '+'}
                            </button>
                          )
                        ) : (
                          <span className="login-hint-small" title="Sign in to add games">🔒</span>
                        )}
                      </div>
                    </article>
                  );
                }
                
                // Grid and List views (original rendering)
                return (
                  <article key={game.id} className={`result-card ${viewMode}`}>
                    <div className="result-cover">
                      {game.boxartUrl ? (
                        <img src={game.boxartUrl} alt={game.title} loading="lazy" />
                      ) : (
                        <div className="cover-placeholder">
                          <span><FontAwesomeIcon icon={faGamepad} /></span>
                        </div>
                      )}
                      {gameInLibrary && (
                        <div className="added-badge">✓ In Library</div>
                      )}
                    </div>
                    <div className="result-info">
                      <h3 className="result-title">{game.title}</h3>
                      <div className="result-meta">
                        <span className={`platform-badge ${game.platformId === 5021 ? 'switch2' : 'switch'}`}>
                          {game.platformId === 5021 ? 'Switch 2' : 'Switch'}
                        </span>
                        {game.region_id !== undefined && <span className="region-badge">{getRegionName(game.region_id)}</span>}
                        <span className="release-date"><FontAwesomeIcon icon={faCalendar} /> {formatDate(game.releaseDate)}</span>
                        {game.players && <span className="players"><FontAwesomeIcon icon={faUsers} /> {game.players} player{game.players > 1 ? 's' : ''}</span>}
                        {game.rating && <span className="rating"><FontAwesomeIcon icon={faStar} /> {game.rating}</span>}
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
                          gameInLibrary ? (
                            <button
                              className="btn-remove-from-collection"
                              onClick={() => handleRemoveGame(game)}
                              disabled={isRemoving}
                            >
                              {isRemoving ? <><FontAwesomeIcon icon={faHourglassHalf} /> Removing...</> : '− Remove from Library'}
                            </button>
                          ) : (
                            <button
                              className="btn-add-to-collection"
                              onClick={() => openQuickAdd(game)}
                              disabled={addingGameId === game.id}
                            >
                              {addingGameId === game.id ? <><FontAwesomeIcon icon={faHourglassHalf} /> Adding...</> : '+ Add to Collection'}
                            </button>
                          )
                        ) : (
                          <span className="login-hint">Sign in to add games</span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
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
            <div className="prompt-icon"><FontAwesomeIcon icon={faGamepad} /></div>
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

      {/* Add Manually Button - Bottom of Search Results */}
      {isAuthenticated && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: '2rem',
          paddingTop: '2rem',
          borderTop: '1px solid var(--border-color)'
        }}>
          <p style={{ 
            marginBottom: '1rem', 
            color: 'var(--text-secondary)', 
            fontSize: '0.9375rem' 
          }}>
            Can't find what you're looking for?
          </p>
          <button onClick={() => setShowManualAddModal(true)} className="btn-add-manual">
            + Add Manually
          </button>
        </div>
      )}
        </>
      )}

      {/* Trending Mode Content */}
      {mode === 'trending' && (
        <div className="trending-container">
          {isTrendingLoading && (
            <div className="search-loading">
              <div className="loading-spinner" />
              <p>Loading trending games...</p>
            </div>
          )}

          {!isTrendingLoading && trendingData && (
            <>
              {/* Recently Added Section */}
              <section className="trending-section">
                <h2 className="trending-section-title">
                  <FontAwesomeIcon icon={faArrowTrendUp} /> Recently Added by Community
                </h2>
                <p className="trending-section-subtitle">Games added by users in the last 30 days</p>
                {trendingData.recentlyAdded.length === 0 ? (
                  <p className="trending-empty">No recent additions yet. Be the first to add a game!</p>
                ) : (
                  <div className="results-grid">
                    {trendingData.recentlyAdded.map((game) => (
                      <TrendingGameCard 
                        key={game.thegamesdbId} 
                        game={game} 
                        userGames={userGames}
                        isAuthenticated={isAuthenticated}
                        onQuickAdd={openQuickAdd}
                        addingGameId={addingGameId}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Top Games Section */}
              <section className="trending-section">
                <h2 className="trending-section-title">
                  <FontAwesomeIcon icon={faFire} /> Top Games
                </h2>
                <p className="trending-section-subtitle">Most popular games in the community</p>
                {trendingData.topGames.length === 0 ? (
                  <p className="trending-empty">No data yet. Start adding games to see what's popular!</p>
                ) : (
                  <div className="results-grid">
                    {trendingData.topGames.map((game) => (
                      <TrendingGameCard 
                        key={game.thegamesdbId} 
                        game={game} 
                        userGames={userGames}
                        isAuthenticated={isAuthenticated}
                        onQuickAdd={openQuickAdd}
                        addingGameId={addingGameId}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {!isTrendingLoading && !trendingData && (
            <div className="search-no-results">
              <div className="no-results-icon"><FontAwesomeIcon icon={faFire} /></div>
              <h3>Unable to load trending data</h3>
              <p>Please try again later</p>
            </div>
          )}
        </div>
      )}

      {/* API Allowance Warning Modal */}
      {showAllowanceWarning && allowanceInfo && (
        <div className="modal-overlay" onClick={() => setShowAllowanceWarning(false)}>
          <div className="allowance-warning-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>{allowanceInfo.remaining === 0 ? <><FontAwesomeIcon icon={faTriangleExclamation} /> API Limit Reached</> : <><FontAwesomeIcon icon={faTriangleExclamation} /> API Limit Warning</>}</h2>
              <button onClick={() => setShowAllowanceWarning(false)} className="modal-close"><FontAwesomeIcon icon={faXmark} /></button>
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
              <button onClick={() => setQuickAddGame(null)} className="modal-close"><FontAwesomeIcon icon={faXmark} /></button>
            </header>
            <div className="quick-add-content">
              <div className="quick-add-game-info">
                {quickAddGame.boxartUrl && (
                  <img src={quickAddGame.boxartUrl} alt={quickAddGame.title} className="quick-add-cover" />
                )}
                <div className="quick-add-details">
                  <h3>{quickAddGame.title}</h3>
                  <p className="release-date"><FontAwesomeIcon icon={faCalendar} /> {formatDate(quickAddGame.releaseDate)}</p>
                </div>
              </div>
              <div className="quick-add-options">
                <div className="form-group">
                  <label>Platform</label>
                  <SegmentedControl
                    options={[
                      { value: 'Nintendo Switch', label: 'Switch', icon: <FontAwesomeIcon icon={faGamepad} /> },
                      { value: 'Nintendo Switch 2', label: 'Switch 2', icon: <FontAwesomeIcon icon={faGamepad} /> },
                    ]}
                    value={quickAddPlatform}
                    onChange={(value) => setQuickAddPlatform(value as Platform)}
                    ariaLabel="Platform"
                    variant="buttons"
                    fullWidth
                  />
                </div>
                <div className="form-group">
                  <label>Format</label>
                  <SegmentedControl
                    options={[
                      { value: 'Physical', label: 'Physical', icon: <FontAwesomeIcon icon={faBox} /> },
                      { value: 'Digital', label: 'Digital', icon: <FontAwesomeIcon icon={faCloud} /> },
                    ]}
                    value={quickAddFormat}
                    onChange={(value) => setQuickAddFormat(value as Format)}
                    ariaLabel="Game format"
                    variant="buttons"
                    fullWidth
                  />
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={quickAddCompleted}
                      onChange={(e) => setQuickAddCompleted(e.target.checked)}
                    />
                    <span>Completed/Beaten</span>
                  </label>
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

      {/* Usage Limit Modal */}
      {showUsageLimitModal && usageInfo && (
        <UsageLimitModal
          onClose={() => setShowUsageLimitModal(false)}
          usage={usageInfo}
        />
      )}

      {/* Delete Confirmation Modal */}
      {gameToDelete && (
        <div className="modal-overlay" onClick={() => setGameToDelete(null)}>
          <div className="delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2><FontAwesomeIcon icon={faTriangleExclamation} /> Remove from Library</h2>
              <button onClick={() => setGameToDelete(null)} className="modal-close"><FontAwesomeIcon icon={faXmark} /></button>
            </header>
            <div className="modal-content">
              <p>Are you sure you want to remove <strong>{gameToDelete.searchResult.title}</strong> from your library?</p>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setGameToDelete(null)}>
                Cancel
              </button>
              <button className="btn-delete" onClick={confirmDelete}>
                Remove from Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Modal */}
      {showManualAddModal && (
        <ManualAddGameModal
          onClose={() => setShowManualAddModal(false)}
          onAdd={handleManualAdd}
        />
      )}

      {/* First Game Celebration Modal */}
      {showCelebrationModal && (
        <FirstGameCelebrationModal
          gameTitle={firstGameTitle}
          onEnableSharing={handleCelebrationEnableSharing}
          onDismiss={handleCelebrationDismiss}
        />
      )}

      {/* Share Library Modal (from celebration flow) */}
      {showShareModal && user && (
        <ShareLibraryModal
          userId={user.id}
          onClose={() => setShowShareModal(false)}
          onSharingEnabled={handleSharingEnabled}
        />
      )}
    </div>
  );
}
