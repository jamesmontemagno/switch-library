import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { useSEO } from '../hooks/useSEO';
import type { FriendWithDetails } from '../types';
import { getFriends, getShareProfile } from '../services/database';
import { AddFriendModal } from '../components/AddFriendModal';
import { RemoveFriendModal } from '../components/RemoveFriendModal';
import { EditNicknameModal } from '../components/EditNicknameModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserGroup, faMagnifyingGlass, faEye, faPenToSquare, faTrash, faArrowsLeftRight, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import './Friends.css';

type SortOption = 'added_desc' | 'added_asc' | 'nickname_asc' | 'nickname_desc' | 'games_desc' | 'games_asc';
type ViewMode = 'grid' | 'list' | 'compact';

export function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { preferences, updatePreferences } = usePreferences();
  
  useSEO({
    title: 'Friends - My Switch Library',
    description: 'Manage your Nintendo Switch gaming friends. View their collections, compare libraries, and discover shared games.',
    url: 'https://myswitchlibrary.com/friends',
  });
  
  const [friends, setFriends] = useState<FriendWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(preferences.friends?.sortBy || 'added_desc');
  const [viewMode, setViewMode] = useState<ViewMode>(preferences.friends?.viewMode || 'grid');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFriend, setEditingFriend] = useState<FriendWithDetails | null>(null);
  const [removingFriend, setRemovingFriend] = useState<FriendWithDetails | null>(null);
  
  // Compare functionality
  const [userShareId, setUserShareId] = useState<string | null>(null);
  const [comparingFriend, setComparingFriend] = useState<string | null>(null);

  // Save preferences when sort/view change
  useEffect(() => {
    updatePreferences({
      friends: {
        sortBy,
        viewMode,
      },
    });
  }, [sortBy, viewMode, updatePreferences]);

  // Load friends on mount
  const fetchFriends = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [userFriends, shareProfile] = await Promise.all([
        getFriends(user.id),
        getShareProfile(user.id),
      ]);
      setFriends(userFriends);
      setUserShareId(shareProfile?.shareId || null);
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Filter and sort friends
  const filteredFriends = friends
    .filter(friend => {
      const matchesSearch = friend.nickname.toLowerCase().includes(searchQuery.toLowerCase());
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

  if (isLoading) {
    return (
      <div className="friends">
        <div className="loading-container">
          <div className="loading-spinner" aria-label="Loading" />
          <p>Loading friends...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="friends">
      <header className="friends-header">
        <div>
          <h1><FontAwesomeIcon icon={faUserGroup} /> Friends</h1>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowAddModal(true)} className="btn-add-friend">
            <FontAwesomeIcon icon={faUserPlus} />
            Add Friend
          </button>
        </div>
      </header>

      {friends.length > 0 && (
        <div className="friends-toolbar">
          <input
            type="search"
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            aria-label="Search friends"
          />
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="filter-select"
            aria-label="Sort friends"
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
              ▦
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="List view"
              title="List view"
            >
              ☰
            </button>
            <button
              className={`view-btn ${viewMode === 'compact' ? 'active' : ''}`}
              onClick={() => setViewMode('compact')}
              aria-label="Compact view"
              title="Compact view"
            >
              ▬
            </button>
          </div>
        </div>
      )}

      {filteredFriends.length === 0 ? (
        <div className="empty-state">
          {friends.length === 0 ? (
            <>
              <div className="empty-icon">
                <FontAwesomeIcon icon={faUserGroup} />
              </div>
              <h2>No friends yet</h2>
              <p>
                Visit a shared library and click "Add Friend" to save them here.<br />
                You can also add friends directly by entering their share URL.
              </p>
              <button onClick={() => setShowAddModal(true)} className="btn-add-friend">
                <FontAwesomeIcon icon={faUserPlus} />
                Add Your First Friend
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
          {filteredFriends.map((friend) => (
            <div key={friend.id} className="friend-card">
              <div className="friend-card-header">
                <img
                  src={friend.profile?.avatarUrl || '/switch.svg'}
                  alt={friend.nickname}
                  className="friend-avatar"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/switch.svg';
                  }}
                />
                <div className="friend-info">
                  <h3>{friend.nickname}</h3>
                  <p>{friend.gameCount} {friend.gameCount === 1 ? 'game' : 'games'}</p>
                </div>
              </div>
              <div className="friend-actions">
                <button
                  onClick={() => navigate(`/shared/${friend.friendShareId}`)}
                  title="View Library"
                >
                  <FontAwesomeIcon icon={faEye} /> View
                </button>
                {comparingFriend === friend.id ? (
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
                    onClick={() => handleCompare(friend)}
                    title="Compare Libraries"
                  >
                    <FontAwesomeIcon icon={faArrowsLeftRight} /> Compare
                  </button>
                )}
                <button
                  onClick={() => setEditingFriend(friend)}
                  title="Edit Nickname"
                >
                  <FontAwesomeIcon icon={faPenToSquare} /> Edit
                </button>
                <button
                  onClick={() => setRemovingFriend(friend)}
                  title="Remove Friend"
                >
                  <FontAwesomeIcon icon={faTrash} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddFriendModal
          onClose={() => setShowAddModal(false)}
          onAdd={fetchFriends}
        />
      )}

      {editingFriend && (
        <EditNicknameModal
          friendId={editingFriend.id}
          currentNickname={editingFriend.nickname}
          onClose={() => setEditingFriend(null)}
          onUpdate={fetchFriends}
        />
      )}

      {removingFriend && (
        <RemoveFriendModal
          friendId={removingFriend.id}
          friendNickname={removingFriend.nickname}
          onClose={() => setRemovingFriend(null)}
          onRemove={fetchFriends}
        />
      )}
    </div>
  );
}
