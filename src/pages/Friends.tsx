import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { useSEO } from '../hooks/useSEO';
import type { FriendWithDetails, FollowerEntry } from '../types';
import { 
  getFollowing, 
  getFollowers,
  getShareProfile, 
  getFollowBackRequests,
  followUser,
  requestFollowBack,
  cancelFollowBackRequest
} from '../services/database';
import { AddFriendModal } from '../components/AddFriendModal';
import { RemoveFriendModal } from '../components/RemoveFriendModal';
import { EditNicknameModal } from '../components/EditNicknameModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserGroup, faMagnifyingGlass, faEye, faPenToSquare, faArrowsLeftRight, faUserPlus, faRotate, faCheck, faTimes, faEnvelope, faUserCheck, faTableCells, faList, faGripLines, faUsers, faUserMinus, faReply } from '@fortawesome/free-solid-svg-icons';
import './Friends.css';

type SortOption = 'added_desc' | 'added_asc' | 'nickname_asc' | 'nickname_desc' | 'games_desc' | 'games_asc';
type ViewMode = 'grid' | 'list' | 'compact';
type TabType = 'following' | 'followers' | 'requests';

export function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { preferences, updatePreferences, shareSettings } = usePreferences();
  
  useSEO({
    title: 'Following - My Switch Library',
    description: 'Manage your Nintendo Switch gaming connections. View their collections, compare libraries, and discover shared games.',
    url: 'https://myswitchlibrary.com/friends',
  });
  
  const [activeTab, setActiveTab] = useState<TabType>('following');
  const [following, setFollowing] = useState<FriendWithDetails[]>([]);
  const [followers, setFollowers] = useState<FollowerEntry[]>([]);
  const [followBackRequests, setFollowBackRequests] = useState<FollowerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(preferences.friends?.sortBy || 'added_desc');
  const [viewMode, setViewMode] = useState<ViewMode>(preferences.friends?.viewMode || 'grid');
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFriend, setEditingFriend] = useState<FriendWithDetails | null>(null);
  const [removingFriend, setRemovingFriend] = useState<FriendWithDetails | null>(null);
  
  // Compare functionality
  const [userShareId, setUserShareId] = useState<string | null>(null);
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
      const [userFollowing, userFollowers, shareProfile, requests] = await Promise.all([
        getFollowing(user.id),
        getFollowers(user.id),
        getShareProfile(user.id),
        shareSettings.acceptFollowRequests ? getFollowBackRequests(user.id) : Promise.resolve([]),
      ]);
      setFollowing(userFollowing);
      setFollowers(userFollowers);
      setUserShareId(shareProfile?.shareId || null);
      setFollowBackRequests(requests);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, shareSettings.acceptFollowRequests]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // DEBUG: Log the actual logged-in user
  useEffect(() => {
    if (user) {
      console.log('[DEBUG Friends] Logged in as user:', {
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

  // Handle follow-back request: user decides to follow them back
  const handleFollowBack = async (request: FollowerEntry) => {
    if (!user || !request.followerShareId) return;
    setProcessingAction(request.followerUserId);
    
    try {
      // Follow them back (they follow us, now we follow them)
      const success = await followUser(user.id, request.followerShareId, request.profile?.displayName || 'User');
      if (success) {
        showToast(`Now following ${request.profile?.displayName || 'user'}`, 'success');
        // Refresh data
        await fetchData();
      } else {
        showToast('Failed to follow back', 'error');
      }
    } catch (error) {
      console.error('Failed to follow back:', error);
      showToast('Failed to follow back', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  // Handle ignoring a follow-back request (just clears the request flag)
  const handleIgnoreRequest = async (request: FollowerEntry) => {
    if (!user) return;
    setProcessingAction(request.followerUserId);
    
    try {
      // Find the friend entry ID for this request
      // The cancelFollowBackRequest needs the entry ID where we are the friend_user_id
      // and they are the user_id with follow_back_requested = true
      const success = await cancelFollowBackRequest(request.followerUserId, user.id);
      if (success) {
        showToast('Request ignored', 'success');
        // Remove from local state
        setFollowBackRequests(prev => prev.filter(r => r.followerUserId !== request.followerUserId));
      } else {
        showToast('Failed to ignore request', 'error');
      }
    } catch (error) {
      console.error('Failed to ignore request:', error);
      showToast('Failed to ignore request', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  // Handle requesting follow-back from someone you follow who doesn't follow you
  const handleRequestFollowBack = async (person: FriendWithDetails) => {
    if (!user) return;
    setProcessingAction(person.id);
    
    try {
      const success = await requestFollowBack(user.id, person.friendShareId);
      if (success) {
        showToast(`Requested ${person.nickname} to follow you back`, 'success');
        await fetchData();
      } else {
        showToast('Failed to send follow-back request', 'error');
      }
    } catch (error) {
      console.error('Failed to request follow back:', error);
      showToast('Failed to send follow-back request', 'error');
    } finally {
      setProcessingAction(null);
    }
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
      showToast('Failed to follow', 'error');
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
          <button onClick={() => setShowAddModal(true)} className="btn-add-friend">
            <FontAwesomeIcon icon={faUserPlus} />
            Follow User
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="friends-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'following'}
          className={`tab-button ${activeTab === 'following' ? 'active' : ''}`}
          onClick={() => setActiveTab('following')}
        >
          <FontAwesomeIcon icon={faUserCheck} />
          Following ({following.length})
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'followers'}
          className={`tab-button ${activeTab === 'followers' ? 'active' : ''}`}
          onClick={() => setActiveTab('followers')}
        >
          <FontAwesomeIcon icon={faUsers} />
          Followers ({followers.length})
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'requests'}
          className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          <FontAwesomeIcon icon={faEnvelope} />
          Requests
          {followBackRequests.length > 0 && (
            <span className="tab-badge">{followBackRequests.length}</span>
          )}
        </button>
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
                <button
                  className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  title="Grid view"
                >
                  <FontAwesomeIcon icon={faTableCells} />
                </button>
                <button
                  className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  title="List view"
                >
                  <FontAwesomeIcon icon={faList} />
                </button>
                <button
                  className={`view-btn ${viewMode === 'compact' ? 'active' : ''}`}
                  onClick={() => setViewMode('compact')}
                  aria-label="Compact view"
                  title="Compact view"
                >
                  <FontAwesomeIcon icon={faGripLines} />
                </button>
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
                      src={person.profile?.avatarUrl || '/switch.svg'}
                      alt={person.nickname}
                      className="friend-avatar"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/switch.svg';
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
                    {!person.theyFollowYou && (
                      <button
                        onClick={() => handleRequestFollowBack(person)}
                        title="Request them to follow you back"
                        disabled={processingAction === person.id || person.followBackRequested}
                      >
                        <FontAwesomeIcon icon={faReply} />
                        {person.followBackRequested ? 'Requested' : 'Request Follow'}
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
                      src={follower.profile?.avatarUrl || '/switch.svg'}
                      alt={follower.profile?.displayName || 'User'}
                      className="request-avatar"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/switch.svg';
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
                        disabled={processingAction === follower.followerUserId}
                        title="Follow back"
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

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <>
          {!shareSettings.acceptFollowRequests ? (
            <div className="empty-state">
              <div className="empty-icon">
                <FontAwesomeIcon icon={faEnvelope} />
              </div>
              <h2>Follow-back requests are disabled</h2>
              <p>
                You've disabled follow-back requests in your privacy settings.<br />
                Enable "Accept Follow-Back Requests" in Settings to receive requests.
              </p>
            </div>
          ) : followBackRequests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <FontAwesomeIcon icon={faEnvelope} />
              </div>
              <h2>No pending requests</h2>
              <p>
                You don't have any follow-back requests at the moment.<br />
                When someone you follow requests you to follow them back, it'll appear here.
              </p>
            </div>
          ) : (
            <div className="requests-list">
              {followBackRequests.map((request) => (
                <div key={request.followerUserId} className="request-card">
                  <div className="request-card-header">
                    <img
                      src={request.profile?.avatarUrl || '/switch.svg'}
                      alt={request.profile?.displayName || 'User'}
                      className="request-avatar"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/switch.svg';
                      }}
                    />
                    <div className="request-info">
                      <h3>{request.profile?.displayName || 'Unknown User'}</h3>
                      <p className="request-meta">
                        {(request.gameCount ?? 0) > 0 && `${request.gameCount} ${request.gameCount === 1 ? 'game' : 'games'} • `}
                        Requested {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString() : 'recently'}
                      </p>
                    </div>
                  </div>
                  <div className="request-actions">
                    <button
                      className="btn-accept"
                      onClick={() => handleFollowBack(request)}
                      disabled={processingAction === request.followerUserId}
                      title="Follow them back"
                    >
                      <FontAwesomeIcon icon={faCheck} />
                      Follow Back
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => handleIgnoreRequest(request)}
                      disabled={processingAction === request.followerUserId}
                      title="Ignore request"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                      Ignore
                    </button>
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
    </div>
  );
}
