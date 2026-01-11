export interface User {
  id: string;
  githubId?: number;
  login: string;
  displayName: string;
  avatarUrl: string;
  email?: string;
  createdAt: string;
}

export type Platform = 'Nintendo Switch' | 'Nintendo Switch 2';
export type Format = 'Physical' | 'Digital';
export type GameStatus = 'Owned' | 'Wishlist' | 'Borrowed' | 'Lent' | 'Sold';
export type GameCondition = 'New' | 'Like New' | 'Good' | 'Fair' | 'Poor';

export interface GameEntry {
  id: string;
  userId: string;
  title: string;
  platform: Platform;
  format: Format;
  status: GameStatus;
  condition?: GameCondition;
  notes?: string;
  // TheGamesDB integration
  thegamesdbId?: number;
  coverUrl?: string;
  // Purchase and completion tracking
  purchaseDate?: string;
  completed?: boolean;
  completedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShareProfile {
  shareId: string;
  userId: string;
  enabled: boolean;
  showDisplayName: boolean;
  showAvatar: boolean;
  acceptFollowRequests: boolean;  // Allow others to request you follow them back
  createdAt: string;
  revokedAt?: string;
}

// Follow entry (stored in friend_lists table for backwards compatibility)
// status is always 'accepted' - following is instant
// follow_back_requested: true when you want them to follow you back
export interface FriendEntry {
  id: string;
  userId: string;
  friendShareId: string;
  nickname: string;
  followBackRequested: boolean;
  addedAt: string;
  requestedAt?: string;  // When follow-back was requested (null if not)
}

// Follow with user details (for Following tab)
export interface FriendWithDetails {
  id: string;
  userId: string;
  friendShareId: string;
  nickname: string;
  followBackRequested: boolean;
  addedAt: string;
  requestedAt?: string;
  profile: {
    displayName: string;
    avatarUrl: string;
  } | null;
  gameCount: number;
  theyFollowYou: boolean;  // Whether they also follow you
}

// Follower entry (someone who follows you - reverse lookup)
export interface FollowerEntry {
  id: string;
  followerUserId: string;       // The user ID of the person following you
  followerShareId: string | null; // Their share ID (if they have one, so you can follow back)
  nickname: string;             // The nickname they gave you
  followBackRequested: boolean; // Whether they want you to follow them back
  addedAt: string;
  requestedAt?: string;
  profile: {
    displayName: string;
    avatarUrl: string;
  } | null;
  gameCount: number;
  youFollowThem: boolean;       // Whether you follow them back
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
