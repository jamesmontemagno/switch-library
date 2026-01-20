import { useState, useEffect } from 'react';
import { useSEO } from '../hooks/useSEO';
import { getAdminStatistics, type AdminStatistics } from '../services/database';
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
  faChartLine
} from '@fortawesome/free-solid-svg-icons';
import './AdminDashboard.css';

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStatistics | null>(null);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
      </div>
    </div>
  );
}
