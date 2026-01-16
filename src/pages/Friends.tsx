import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { useSEO } from '../hooks/useSEO';
import { useToast } from '../contexts/ToastContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { logger } from '../services/logger';
import type { FriendWithDetails, FollowerEntry } from '../types';
import { 
  getFollowing, 
  getFollowers,
  getShareProfile, 
  followUser
} from '../services/database';
import { cacheFriendsData, cacheFollowersData, loadCachedFriendsData, loadCachedFollowersData } from '../services/offlineCache';
import { AddFriendModal } from '../components/AddFriendModal';
import { RemoveFriendModal } from '../components/RemoveFriendModal';
import { EditNicknameModal } from '../components/EditNicknameModal';
import { ShareLibraryModal } from '../components/ShareLibraryModal';
import { SegmentedControl } from '../components/SegmentedControl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserGroup, faMagnifyingGlass, faEye, faPenToSquare, faArrowsLeftRight, faUserPlus, faRotate, faUserCheck, faUsers, faUserMinus, faLink, faGear } from '@fortawesome/free-solid-svg-icons';
import './Friends.css';

type SortOption = 'added_desc' | 'added_asc' | 'nickname_asc' | 'nickname_desc' | 'games_desc' | 'games_asc';
type TabType = 'following' | 'followers';

export function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { preferences, updatePreferences } = usePreferences();
  const toast = useToast();
  const isOnline = useOnlineStatus();
  
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

  // Save preferences when sort changes
  useEffect(() => {
    updatePreferences({
      friends: {
        sortBy,
      },
    });
  }, [sortBy, updatePreferences]);

  // Load following, followers, and requests on mount
  const fetchData = useCallback(async () => {
    if (!user) return;
    
    // Load from cache immediately for instant display
    const cachedFollowing = loadCachedFriendsData(user.id);
    const cachedFollowers = loadCachedFollowersData(user.id);
    
    if (cachedFollowing || cachedFollowers) {
      setFollowing(cachedFollowing || []);
      setFollowers(cachedFollowers || []);
      setIsLoading(false);
      logger.info('Friends data loaded from cache instantly', { 
        followingCount: cachedFollowing?.length || 0,
        followersCount: cachedFollowers?.length || 0
      });
    } else {
      setIsLoading(true);
    }
    
    try {
      if (isOnline) {
        // Online: fetch fresh data from database and update cache
        const [userFollowing, userFollowers, shareProfile] = await Promise.all([
          getFollowing(user.id),
          getFollowers(user.id),
          getShareProfile(user.id),
        ]);
        setFollowing(userFollowing);
        setFollowers(userFollowers);
        setUserShareId(shareProfile?.shareId || null);
        setHasSharingEnabled(shareProfile?.enabled || false);
        
        // Cache for offline use and future instant loads
        cacheFriendsData(user.id, userFollowing);
        cacheFollowersData(user.id, userFollowers);
        
        logger.info('Friends data refreshed from database', { 
          followingCount: userFollowing.length,
          followersCount: userFollowers.length
        });
      } else {
        // Offline: we already loaded from cache above
        if (!cachedFollowing && !cachedFollowers) {
          setFollowing([]);
          setFollowers([]);
        }
        setUserShareId(null);
        setHasSharingEnabled(false);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      // If we didn't have cache and there's an error, try loading from cache one more time
      if (!cachedFollowing && !cachedFollowers) {
        const fallbackFollowing = loadCachedFriendsData(user.id);
        const fallbackFollowers = loadCachedFollowersData(user.id);
        setFollowing(fallbackFollowing || []);
        setFollowers(fallbackFollowers || []);
      }
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // isOnline intentionally omitted - we check it at runtime but don't want to refetch on status changes

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
      toast.success('Sharing enabled successfully!');
    } catch (error) {
      console.error('Failed to refresh share profile:', error);
    }
  }, [user, toast]);

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
    
    // Prevent comparison when offline
    if (!isOnline) {
      alert('You are offline. Comparison is not available in offline mode.');
      return;
    }
    
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
    
    // Prevent following when offline
    if (!isOnline) {
      alert('You are offline. Following users is not available in offline mode.');
      return;
    }
    
    setProcessingAction(follower.followerUserId);
    
    try {
      const success = await followUser(user.id, follower.followerShareId, follower.profile?.displayName || 'User');
      if (success) {
        toast.success(`Now following ${follower.profile?.displayName || 'user'}`);
        await fetchData();
      } else {
        toast.error('Failed to follow');
      }
    } catch (error) {
      console.error('Failed to follow:', error);
      // Show specific error message if available
      const errorMessage = error instanceof Error ? error.message : 'Failed to follow';
      toast.error(errorMessage);
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
      <header className="friends-header">
        <div>
          <h1><FontAwesomeIcon icon={faUserGroup} /> Following</h1>
        </div>
        <div className="header-actions">
          <button 
            onClick={() => {
              if (!isOnline) {
                alert('You are offline. Refreshing is not available in offline mode.');
                return;
              }
              fetchData();
            }} 
            className="btn-refresh" 
            title={!isOnline ? 'Refresh not available offline' : 'Refresh'}
            disabled={!isOnline}
          >
            <FontAwesomeIcon icon={faRotate} />
          </button>
          <button 
            onClick={() => {
              if (!isOnline) {
                alert('You are offline. Sharing settings are not available in offline mode.');
                return;
              }
              setShowShareModal(true);
            }} 
            className={`btn-share ${hasSharingEnabled ? 'active' : ''}`}
            title={!isOnline ? 'Sharing settings not available offline' : 'Manage Sharing Settings'}
            disabled={!isOnline}
          >
            <FontAwesomeIcon icon={faLink} /> {showShareModal ? 'Hide Sharing' : 'Share'}
          </button>
          <button 
            onClick={() => {
              if (!isOnline) {
                alert('You are offline. Following users is not available in offline mode.');
                return;
              }
              setShowAddModal(true);
            }} 
            className="btn-add-friend"
            disabled={!hasSharingEnabled || !isOnline}
            title={!isOnline ? 'Following not available offline' : !hasSharingEnabled ? 'Enable sharing on your library first' : 'Follow a user'}
            style={!hasSharingEnabled || !isOnline ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
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
          onChange={(value) => setActiveTab(value as TabType)}
          ariaLabel="Friends tabs"
          variant="default"
        />
      </div>

      {/* Following Tab */}
      <div style={{ display: activeTab === 'following' ? 'block' : 'none' }}>
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
          <div className="friends-grid">
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
                      onClick={() => {
                        if (!isOnline) {
                          alert('You are offline. Viewing shared libraries is not available in offline mode.');
                          return;
                        }
                        navigate(`/shared/${person.friendShareId}`);
                      }}
                      title={!isOnline ? 'Viewing not available offline' : 'View Library'}
                      disabled={!isOnline}
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
                        title={!isOnline ? 'Comparison not available offline' : 'Compare Libraries'}
                        disabled={!isOnline}
                      >
                        <FontAwesomeIcon icon={faArrowsLeftRight} /> Compare
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (!isOnline) {
                          alert('You are offline. Editing is not available in offline mode.');
                          return;
                        }
                        setEditingFriend(person);
                      }}
                      title={!isOnline ? 'Editing not available offline' : 'Edit Nickname'}
                      disabled={!isOnline}
                    >
                      <FontAwesomeIcon icon={faPenToSquare} /> Edit
                    </button>
                    <button
                      onClick={() => {
                        if (!isOnline) {
                          alert('You are offline. Unfollowing is not available in offline mode.');
                          return;
                        }
                        setRemovingFriend(person);
                      }}
                      title={!isOnline ? 'Unfollowing not available offline' : 'Unfollow'}
                      disabled={!isOnline}
                    >
                      <FontAwesomeIcon icon={faUserMinus} /> Unfollow
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Followers Tab */}
      <div style={{ display: activeTab === 'followers' ? 'block' : 'none' }}>
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
      </div>

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
