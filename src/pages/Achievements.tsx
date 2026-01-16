import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSEO } from '../hooks/useSEO';
import { loadGames, getFollowing, getShareProfile } from '../services/database';
import { 
  ACHIEVEMENTS, 
  getUserAchievements, 
  calculateUserStats, 
  checkAchievements,
  calculateAchievementProgress,
  type UserStats,
} from '../services/achievements';
import { SegmentedControl } from '../components/SegmentedControl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTrophy, 
  faGamepad, 
  faBoxOpen, 
  faBoxes, 
  faStore, 
  faWarehouse, 
  faCrown,
  faCheckCircle,
  faCheckDouble,
  faMedal,
  faStar,
  faPercent,
  faGem,
  faUserPlus,
  faUserGroup,
  faUsers,
  faShareNodes,
  faLayerGroup,
  faCompactDisc,
  faDownload,
  faRocket,
  faHeart,
  faNoteSticky,
  faCalendar,
  faCake,
  faLock,
} from '@fortawesome/free-solid-svg-icons';
import './Achievements.css';

// Map achievement icon names to actual FontAwesome icons
const iconMap: Record<string, typeof faTrophy> = {
  faTrophy,
  faGamepad,
  faBoxOpen,
  faBoxes,
  faStore,
  faWarehouse,
  faCrown,
  faCheckCircle,
  faCheckDouble,
  faMedal,
  faStar,
  faPercent,
  faGem,
  faUserPlus,
  faUserGroup,
  faUsers,
  faShareNodes,
  faLayerGroup,
  faCompactDisc,
  faDownload,
  faRocket,
  faHeart,
  faNoteSticky,
  faCalendar,
  faCake,
};

type FilterType = 'all' | 'unlocked' | 'locked';
type CategoryFilter = 'all' | 'collection' | 'completion' | 'social' | 'variety' | 'milestone';

export function Achievements() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  useSEO({
    title: 'Achievements - My Switch Library',
    description: 'Track your gaming achievements and unlock badges for your Nintendo Switch collection',
  });

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      
      try {
        // Load games and calculate stats
        const games = await loadGames(user.id);
        const calculatedStats = calculateUserStats(games);
        setStats(calculatedStats);
        
        // Load friend count
        const following = await getFollowing(user.id);
        setFriendCount(following.length);
        
        // Load sharing status
        const shareProfile = await getShareProfile(user.id);
        setSharingEnabled(shareProfile?.enabled || false);
        
        // Preload user achievements (not used for display, but could be used for tracking)
        await getUserAchievements(user.id);
      } catch (error) {
        console.error('Failed to load achievement data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [user]);

  if (!user) {
    return <div className="achievements-container">Please sign in to view achievements.</div>;
  }

  if (isLoading) {
    return (
      <div className="achievements-container">
        <div className="loading">Loading achievements...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="achievements-container">
        <div className="error">Failed to load achievement data.</div>
      </div>
    );
  }

  // Determine which achievements are unlocked
  const unlockedAchievementIds = checkAchievements(
    stats,
    friendCount,
    sharingEnabled,
    user.createdAt
  );
  const unlockedSet = new Set(unlockedAchievementIds);

  // Filter achievements
  let filteredAchievements = ACHIEVEMENTS;
  
  if (categoryFilter !== 'all') {
    filteredAchievements = filteredAchievements.filter(a => a.category === categoryFilter);
  }
  
  if (filter === 'unlocked') {
    filteredAchievements = filteredAchievements.filter(a => unlockedSet.has(a.id));
  } else if (filter === 'locked') {
    filteredAchievements = filteredAchievements.filter(a => !unlockedSet.has(a.id));
  }

  // Calculate totals
  const totalAchievements = ACHIEVEMENTS.length;
  const unlockedCount = unlockedAchievementIds.length;
  const progressPercent = Math.round((unlockedCount / totalAchievements) * 100);

  return (
    <div className="achievements-container">
      <div className="achievements-header">
        <div className="header-top">
          <h1>
            <FontAwesomeIcon icon={faTrophy} className="header-icon" />
            Achievements
          </h1>
          <div className="achievement-summary">
            <div className="summary-stat">
              <span className="stat-value">{unlockedCount}</span>
              <span className="stat-label">/ {totalAchievements}</span>
            </div>
            <div className="summary-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="progress-text">{progressPercent}% Complete</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-section">
          <div className="filter-group">
            <label>Status</label>
            <SegmentedControl
              options={[
                { value: 'all', label: 'All' },
                { value: 'unlocked', label: 'Unlocked' },
                { value: 'locked', label: 'Locked' },
              ]}
              value={filter}
              onChange={(value) => setFilter(value as FilterType)}
              ariaLabel="Filter achievements by status"
              variant="buttons"
            />
          </div>
          
          <div className="filter-group">
            <label>Category</label>
            <SegmentedControl
              options={[
                { value: 'all', label: 'All' },
                { value: 'collection', label: 'Collection' },
                { value: 'completion', label: 'Completion' },
                { value: 'social', label: 'Social' },
                { value: 'variety', label: 'Variety' },
                { value: 'milestone', label: 'Milestone' },
              ]}
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value as CategoryFilter)}
              ariaLabel="Filter achievements by category"
              variant="buttons"
            />
          </div>
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="achievements-grid">
        {filteredAchievements.length === 0 ? (
          <div className="no-achievements">
            <FontAwesomeIcon icon={faLock} size="3x" />
            <p>No achievements match your filters</p>
          </div>
        ) : (
          filteredAchievements.map(achievement => {
            const isUnlocked = unlockedSet.has(achievement.id);
            const progress = calculateAchievementProgress(achievement, stats, friendCount);
            const icon = iconMap[achievement.icon] || faTrophy;
            
            return (
              <div 
                key={achievement.id} 
                className={`achievement-card ${isUnlocked ? 'unlocked' : 'locked'} rarity-${achievement.rarity}`}
              >
                <div className="achievement-icon">
                  <FontAwesomeIcon icon={isUnlocked ? icon : faLock} />
                </div>
                <div className="achievement-content">
                  <div className="achievement-header-row">
                    <h3 className="achievement-name">{achievement.name}</h3>
                    <span className={`rarity-badge rarity-${achievement.rarity}`}>
                      {achievement.rarity}
                    </span>
                  </div>
                  <p className="achievement-description">{achievement.description}</p>
                  <div className="achievement-category">
                    {achievement.category}
                  </div>
                  {!isUnlocked && progress > 0 && (
                    <div className="achievement-progress">
                      <div className="progress-bar-small">
                        <div 
                          className="progress-fill-small" 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="progress-text-small">{Math.round(progress)}%</span>
                    </div>
                  )}
                  {isUnlocked && (
                    <div className="unlocked-badge">
                      <FontAwesomeIcon icon={faCheckCircle} />
                      <span>Unlocked</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
