export interface User {
  id: string;
  githubId: number;
  login: string;
  displayName: string;
  avatarUrl: string;
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
  createdAt: string;
  revokedAt?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
