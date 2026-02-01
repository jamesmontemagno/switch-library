import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { useSEO } from '../hooks/useSEO';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faGamepad, faCalendar, faTriangleExclamation, faXmark, faHourglassHalf, faBox, faCloud, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import type { GameEntry, Platform, Format } from '../types';
import { getUpcomingGames, PLATFORM_IDS, type BulkGameResult } from '../services/thegamesdb';
import { saveGame, loadGames } from '../services/database';
import { SegmentedControl } from '../components/SegmentedControl';
import { FirstGameCelebrationModal } from '../components/FirstGameCelebrationModal';
import { ShareLibraryModal } from '../components/ShareLibraryModal';
import './ReleaseCalendar.css';

const FIRST_GAME_CELEBRATION_KEY = 'hasSeenFirstGameCelebration';

interface MonthGroup {
  monthKey: string;
  monthLabel: string;
  games: BulkGameResult[];
}

export function ReleaseCalendar() {
  const { user, isAuthenticated } = useAuth();
  const { preferences, updatePreferences } = usePreferences();
  const isOnline = useOnlineStatus();

  useSEO({
    title: 'Upcoming Nintendo Switch Games - Release Calendar',
    description: 'Browse upcoming Nintendo Switch and Switch 2 game releases. See what\'s coming soon and add games to your wishlist.',
    url: 'https://myswitchlibrary.com/calendar',
  });

  // Page state
  const [upcomingGames, setUpcomingGames] = useState<BulkGameResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [daysAhead, setDaysAhead] = useState<number>(preferences.calendar?.daysAhead || 90);
  const [platformFilter, setPlatformFilter] = useState<'all' | Platform>(preferences.calendar?.platform || 'all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // User's games (for wishlisting)
  const [userGames, setUserGames] = useState<GameEntry[]>([]);

  // Quick add state
  const [quickAddGame, setQuickAddGame] = useState<BulkGameResult | null>(null);
  const [quickAddFormat, setQuickAddFormat] = useState<Format>('Physical');
  const [quickAddPlatform, setQuickAddPlatform] = useState<Platform>('Nintendo Switch');
  const [addingGameId, setAddingGameId] = useState<number | null>(null);

  // Celebration modal
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [firstGameTitle, setFirstGameTitle] = useState('');
  const [hasSeenCelebration, setHasSeenCelebration] = useState(() => {
    try {
      return localStorage.getItem(FIRST_GAME_CELEBRATION_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [showShareModal, setShowShareModal] = useState(false);

  // Collapsed months state
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  // Save filter preferences
  useEffect(() => {
    updatePreferences({
      calendar: { daysAhead, platform: platformFilter },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysAhead, platformFilter]);

  // Load user's games
  useEffect(() => {
    if (user) {
      loadGames(user.id).then(games => setUserGames(games));
    }
  }, [user]);

  // Load upcoming games
  const loadUpcomingGames = useCallback(async (page: number = 1) => {
    if (!isOnline) {
      setError('Offline mode: cannot load upcoming games.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const platformId = platformFilter === 'Nintendo Switch'
        ? PLATFORM_IDS.NINTENDO_SWITCH
        : platformFilter === 'Nintendo Switch 2'
          ? PLATFORM_IDS.NINTENDO_SWITCH_2
          : undefined;

      const result = await getUpcomingGames(daysAhead, platformId, page, 50);
      setUpcomingGames(result.games);
      setTotalPages(result.totalPages);
      setTotalCount(result.totalCount);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to load upcoming games:', err);
      setError('Failed to load upcoming games. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, daysAhead, platformFilter]);

  // Load on mount and when filters change
  useEffect(() => {
    loadUpcomingGames(1);
  }, [loadUpcomingGames]);

  // Group games by month
  const groupedByMonth: MonthGroup[] = (() => {
    const groups: Map<string, { label: string; games: BulkGameResult[] }> = new Map();

    upcomingGames.forEach(game => {
      if (!game.releaseDate) return;

      const date = new Date(game.releaseDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

      if (!groups.has(monthKey)) {
        groups.set(monthKey, { label: monthLabel, games: [] });
      }
      groups.get(monthKey)!.games.push(game);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, { label, games }]) => ({
        monthKey,
        monthLabel: label,
        games: games.sort((a, b) => {
          const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
          const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
          return dateA - dateB;
        }),
      }));
  })();

  const toggleMonth = (monthKey: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  };

  const isGameInLibrary = (gameId: number) => {
    return userGames.some(g => g.thegamesdbId === gameId);
  };

  const openQuickAdd = (game: BulkGameResult) => {
    const detectedPlatform = game.platformId === PLATFORM_IDS.NINTENDO_SWITCH_2
      ? 'Nintendo Switch 2'
      : 'Nintendo Switch';
    setQuickAddPlatform(detectedPlatform);
    setQuickAddGame(game);
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
        status: 'Wishlist', // Default to wishlist for upcoming games
        thegamesdbId: quickAddGame.id,
        coverUrl: quickAddGame.coverUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const isFirstGame = userGames.length === 0 && !hasSeenCelebration;

      setUserGames(prev => [...prev, newGame]);
      setQuickAddGame(null);
      setAddingGameId(null);

      if (isFirstGame) {
        setFirstGameTitle(quickAddGame.title);
        setShowCelebrationModal(true);
      }

      await saveGame(newGame, userGames, true);
    } catch (err) {
      console.error('Failed to add game:', err);
      setAddingGameId(null);
    }
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

  const formatReleaseDate = (dateStr?: string) => {
    if (!dateStr) return 'TBA';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="release-calendar-page">
      {/* Offline Warning */}
      {!isOnline && (
        <div className="offline-banner">
          <FontAwesomeIcon icon={faTriangleExclamation} /> You are offline. Upcoming releases are not available.
        </div>
      )}

      <header className="calendar-header">
        <div>
          <h1><FontAwesomeIcon icon={faCalendarDays} /> Release Calendar</h1>
          <p>See what Nintendo Switch games are coming soon!</p>
        </div>
      </header>

      {/* Filters */}
      <div className="calendar-filters">
        <div className="filter-item">
          <label>Timeframe</label>
          <select value={daysAhead} onChange={(e) => setDaysAhead(parseInt(e.target.value))}>
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
            <option value={90}>Next 90 days</option>
            <option value={180}>Next 6 months</option>
            <option value={365}>Next year</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Platform</label>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as 'all' | Platform)}>
            <option value="all">All Switch</option>
            <option value="Nintendo Switch">Nintendo Switch</option>
            <option value="Nintendo Switch 2">Nintendo Switch 2</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="calendar-content">
        {isLoading && (
          <div className="calendar-loading">
            <div className="loading-spinner" />
            <p>Loading upcoming releases...</p>
          </div>
        )}

        {error && (
          <div className="calendar-error">
            <FontAwesomeIcon icon={faTriangleExclamation} /> {error}
          </div>
        )}

        {!isLoading && !error && upcomingGames.length === 0 && (
          <div className="calendar-empty">
            <FontAwesomeIcon icon={faCalendarDays} className="empty-icon" />
            <h3>No upcoming releases found</h3>
            <p>Try adjusting your filters or check back later.</p>
          </div>
        )}

        {!isLoading && !error && upcomingGames.length > 0 && (
          <>
            <div className="results-summary">
              Found {totalCount} upcoming game{totalCount !== 1 ? 's' : ''} in the next {daysAhead} days
            </div>

            <div className="month-groups">
              {groupedByMonth.map(({ monthKey, monthLabel, games }) => (
                <section key={monthKey} className="month-group">
                  <button
                    className="month-header"
                    onClick={() => toggleMonth(monthKey)}
                    aria-expanded={!collapsedMonths.has(monthKey)}
                    aria-controls={`month-${monthKey}`}
                  >
                    <h2>{monthLabel}</h2>
                    <span className="month-count">{games.length} game{games.length !== 1 ? 's' : ''}</span>
                    <FontAwesomeIcon
                      icon={collapsedMonths.has(monthKey) ? faChevronDown : faChevronUp}
                      className="collapse-icon"
                      aria-hidden="true"
                    />
                  </button>

                  {!collapsedMonths.has(monthKey) && (
                    <div className="month-games" id={`month-${monthKey}`}>
                      {games.map(game => {
                        const inLibrary = isGameInLibrary(game.id);
                        const isAdding = addingGameId === game.id;

                        return (
                          <article key={game.id} className="upcoming-game-card">
                            <div className="game-cover">
                              {game.coverUrl ? (
                                <img src={game.coverUrl} alt={game.title} loading="lazy" />
                              ) : (
                                <div className="cover-placeholder">
                                  <FontAwesomeIcon icon={faGamepad} />
                                </div>
                              )}
                              {inLibrary && (
                                <div className="in-library-badge">✓ In Library</div>
                              )}
                            </div>

                            <div className="game-info">
                              <h3 className="game-title">{game.title}</h3>
                              <div className="game-meta">
                                <span className={`platform-badge ${game.platformId === PLATFORM_IDS.NINTENDO_SWITCH_2 ? 'switch2' : 'switch'}`}>
                                  {game.platformId === PLATFORM_IDS.NINTENDO_SWITCH_2 ? 'Switch 2' : 'Switch'}
                                </span>
                                <span className="release-date">
                                  <FontAwesomeIcon icon={faCalendar} /> {formatReleaseDate(game.releaseDate)}
                                </span>
                              </div>

                              <div className="game-actions">
                                {isAuthenticated ? (
                                  inLibrary ? (
                                    <Link to="/library" className="btn-view-library">
                                      View in Library
                                    </Link>
                                  ) : (
                                    <button
                                      className="btn-add-wishlist"
                                      onClick={() => openQuickAdd(game)}
                                      disabled={isAdding}
                                    >
                                      {isAdding ? (
                                        <><FontAwesomeIcon icon={faHourglassHalf} /> Adding...</>
                                      ) : (
                                        '+ Add to Wishlist'
                                      )}
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
                  )}
                </section>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination-controls">
                <button
                  onClick={() => loadUpcomingGames(currentPage - 1)}
                  disabled={currentPage === 1 || isLoading}
                  className="btn-pagination"
                >
                  ← Previous
                </button>
                <span className="page-indicator">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => loadUpcomingGames(currentPage + 1)}
                  disabled={currentPage === totalPages || isLoading}
                  className="btn-pagination"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Add Modal */}
      {quickAddGame && (
        <div className="modal-overlay" onClick={() => setQuickAddGame(null)}>
          <div className="quick-add-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Add to Wishlist</h2>
              <button onClick={() => setQuickAddGame(null)} className="modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </header>
            <div className="quick-add-content">
              <div className="quick-add-game-info">
                {quickAddGame.coverUrl && (
                  <img src={quickAddGame.coverUrl} alt={quickAddGame.title} className="quick-add-cover" />
                )}
                <div className="quick-add-details">
                  <h3>{quickAddGame.title}</h3>
                  <p className="release-date">
                    <FontAwesomeIcon icon={faCalendar} /> Releases {formatReleaseDate(quickAddGame.releaseDate)}
                  </p>
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
                  <label>Planned Format</label>
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
              </div>
              <div className="quick-add-actions">
                <button className="btn-cancel" onClick={() => setQuickAddGame(null)}>
                  Cancel
                </button>
                <button className="btn-confirm-add" onClick={handleQuickAdd}>
                  Add to Wishlist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* First Game Celebration Modal */}
      {showCelebrationModal && (
        <FirstGameCelebrationModal
          gameTitle={firstGameTitle}
          onEnableSharing={handleCelebrationEnableSharing}
          onDismiss={handleCelebrationDismiss}
        />
      )}

      {/* Share Library Modal */}
      {showShareModal && user && (
        <ShareLibraryModal
          userId={user.id}
          onClose={() => setShowShareModal(false)}
          onSharingEnabled={() => {}}
        />
      )}
    </div>
  );
}
