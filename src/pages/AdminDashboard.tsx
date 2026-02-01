import { useState, useEffect } from 'react';
import { useSEO } from '../hooks/useSEO';
import { getAdminStatistics, type AdminStatistics } from '../services/database';
import { getAdminDatabaseStats, type DatabaseStats } from '../services/thegamesdb';
import { logger } from '../services/logger';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, 
  faGamepad, 
  faShare, 
  faUserFriends, 
  faSearch,
  faChartBar,
  faTrophy,
  faChartLine,
  faDatabase,
  faSync,
  faImage,
  faFileAlt,
  faStar,
  faUserPlus
} from '@fortawesome/free-solid-svg-icons';
import './AdminDashboard.css';

const ADMIN_FUNCTION_KEY = import.meta.env.VITE_ADMIN_FUNCTION_KEY || '';

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStatistics | null>(null);
  const [backendStats, setBackendStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSEO({
    title: 'Admin Dashboard',
    description: 'Admin dashboard with usage statistics and application insights',
  });

  useEffect(() => {
    const loadStatistics = async () => {
      logger.info('AdminDashboard: Starting to load statistics');
      setLoading(true);
      setError(null);
      
      try {
        // Load Supabase statistics
        logger.debug('AdminDashboard: Calling getAdminStatistics()');
        const data = await getAdminStatistics();
        if (data) {
          logger.info('AdminDashboard: Statistics loaded successfully', { 
            totalUsers: data.totalUsers, 
            totalGames: data.totalGames 
          });
          setStats(data);
        } else {
          logger.error('AdminDashboard: getAdminStatistics returned null');
          setError('Failed to load statistics. Admin dashboard only works with Supabase mode.');
        }

        // Load backend database statistics if function key is available
        if (ADMIN_FUNCTION_KEY) {
          logger.debug('AdminDashboard: Calling getAdminDatabaseStats()');
          const backendData = await getAdminDatabaseStats(ADMIN_FUNCTION_KEY);
          if (backendData) {
            logger.info('AdminDashboard: Backend statistics loaded successfully', { 
              totalGames: backendData.totalGames 
            });
            setBackendStats(backendData);
          } else {
            logger.warn('AdminDashboard: getAdminDatabaseStats returned null');
          }
        } else {
          logger.warn('AdminDashboard: VITE_ADMIN_FUNCTION_KEY not configured');
        }
      } catch (err) {
        logger.error('AdminDashboard: Error loading statistics', err);
        console.error('Error loading admin statistics:', err);
        setError('An error occurred while loading statistics.');
      } finally {
        setLoading(false);
      }
    };

    loadStatistics();
  }, []);

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="admin-content">
          <h1>Admin Dashboard</h1>
          <div className="loading-state">Loading statistics...</div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="admin-dashboard">
        <div className="admin-content">
          <h1>Admin Dashboard</h1>
          <div className="error-state">
            <p>{error || 'Failed to load statistics'}</p>
          </div>
        </div>
      </div>
    );
  }

  const calculateGrowthPercent = (recent: number, total: number): string => {
    if (total === 0) return '0.0';
    return ((recent / total) * 100).toFixed(1);
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-content">
        <h1>Admin Dashboard</h1>
        <p className="dashboard-subtitle">Usage statistics and application insights</p>

        {/* Growth Metrics */}
        {(stats.weeklyStats || stats.monthlyStats) && (
          <div className="dashboard-section">
            <h2>
              <FontAwesomeIcon icon={faChartBar} /> Growth Metrics
            </h2>
            <div className="growth-grid">
              {stats.weeklyStats && (
                <div className="growth-card">
                  <h3>Last 7 Days</h3>
                  <div className="growth-stats">
                    <div className="growth-item">
                      <span className="growth-label">New Users</span>
                      <span className="growth-value">
                        +{stats.weeklyStats.newUsers}
                        <span className="growth-percent">
                          ({calculateGrowthPercent(stats.weeklyStats.newUsers, stats.totalUsers)}% of total)
                        </span>
                      </span>
                    </div>
                    <div className="growth-item">
                      <span className="growth-label">Games Added</span>
                      <span className="growth-value">
                        +{stats.weeklyStats.newGames}
                        <span className="growth-percent">
                          ({calculateGrowthPercent(stats.weeklyStats.newGames, stats.totalGames)}% of total)
                        </span>
                      </span>
                    </div>
                    <div className="growth-item">
                      <span className="growth-label">New Follows</span>
                      <span className="growth-value">
                        +{stats.weeklyStats.newFollows}
                        <span className="growth-percent">
                          ({calculateGrowthPercent(stats.weeklyStats.newFollows, stats.totalFollows)}% of total)
                        </span>
                      </span>
                    </div>
                    <div className="growth-item">
                      <span className="growth-label">API Searches</span>
                      <span className="growth-value">+{stats.weeklyStats.apiSearches}</span>
                    </div>
                  </div>
                </div>
              )}
              {stats.monthlyStats && (
                <div className="growth-card">
                  <h3>Last 30 Days</h3>
                  <div className="growth-stats">
                    <div className="growth-item">
                      <span className="growth-label">New Users</span>
                      <span className="growth-value">
                        +{stats.monthlyStats.newUsers}
                        <span className="growth-percent">
                          ({calculateGrowthPercent(stats.monthlyStats.newUsers, stats.totalUsers)}% of total)
                        </span>
                      </span>
                    </div>
                    <div className="growth-item">
                      <span className="growth-label">Games Added</span>
                      <span className="growth-value">
                        +{stats.monthlyStats.newGames}
                        <span className="growth-percent">
                          ({calculateGrowthPercent(stats.monthlyStats.newGames, stats.totalGames)}% of total)
                        </span>
                      </span>
                    </div>
                    <div className="growth-item">
                      <span className="growth-label">New Follows</span>
                      <span className="growth-value">
                        +{stats.monthlyStats.newFollows}
                        <span className="growth-percent">
                          ({calculateGrowthPercent(stats.monthlyStats.newFollows, stats.totalFollows)}% of total)
                        </span>
                      </span>
                    </div>
                    <div className="growth-item">
                      <span className="growth-label">API Searches</span>
                      <span className="growth-value">+{stats.monthlyStats.apiSearches}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ssName="admin-dashboard">
      <div className="admin-content">
        <h1>Admin Dashboard</h1>
        <p className="dashboard-subtitle">Usage statistics and application insights</p>

        {/* Summary Statistics */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faUsers} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Users</div>
              <div className="stat-value">{stats.totalUsers.toLocaleString()}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faGamepad} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Games</div>
              <div className="stat-value">{stats.totalGames.toLocaleString()}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faShare} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Active Sharers</div>
              <div className="stat-value">{stats.activeSharers.toLocaleString()}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faUserFriends} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Follows</div>
              <div className="stat-value">{stats.totalFollows.toLocaleString()}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faSearch} />
            </div>
            <div className="stat-content">
              <div className="stat-label">API Searches</div>
              <div className="stat-value">{stats.apiUsageCount.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Games by Platform */}
        {stats.gamesByPlatform.length > 0 && (
          <div className="dashboard-section">
            <h2>
              <FontAwesomeIcon icon={faChartBar} /> Games by Platform
            </h2>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Count</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.gamesByPlatform.map((item) => (
                    <tr key={item.platform}>
                      <td>{item.platform}</td>
                      <td>{item.count.toLocaleString()}</td>
                      <td>
                        {((item.count / stats.totalGames) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Games by Format */}
        {stats.gamesByFormat.length > 0 && (
          <div className="dashboard-section">
            <h2>
              <FontAwesomeIcon icon={faChartBar} /> Games by Format
            </h2>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Format</th>
                    <th>Count</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.gamesByFormat.map((item) => (
                    <tr key={item.format}>
                      <td>{item.format}</td>
                      <td>{item.count.toLocaleString()}</td>
                      <td>
                        {((item.count / stats.totalGames) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Games */}
        {stats.topGames.length > 0 && (
          <div className="dashboard-section">
            <h2>
              <FontAwesomeIcon icon={faTrophy} /> Top Games by Collection Count
            </h2>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Game Title</th>
                    <th>Collections</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topGames.map((game, index) => (
                    <tr key={`${game.title}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{game.title}</td>
                      <td>{game.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Signups Per Day Chart */}
        {stats.signupsPerDay.length > 0 && (
          <div className="dashboard-section">
            <h2>
              <FontAwesomeIcon icon={faChartLine} /> User Signups (Last 30 Days)
            </h2>
            <div className="signup-chart">
              <div className="chart-container">
                {stats.signupsPerDay.map((day) => {
                  const maxCount = Math.max(...stats.signupsPerDay.map(d => d.count));
                  const heightPercent = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                  return (
                    <div key={day.date} className="chart-bar-wrapper">
                      <div className="chart-bar-label">{day.count}</div>
                      <div className="chart-bar" style={{ height: `${heightPercent}%` }}>
                        <span className="chart-bar-count">{day.count}</span>
                      </div>
                      <div className="chart-date-label">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="chart-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Signups:</span>
                  <span className="summary-value">{stats.signupsPerDay.reduce((sum, d) => sum + d.count, 0)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Peak Day:</span>
                  <span className="summary-value">{Math.max(...stats.signupsPerDay.map(d => d.count))} signups</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Average/Day:</span>
                  <span className="summary-value">
                    {(stats.signupsPerDay.reduce((sum, d) => sum + d.count, 0) / stats.signupsPerDay.length).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Backend Database Statistics */}
        {backendStats && (
          <div className="dashboard-section backend-stats-section">
            <h2>
              <FontAwesomeIcon icon={faDatabase} /> Backend Game Database
            </h2>
            <p className="section-subtitle">
              Azure SQL Database statistics (cached for 5 minutes)
            </p>

            {/* Database Sync Info */}
            {backendStats.lastSyncTime && (
              <div className="sync-info">
                <div className="sync-info-item">
                  <FontAwesomeIcon icon={faSync} className="sync-icon" />
                  <div>
                    <strong>Last Synced:</strong>{' '}
                    {new Date(backendStats.lastSyncTime).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </div>
                </div>
                {backendStats.syncType && (
                  <div className="sync-info-item">
                    <strong>Sync Type:</strong> {backendStats.syncType}
                  </div>
                )}
                {backendStats.gamesSynced !== undefined && (
                  <div className="sync-info-item">
                    <strong>Games Synced:</strong> {backendStats.gamesSynced.toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* Backend Stats Grid */}
            <div className="stats-grid backend-stats-grid">
              <div className="stat-card backend-stat-card">
                <div className="stat-icon">
                  <FontAwesomeIcon icon={faDatabase} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">Total Games in DB</div>
                  <div className="stat-value">{backendStats.totalGames.toLocaleString()}</div>
                </div>
              </div>

              <div className="stat-card backend-stat-card">
                <div className="stat-icon">
                  <FontAwesomeIcon icon={faGamepad} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">Nintendo Switch</div>
                  <div className="stat-value">{backendStats.switchGames.toLocaleString()}</div>
                  <div className="stat-meta">
                    {((backendStats.switchGames / backendStats.totalGames) * 100).toFixed(1)}% of total
                  </div>
                </div>
              </div>

              <div className="stat-card backend-stat-card">
                <div className="stat-icon">
                  <FontAwesomeIcon icon={faGamepad} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">Nintendo Switch 2</div>
                  <div className="stat-value">{backendStats.switch2Games.toLocaleString()}</div>
                  <div className="stat-meta">
                    {((backendStats.switch2Games / backendStats.totalGames) * 100).toFixed(1)}% of total
                  </div>
                </div>
              </div>

              <div className="stat-card backend-stat-card">
                <div className="stat-icon">
                  <FontAwesomeIcon icon={faChartBar} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">Total Genres</div>
                  <div className="stat-value">{backendStats.totalGenres.toLocaleString()}</div>
                </div>
              </div>

              <div className="stat-card backend-stat-card">
                <div className="stat-icon">
                  <FontAwesomeIcon icon={faUserPlus} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">Total Developers</div>
                  <div className="stat-value">{backendStats.totalDevelopers.toLocaleString()}</div>
                </div>
              </div>

              <div className="stat-card backend-stat-card">
                <div className="stat-icon">
                  <FontAwesomeIcon icon={faUserPlus} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">Total Publishers</div>
                  <div className="stat-value">{backendStats.totalPublishers.toLocaleString()}</div>
                </div>
              </div>

              <div className="stat-card backend-stat-card">
                <div className="stat-icon">
                  <FontAwesomeIcon icon={faImage} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">Games with Boxart</div>
                  <div className="stat-value">{backendStats.gamesWithBoxart.toLocaleString()}</div>
                  <div className="stat-meta">
                    {((backendStats.gamesWithBoxart / backendStats.totalGames) * 100).toFixed(1)}% coverage
                  </div>
                </div>
              </div>

              <div className="stat-card backend-stat-card">
                <div className="stat-icon">
                  <FontAwesomeIcon icon={faFileAlt} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">Games with Overview</div>
                  <div className="stat-value">{backendStats.gamesWithOverview.toLocaleString()}</div>
                  <div className="stat-meta">
                    {((backendStats.gamesWithOverview / backendStats.totalGames) * 100).toFixed(1)}% coverage
                  </div>
                </div>
              </div>

              <div className="stat-card backend-stat-card">
                <div className="stat-icon">
                  <FontAwesomeIcon icon={faStar} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">Average Rating</div>
                  <div className="stat-value">{backendStats.averageRating.toFixed(2)}</div>
                </div>
              </div>

              <div className="stat-card backend-stat-card">
                <div className="stat-icon">
                  <FontAwesomeIcon icon={faUserFriends} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">Co-op Games</div>
                  <div className="stat-value">{backendStats.gamesWithCoop.toLocaleString()}</div>
                  <div className="stat-meta">
                    {((backendStats.gamesWithCoop / backendStats.totalGames) * 100).toFixed(1)}% of total
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Show message if function key is not configured */}
        {!ADMIN_FUNCTION_KEY && (
          <div className="dashboard-section">
            <div className="info-message">
              <FontAwesomeIcon icon={faDatabase} />
              <p>
                Backend database statistics are not available. Configure <code>VITE_ADMIN_FUNCTION_KEY</code> environment variable to enable.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
