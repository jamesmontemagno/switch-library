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
  faClock
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

  return (
    <div className="admin-dashboard">
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

        {/* Recent Users */}
        {stats.recentUsers.length > 0 && (
          <div className="dashboard-section">
            <h2>
              <FontAwesomeIcon icon={faClock} /> Recent User Registrations
            </h2>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Display Name</th>
                    <th>Registered On</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentUsers.map((user, index) => (
                    <tr key={`${user.displayName}-${index}`}>
                      <td>{user.displayName}</td>
                      <td>{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
