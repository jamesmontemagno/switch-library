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
  barcode?: string;
  eshopUrl?: string;
  status: GameStatus;
  condition?: GameCondition;
  notes?: string;
  igdbId?: number;
  coverUrl?: string;
  igdbMetadata?: IGDBMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface IGDBMetadata {
  genres?: string[];
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  summary?: string;
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
