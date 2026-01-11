import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { useSEO } from '../hooks/useSEO';
import { logger } from '../services/logger';
import type { FriendWithDetails, FollowerEntry } from '../types';
import { 
  getFollowing, 
  getFollowers,
  getShareProfile, 
  followUser
} from '../services/database';
import { AddFriendModal } from '../components/AddFriendModal';
import { RemoveFriendModal } from '../components/RemoveFriendModal';
import { EditNicknameModal } from '../components/EditNicknameModal';
import { ShareLibraryModal } from '../components/ShareLibraryModal';
import { SegmentedControl } from '../components/SegmentedControl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserGroup, faMagnifyingGlass, faEye, faPenToSquare, faArrowsLeftRight, faUserPlus, faRotate, faUserCheck, faTableCells, faList, faGripLines, faUsers, faUserMinus, faLink, faGear } from '@fortawesome/free-solid-svg-icons';
import './Friends.css';

type SortOption = 'added_desc' | 'added_asc' | 'nickname_asc' | 'nickname_desc' | 'games_desc' | 'games_asc';
type ViewMode = 'grid' | 'list' | 'compact';
type TabType = 'following' | 'followers';

export function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { preferences, updatePreferences } = usePreferences();
  
  useSEO({
    title: 'Following - My Switch Library',
    description: 'Manage your Nintendo Switch gaming connections. View their collections, compare libraries, and discover shared games.',
    url: 'https://myswitchlibrary.com/friends',
  });
  
  const [activeTab, setActiveTab] = useState<TabType>('following');
  const [following, setFollowing] = useState<FriendWithDetails[]>([]);
  const [followers, setFollowers] = useState<FollowerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(preferences.friends?.sortBy || 'added_desc');
  const [viewMode, setViewMode] = useState<ViewMode>(preferences.friends?.viewMode || 'grid');
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editingFriend, setEditingFriend] = useState<FriendWithDetails | null>(null);
  const [removingFriend, setRemovingFriend] = useState<FriendWithDetails | null>(null);
  
  // Compare functionality
  const [userShareId, setUserShareId] = useState<string | null>(null);
  const [hasSharingEnabled, setHasSharingEnabled] = useState<boolean>(false);
  const [comparingFriend, setComparingFriend] = useState<string | null>(null);
  
  // Processing states
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  // Show toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Save preferences when sort/view change
  useEffect(() => {
    updatePreferences({
      friends: {
        sortBy,
        viewMode,
      },
    });
  }, [sortBy, viewMode, updatePreferences]);

  // Load following, followers, and requests on mount
  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [userFollowing, userFollowers, shareProfile] = await Promise.all([
        getFollowing(user.id),
        getFollowers(user.id),
        getShareProfile(user.id),
      ]);
      setFollowing(userFollowing);
      setFollowers(userFollowers);
      setUserShareId(shareProfile?.shareId || null);
      setHasSharingEnabled(shareProfile?.enabled || false);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handler for when sharing is enabled
  const handleSharingEnabled = useCallback(async () => {
    if (!user) return;
    try {
      const shareProfile = await getShareProfile(user.id);
      setUserShareId(shareProfile?.shareId || null);
      setHasSharingEnabled(shareProfile?.enabled || false);
      showToast('Sharing enabled successfully!', 'success');
    } catch (error) {
      console.error('Failed to refresh share profile:', error);
    }
  }, [user, showToast]);

  // Log the current logged-in user for debugging
  useEffect(() => {
    if (user) {
      logger.info('Friends page loaded', {
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
      });
    }
  }, [user]);

  // Filter and sort following
  const filteredFollowing = following
    .filter(person => {
      const matchesSearch = person.nickname.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'added_desc':
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        case 'added_asc':
          return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
        case 'nickname_asc':
          return a.nickname.localeCompare(b.nickname);
        case 'nickname_desc':
          return b.nickname.localeCompare(a.nickname);
        case 'games_desc':
          return b.gameCount - a.gameCount;
        case 'games_asc':
          return a.gameCount - b.gameCount;
        default:
          return 0;
      }
    });

  const handleCompare = async (friend: FriendWithDetails) => {
    if (!user) return;
    
    // Check if user has sharing enabled
    if (!userShareId) {
      setComparingFriend(friend.id);
      setTimeout(() => setComparingFriend(null), 3000);
      return;
    }
    
    // Navigate to compare page
    navigate(`/compare/${userShareId}/${friend.friendShareId}`);
  };

  // Handle following a follower back
  const handleFollowFollower = async (follower: FollowerEntry) => {
    if (!user || !follower.followerShareId) return;
    setProcessingAction(follower.followerUserId);
    
    try {
      const success = await followUser(user.id, follower.followerShareId, follower.profile?.displayName || 'User');
      if (success) {
        showToast(`Now following ${follower.profile?.displayName || 'user'}`, 'success');
        await fetchData();
      } else {
        showToast('Failed to follow', 'error');
      }
    } catch (error) {
      console.error('Failed to follow:', error);
      // Show specific error message if available
      const errorMessage = error instanceof Error ? error.message : 'Failed to follow';
      showToast(errorMessage, 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="friends">
        <div className="loading-container">
          <div className="loading-spinner" aria-label="Loading" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="friends">
      {/* Toast notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="alert">
          {toast.message}
        </div>
      )}
      
      <header className="friends-header">
        <div>
          <h1><FontAwesomeIcon icon={faUserGroup} /> Following</h1>
        </div>
        <div className="header-actions">
          <button onClick={fetchData} className="btn-refresh" title="Refresh">
            <FontAwesomeIcon icon={faRotate} />
          </button>
          <button 
            onClick={() => setShowShareModal(true)} 
            className={`btn-share ${hasSharingEnabled ? 'active' : ''}`}
            title="Manage Sharing Settings"
          >
            <FontAwesomeIcon icon={faLink} /> {showShareModal ? 'Hide Sharing' : 'Share'}
          </button>
          <button 
            onClick={() => setShowAddModal(true)} 
            className="btn-add-friend"
            disabled={!hasSharingEnabled}
            title={!hasSharingEnabled ? 'Enable sharing on your library first' : 'Follow a user'}
            style={!hasSharingEnabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            <FontAwesomeIcon icon={faUserPlus} />
            Follow User
          </button>
        </div>
      </header>

      {/* Warning banner if sharing is not enabled */}
      {!hasSharingEnabled && (
        <div style={{
          padding: '1rem',
          margin: '0 0 1.5rem 0',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}>
          <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Sharing Required to Follow Others</strong>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              You must enable sharing on your library before you can follow other users. 
              This ensures a reciprocal community where everyone shares their collections.
            </p>
            <button
              onClick={() => setShowShareModal(true)}
              style={{
                marginTop: '0.75rem',
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FontAwesomeIcon icon={faGear} />
              Manage Sharing Settings
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="friends-tabs-container">
        <SegmentedControl
          options={[
            { value: 'following', label: 'Following', icon: <FontAwesomeIcon icon={faUserCheck} />, count: following.length },
            { value: 'followers', label: 'Followers', icon: <FontAwesomeIcon icon={faUsers} />, count: followers.length },
          ]}
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="Friends tabs"
          variant="tabs"
          fullWidth
        />
      </div>

      {/* Following Tab */}
      {activeTab === 'following' && (
        <>
          {following.length > 0 && (
            <div className="friends-toolbar">
              <input
                type="search"
                placeholder="Search following..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                aria-label="Search following"
              />
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="filter-select"
                aria-label="Sort following"
              >
                <option value="added_desc">Date Added ↓</option>
                <option value="added_asc">Date Added ↑</option>
                <option value="nickname_asc">Nickname A-Z</option>
                <option value="nickname_desc">Nickname Z-A</option>
                <option value="games_desc">Game Count ↓</option>
                <option value="games_asc">Game Count ↑</option>
              </select>
              
              <div className="view-toggle">
                <SegmentedControl
                  options={[
                    { value: 'grid', label: 'Grid view', icon: <FontAwesomeIcon icon={faTableCells} /> },
                    { value: 'list', label: 'List view', icon: <FontAwesomeIcon icon={faList} /> },
                    { value: 'compact', label: 'Compact view', icon: <FontAwesomeIcon icon={faGripLines} /> },
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
          )}

          {filteredFollowing.length === 0 ? (
            <div className="empty-state">
              {following.length === 0 ? (
                <>
                  <div className="empty-icon">
                    <FontAwesomeIcon icon={faUserGroup} />
                  </div>
                  <h2>Not following anyone yet</h2>
                  <p>
                    Visit a shared library and click "Follow" to add them here.<br />
                    You can also follow users directly by entering their share URL.
                  </p>
                  <button onClick={() => setShowAddModal(true)} className="btn-add-friend">
                    <FontAwesomeIcon icon={faUserPlus} />
                    Follow Your First User
                  </button>
                  <div className="example-url">
                    Example: https://myswitchlibrary.com/shared/abc-123-xyz
                  </div>
                </>
              ) : (
                <>
                  <div className="empty-icon">
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                  </div>
                  <h2>No matches found</h2>
                  <p>Try adjusting your search.</p>
                </>
              )}
            </div>
          ) : (
            <div className={`friends-${viewMode}`}>
              {filteredFollowing.map((person) => (
                <div key={person.id} className="friend-card">
                  <div className="friend-card-header">
                    <img
                      src={person.profile?.avatarUrl || '/android-chrome-192x192.png'}
                      alt={person.nickname}
                      className="friend-avatar"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/android-chrome-192x192.png';
                      }}
                    />
                    <div className="friend-info">
                      <h3>{person.nickname}</h3>
                      <p>
                        {person.gameCount} {person.gameCount === 1 ? 'game' : 'games'}
                        {person.theyFollowYou && <span className="follows-you-badge"> • Follows you</span>}
                      </p>
                    </div>
                  </div>
                  <div className="friend-actions">
                    <button
                      onClick={() => navigate(`/shared/${person.friendShareId}`)}
                      title="View Library"
                    >
                      <FontAwesomeIcon icon={faEye} /> View
                    </button>
                    {comparingFriend === person.id ? (
                      <div className="compare-button-wrapper">
                        <button disabled title="Enable sharing in Settings">
                          <FontAwesomeIcon icon={faArrowsLeftRight} /> Compare
                        </button>
                        <span className="compare-tooltip">
                          Enable sharing in Settings to compare
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCompare(person)}
                        title="Compare Libraries"
                      >
                        <FontAwesomeIcon icon={faArrowsLeftRight} /> Compare
                      </button>
                    )}
                    <button
                      onClick={() => setEditingFriend(person)}
                      title="Edit Nickname"
                    >
                      <FontAwesomeIcon icon={faPenToSquare} /> Edit
                    </button>
                    <button
                      onClick={() => setRemovingFriend(person)}
                      title="Unfollow"
                    >
                      <FontAwesomeIcon icon={faUserMinus} /> Unfollow
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Followers Tab */}
      {activeTab === 'followers' && (
        <>
          {followers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <FontAwesomeIcon icon={faUsers} />
              </div>
              <h2>No followers yet</h2>
              <p>
                Share your library link to let others follow you!<br />
                When someone follows you, they'll appear here.
              </p>
            </div>
          ) : (
            <div className="requests-list">
              {followers.map((follower) => (
                <div key={follower.followerUserId} className="request-card">
                  <div className="request-card-header">
                    <img
                      src={follower.profile?.avatarUrl || '/android-chrome-192x192.png'}
                      alt={follower.profile?.displayName || 'User'}
                      className="request-avatar"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/android-chrome-192x192.png';
                      }}
                    />
                    <div className="request-info">
                      <h3>{follower.profile?.displayName || 'Unknown User'}</h3>
                      <p className="request-meta">
                        {follower.gameCount > 0 && `${follower.gameCount} ${follower.gameCount === 1 ? 'game' : 'games'}`}
                        {follower.youFollowThem && <span className="follows-you-badge"> • You follow them</span>}
                      </p>
                    </div>
                  </div>
                  <div className="request-actions">
                    <button
                      onClick={() => navigate(`/shared/${follower.followerShareId}`)}
                      title="View Library"
                      className="btn-view"
                    >
                      <FontAwesomeIcon icon={faEye} />
                      View
                    </button>
                    {!follower.youFollowThem && (
                      <button
                        className="btn-accept"
                        onClick={() => handleFollowFollower(follower)}
                        disabled={processingAction === follower.followerUserId || !hasSharingEnabled}
                        title={!hasSharingEnabled ? 'Enable sharing on your library first' : 'Follow back'}
                        style={!hasSharingEnabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                      >
                        <FontAwesomeIcon icon={faUserPlus} />
                        Follow Back
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showAddModal && (
        <AddFriendModal
          onClose={() => setShowAddModal(false)}
          onAdd={fetchData}
        />
      )}

      {editingFriend && (
        <EditNicknameModal
          friendId={editingFriend.id}
          currentNickname={editingFriend.nickname}
          onClose={() => setEditingFriend(null)}
          onUpdate={fetchData}
        />
      )}

      {removingFriend && (
        <RemoveFriendModal
          friendId={removingFriend.id}
          friendNickname={removingFriend.nickname}
          onClose={() => setRemovingFriend(null)}
          onRemove={fetchData}
        />
      )}

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
