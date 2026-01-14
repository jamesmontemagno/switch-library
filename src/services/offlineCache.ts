import type { GameEntry, FriendWithDetails, FollowerEntry } from '../types';

/**
 * Offline cache utilities for storing and retrieving data when offline
 * Uses localStorage for simplicity (could be upgraded to IndexedDB if needed)
 */

const CACHE_PREFIX = 'switch-library-offline-cache';
const CACHE_VERSION = '1';

// Cache keys
const KEYS = {
  LIBRARY: `${CACHE_PREFIX}-library-v${CACHE_VERSION}`,
  FRIENDS: `${CACHE_PREFIX}-friends-v${CACHE_VERSION}`,
  FOLLOWERS: `${CACHE_PREFIX}-followers-v${CACHE_VERSION}`,
  LAST_SYNC: `${CACHE_PREFIX}-last-sync-v${CACHE_VERSION}`,
};

/**
 * Cache library data for offline access
 */
export function cacheLibraryData(userId: string, games: GameEntry[]): void {
  try {
    const cacheData = {
      userId,
      games,
      timestamp: Date.now(),
    };
    localStorage.setItem(KEYS.LIBRARY, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Failed to cache library data:', error);
  }
}

/**
 * Load cached library data
 */
export function loadCachedLibraryData(userId: string): GameEntry[] | null {
  try {
    const cached = localStorage.getItem(KEYS.LIBRARY);
    if (!cached) return null;

    const cacheData = JSON.parse(cached);
    
    // Verify the cached data is for the current user
    if (cacheData.userId !== userId) {
      return null;
    }

    return cacheData.games as GameEntry[];
  } catch (error) {
    console.error('Failed to load cached library data:', error);
    return null;
  }
}

/**
 * Cache friends data for offline access
 */
export function cacheFriendsData(userId: string, friends: FriendWithDetails[]): void {
  try {
    const cacheData = {
      userId,
      friends,
      timestamp: Date.now(),
    };
    localStorage.setItem(KEYS.FRIENDS, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Failed to cache friends data:', error);
  }
}

/**
 * Load cached friends data
 */
export function loadCachedFriendsData(userId: string): FriendWithDetails[] | null {
  try {
    const cached = localStorage.getItem(KEYS.FRIENDS);
    if (!cached) return null;

    const cacheData = JSON.parse(cached);
    
    // Verify the cached data is for the current user
    if (cacheData.userId !== userId) {
      return null;
    }

    return cacheData.friends as FriendWithDetails[];
  } catch (error) {
    console.error('Failed to load cached friends data:', error);
    return null;
  }
}

/**
 * Cache followers data for offline access
 */
export function cacheFollowersData(userId: string, followers: FollowerEntry[]): void {
  try {
    const cacheData = {
      userId,
      followers,
      timestamp: Date.now(),
    };
    localStorage.setItem(KEYS.FOLLOWERS, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Failed to cache followers data:', error);
  }
}

/**
 * Load cached followers data
 */
export function loadCachedFollowersData(userId: string): FollowerEntry[] | null {
  try {
    const cached = localStorage.getItem(KEYS.FOLLOWERS);
    if (!cached) return null;

    const cacheData = JSON.parse(cached);
    
    // Verify the cached data is for the current user
    if (cacheData.userId !== userId) {
      return null;
    }

    return cacheData.followers as FollowerEntry[];
  } catch (error) {
    console.error('Failed to load cached followers data:', error);
    return null;
  }
}

/**
 * Record last sync time
 */
export function recordLastSync(): void {
  try {
    localStorage.setItem(KEYS.LAST_SYNC, Date.now().toString());
  } catch (error) {
    console.error('Failed to record last sync:', error);
  }
}

/**
 * Get last sync time
 */
export function getLastSyncTime(): Date | null {
  try {
    const timestamp = localStorage.getItem(KEYS.LAST_SYNC);
    if (!timestamp) return null;
    return new Date(parseInt(timestamp, 10));
  } catch (error) {
    console.error('Failed to get last sync time:', error);
    return null;
  }
}

/**
 * Clear all offline cache
 */
export function clearOfflineCache(): void {
  try {
    localStorage.removeItem(KEYS.LIBRARY);
    localStorage.removeItem(KEYS.FRIENDS);
    localStorage.removeItem(KEYS.FOLLOWERS);
    localStorage.removeItem(KEYS.LAST_SYNC);
  } catch (error) {
    console.error('Failed to clear offline cache:', error);
  }
}
