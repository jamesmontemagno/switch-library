import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartColumn, faTriangleExclamation, faCircleCheck, faUser, faChartLine, faGamepad, faCheck } from '@fortawesome/free-solid-svg-icons';
import type { GameEntry } from '../types';
import { loadSharedGames, getSharedUserProfile } from '../services/database';
import { normalizeGameTitle, gamesMatch, type GameComparisonKey } from '../utils/gameComparison';
import './Compare.css';

interface UserLibrary {
  userId: string;
  displayName: string;
  avatarUrl: string;
  games: GameEntry[];
}

type CompareTab = 'common' | 'unique-left' | 'unique-right' | 'stats';

export function Compare() {
  const { shareId1, shareId2 } = useParams<{ shareId1: string; shareId2: string }>();
  const navigate = useNavigate();
  
  const [leftUser, setLeftUser] = useState<UserLibrary | null>(null);
  const [rightUser, setRightUser] = useState<UserLibrary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CompareTab>('common');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dynamic page title based on compared users
  useSEO({
    title: leftUser && rightUser 
      ? `Compare Libraries: ${leftUser.displayName} vs ${rightUser.displayName}`
      : 'Compare Libraries',
    description: leftUser && rightUser
      ? `Compare Nintendo Switch game collections between ${leftUser.displayName} and ${rightUser.displayName}. Find common games and unique titles.`
      : 'Compare two Nintendo Switch game libraries side by side',
  });

  useEffect(() => {
    async function loadBothLibraries() {
      if (!shareId1 || !shareId2) {
        setError('Invalid comparison link');
        setIsLoading(false);
        return;
      }

      try {
        const [user1Info, user1Games, user2Info, user2Games] = await Promise.all([
          getSharedUserProfile(shareId1),
          loadSharedGames(shareId1),
          getSharedUserProfile(shareId2),
          loadSharedGames(shareId2),
        ]);

        if (!user1Info || !user2Info) {
          setError('One or both libraries are not available');
          setIsLoading(false);
          return;
        }

        setLeftUser({
          userId: shareId1,
          displayName: user1Info.displayName,
          avatarUrl: user1Info.avatarUrl,
          games: user1Games,
        });

        setRightUser({
          userId: shareId2,
          displayName: user2Info.displayName,
          avatarUrl: user2Info.avatarUrl,
          games: user2Games,
        });
      } catch (err) {
        console.error('Failed to load libraries:', err);
        setError('Failed to load libraries for comparison');
      } finally {
        setIsLoading(false);
      }
    }

    loadBothLibraries();
  }, [shareId1, shareId2]);

  const comparison = useMemo(() => {
    if (!leftUser || !rightUser) return null;

    // Create comparison keys for all games in both libraries
    const leftGameKeys: (GameComparisonKey & { originalGame: GameEntry })[] = leftUser.games.map(g => ({
      id: g.thegamesdbId,
      normalizedTitle: normalizeGameTitle(g.title),
      originalGame: g,
    }));

    const rightGameKeys: (GameComparisonKey & { originalGame: GameEntry })[] = rightUser.games.map(g => ({
      id: g.thegamesdbId,
      normalizedTitle: normalizeGameTitle(g.title),
      originalGame: g,
    }));

    // Find common games using improved matching logic
    const commonGames: GameEntry[] = [];
    const uniqueLeft: GameEntry[] = [];
    
    for (const leftKey of leftGameKeys) {
      const matchFound = rightGameKeys.some(rightKey => gamesMatch(leftKey, rightKey));
      if (matchFound) {
        commonGames.push(leftKey.originalGame);
      } else {
        uniqueLeft.push(leftKey.originalGame);
      }
    }

    // Find unique games in right library
    const uniqueRight: GameEntry[] = [];
    for (const rightKey of rightGameKeys) {
      const matchFound = leftGameKeys.some(leftKey => gamesMatch(leftKey, rightKey));
      if (!matchFound) {
        uniqueRight.push(rightKey.originalGame);
      }
    }

    const getStats = (games: GameEntry[]) => ({
      total: games.length,
      switch: games.filter(g => g.platform === 'Nintendo Switch').length,
      switch2: games.filter(g => g.platform === 'Nintendo Switch 2').length,
      physical: games.filter(g => g.format === 'Physical').length,
      digital: games.filter(g => g.format === 'Digital').length,
      completed: games.filter(g => g.completed).length,
    });

    return {
      common: commonGames,
      uniqueLeft,
      uniqueRight,
      leftStats: getStats(leftUser.games),
      rightStats: getStats(rightUser.games),
      commonStats: getStats(commonGames),
    };
  }, [leftUser, rightUser]);

  const displayedGames = useMemo(() => {
    if (!comparison) return [];
    
    let games: GameEntry[] = [];
    switch (activeTab) {
      case 'common':
        games = comparison.common;
        break;
      case 'unique-left':
        games = comparison.uniqueLeft;
        break;
      case 'unique-right':
        games = comparison.uniqueRight;
        break;
      default:
        return [];
    }

    if (searchQuery) {
      games = games.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return games.sort((a, b) => a.title.localeCompare(b.title));
  }, [comparison, activeTab, searchQuery]);

  if (isLoading) {
    return (
      <div className="compare-page">
        <div className="loading-container">
          <div className="loading-spinner" aria-label="Loading" />
          <p>Loading libraries...</p>
        </div>
      </div>
    );
  }

  if (error || !leftUser || !rightUser || !comparison) {
    return (
      <div className="compare-page">
        <div className="error-state">
          <div className="error-icon"><FontAwesomeIcon icon={faTriangleExclamation} /></div>
          <h2>Comparison Not Available</h2>
          <p>{error || 'Unable to compare libraries'}</p>
          <button onClick={() => navigate('/')} className="btn-home">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="compare-page">
      <header className="compare-header">
        <h1><FontAwesomeIcon icon={faChartColumn} /> Library Comparison</h1>
        <div className="compare-users">
          <div className="user-card">
            {leftUser.avatarUrl && (
              <img src={leftUser.avatarUrl} alt={leftUser.displayName} className="user-avatar" />
            )}
            <div>
              <h3>{leftUser.displayName}</h3>
              <span>{leftUser.games.length} games</span>
            </div>
          </div>
          <div className="vs-badge">VS</div>
          <div className="user-card">
            {rightUser.avatarUrl && (
              <img src={rightUser.avatarUrl} alt={rightUser.displayName} className="user-avatar" />
            )}
            <div>
              <h3>{rightUser.displayName}</h3>
              <span>{rightUser.games.length} games</span>
            </div>
          </div>
        </div>
      </header>

      <div className="compare-summary">
        <div className="summary-card common">
          <span className="summary-value">{comparison.common.length}</span>
          <span className="summary-label">Games in Common</span>
        </div>
        <div className="summary-card unique">
          <span className="summary-value">{comparison.uniqueLeft.length}</span>
          <span className="summary-label">Only {leftUser.displayName}</span>
        </div>
        <div className="summary-card unique">
          <span className="summary-value">{comparison.uniqueRight.length}</span>
          <span className="summary-label">Only {rightUser.displayName}</span>
        </div>
        <div className="summary-card match">
          <span className="summary-value">
            {Math.round((comparison.common.length / Math.max(leftUser.games.length, rightUser.games.length)) * 100)}%
          </span>
          <span className="summary-label">Match Rate</span>
        </div>
      </div>

      <div className="compare-tabs">
        <button
          className={`tab-btn ${activeTab === 'common' ? 'active' : ''}`}
          onClick={() => setActiveTab('common')}
        >
          <FontAwesomeIcon icon={faCircleCheck} /> In Common ({comparison.common.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'unique-left' ? 'active' : ''}`}
          onClick={() => setActiveTab('unique-left')}
        >
          <FontAwesomeIcon icon={faUser} /> Only {leftUser.displayName} ({comparison.uniqueLeft.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'unique-right' ? 'active' : ''}`}
          onClick={() => setActiveTab('unique-right')}
        >
          <FontAwesomeIcon icon={faUser} /> Only {rightUser.displayName} ({comparison.uniqueRight.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <FontAwesomeIcon icon={faChartLine} /> Stats
        </button>
      </div>

      {activeTab === 'stats' ? (
        <div className="stats-comparison">
          <table className="stats-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>{leftUser.displayName}</th>
                <th>{rightUser.displayName}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Games</td>
                <td className={comparison.leftStats.total >= comparison.rightStats.total ? 'winner' : ''}>
                  {comparison.leftStats.total}
                </td>
                <td className={comparison.rightStats.total >= comparison.leftStats.total ? 'winner' : ''}>
                  {comparison.rightStats.total}
                </td>
              </tr>
              <tr>
                <td>Switch Games</td>
                <td className={comparison.leftStats.switch >= comparison.rightStats.switch ? 'winner' : ''}>
                  {comparison.leftStats.switch}
                </td>
                <td className={comparison.rightStats.switch >= comparison.leftStats.switch ? 'winner' : ''}>
                  {comparison.rightStats.switch}
                </td>
              </tr>
              <tr>
                <td>Switch 2 Games</td>
                <td className={comparison.leftStats.switch2 >= comparison.rightStats.switch2 ? 'winner' : ''}>
                  {comparison.leftStats.switch2}
                </td>
                <td className={comparison.rightStats.switch2 >= comparison.leftStats.switch2 ? 'winner' : ''}>
                  {comparison.rightStats.switch2}
                </td>
              </tr>
              <tr>
                <td>Physical Copies</td>
                <td className={comparison.leftStats.physical >= comparison.rightStats.physical ? 'winner' : ''}>
                  {comparison.leftStats.physical}
                </td>
                <td className={comparison.rightStats.physical >= comparison.leftStats.physical ? 'winner' : ''}>
                  {comparison.rightStats.physical}
                </td>
              </tr>
              <tr>
                <td>Digital Copies</td>
                <td className={comparison.leftStats.digital >= comparison.rightStats.digital ? 'winner' : ''}>
                  {comparison.leftStats.digital}
                </td>
                <td className={comparison.rightStats.digital >= comparison.leftStats.digital ? 'winner' : ''}>
                  {comparison.rightStats.digital}
                </td>
              </tr>
              <tr>
                <td>Completed</td>
                <td className={comparison.leftStats.completed >= comparison.rightStats.completed ? 'winner' : ''}>
                  {comparison.leftStats.completed}
                </td>
                <td className={comparison.rightStats.completed >= comparison.leftStats.completed ? 'winner' : ''}>
                  {comparison.rightStats.completed}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="compare-toolbar">
            <input
              type="search"
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <span className="results-count">
              {displayedGames.length} game{displayedGames.length !== 1 ? 's' : ''}
            </span>
          </div>

          {displayedGames.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><FontAwesomeIcon icon={faGamepad} /></div>
              <h2>No games found</h2>
              <p>{searchQuery ? 'Try a different search term' : 'No games in this category'}</p>
            </div>
          ) : (
            <div className="compare-games-grid">
              {displayedGames.map(game => (
                <article key={game.id} className="compare-game-card">
                  <div className="compare-game-cover">
                    {game.coverUrl ? (
                      <img src={game.coverUrl} alt={game.title} />
                    ) : (
                      <div className="cover-placeholder"><FontAwesomeIcon icon={faGamepad} /></div>
                    )}
                    {game.completed && (
                      <div className="completed-badge" title="Completed"><FontAwesomeIcon icon={faCheck} /></div>
                    )}
                  </div>
                  <div className="compare-game-info">
                    <h3>{game.title}</h3>
                    <div className="game-tags">
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
          )}
        </>
      )}
    </div>
  );
}
