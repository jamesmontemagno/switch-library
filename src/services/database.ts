import { supabase, isSupabaseConfigured } from './supabase';
import type { GameEntry, ShareProfile, FriendEntry, FriendWithDetails, FollowerEntry } from '../types';

const LOCAL_STORAGE_KEY = 'switch-library-games';
const FRIENDS_STORAGE_KEY = 'switch-library-friends';

// Check if we should use Supabase or localStorage
const useSupabase = isSupabaseConfigured();

// Local storage fallback functions
function loadGamesFromLocalStorage(userId: string): GameEntry[] {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const allGames = JSON.parse(stored) as GameEntry[];
      return allGames.filter(game => game.userId === userId);
    }
  } catch (error) {
    console.error('Failed to load games from localStorage:', error);
  }
  return [];
}

function saveGamesToLocalStorage(games: GameEntry[]): void {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const allGames = stored ? JSON.parse(stored) as GameEntry[] : [];
    const otherUsersGames = allGames.filter(g => !games.some(ng => ng.userId === g.userId));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...otherUsersGames, ...games]));
  } catch (error) {
    console.error('Failed to save games to localStorage:', error);
  }
}

function deleteGameFromLocalStorage(gameId: string): void {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const allGames = JSON.parse(stored) as GameEntry[];
      const filtered = allGames.filter(g => g.id !== gameId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('Failed to delete game from localStorage:', error);
  }
}

// Supabase functions
async function loadGamesFromSupabase(userId: string): Promise<GameEntry[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load games from Supabase:', error);
    return [];
  }

  return ((data as Record<string, unknown>[] | null) || []).map(mapSupabaseGameToEntry);
}

async function saveGameToSupabase(game: GameEntry): Promise<GameEntry | null> {
  const supabaseGame = mapEntryToSupabaseGame(game);
  
  const { data, error } = await supabase
    .from('games')
    .upsert(supabaseGame)
    .select()
    .single();

  if (error) {
    console.error('Failed to save game to Supabase:', error);
    return null;
  }

  return mapSupabaseGameToEntry(data);
}

async function deleteGameFromSupabase(gameId: string): Promise<boolean> {
  const { error } = await supabase
    .from('games')
    .delete()
    .eq('id', gameId);

  if (error) {
    console.error('Failed to delete game from Supabase:', error);
    return false;
  }

  return true;
}

// Map Supabase row to our GameEntry type
function mapSupabaseGameToEntry(row: Record<string, unknown>): GameEntry {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    platform: row.platform as GameEntry['platform'],
    format: row.format as GameEntry['format'],
    status: row.status as GameEntry['status'],
    condition: row.condition as GameEntry['condition'],
    notes: row.notes as string | undefined,
    thegamesdbId: row.thegamesdb_id as number | undefined,
    coverUrl: row.cover_url as string | undefined,
    purchaseDate: row.purchase_date as string | undefined,
    completed: row.completed as boolean | undefined,
    completedDate: row.completed_date as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Map our GameEntry type to Supabase row
function mapEntryToSupabaseGame(entry: GameEntry): Record<string, unknown> {
  return {
    id: entry.id,
    user_id: entry.userId,
    title: entry.title,
    platform: entry.platform,
    format: entry.format,
    status: entry.status,
    condition: entry.condition,
    notes: entry.notes,
    thegamesdb_id: entry.thegamesdbId,
    cover_url: entry.coverUrl,
    purchase_date: entry.purchaseDate,
    completed: entry.completed,
    completed_date: entry.completedDate,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

// Exported database service functions
export async function loadGames(userId: string): Promise<GameEntry[]> {
  if (useSupabase) {
    return loadGamesFromSupabase(userId);
  }
  return loadGamesFromLocalStorage(userId);
}

export async function saveGame(game: GameEntry, allGames?: GameEntry[]): Promise<GameEntry | null> {
  if (useSupabase) {
    return saveGameToSupabase(game);
  }
  
  // For localStorage, we need all games to save
  if (allGames) {
    const existing = allGames.find(g => g.id === game.id);
    const updatedGames = existing
      ? allGames.map(g => g.id === game.id ? game : g)
      : [...allGames, game];
    saveGamesToLocalStorage(updatedGames.filter(g => g.userId === game.userId));
  }
  return game;
}

export async function deleteGame(gameId: string): Promise<boolean> {
  if (useSupabase) {
    return deleteGameFromSupabase(gameId);
  }
  deleteGameFromLocalStorage(gameId);
  return true;
}

// API Usage tracking functions
const USAGE_STORAGE_KEY = 'switch-library-api-usage';
const USAGE_LIMIT = 50;

interface UsageRecord {
  searchQuery: string;
  timestamp: number;
}

export interface MonthlyUsage {
  count: number;
  limit: number;
  month: string; // Format: "YYYY-MM"
}

function getMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function getMonthlyUsageFromSupabase(userId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  try {
    const { count, error } = (await supabase
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('timestamp', monthStart.toISOString())) as { count: number | null; error: unknown };

    if (error) {
      console.error('Failed to get monthly usage from Supabase:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Error querying monthly usage:', error);
    return 0;
  }
}

function getMonthlyUsageFromLocalStorage(userId: string): number {
  try {
    const stored = localStorage.getItem(USAGE_STORAGE_KEY);
    if (stored) {
      const allUsage = JSON.parse(stored) as Record<string, UsageRecord[]>;
      const currentMonth = getMonthKey();
      const userKey = `${userId}-${currentMonth}`;
      const userUsage = allUsage[userKey] || [];
      return userUsage.length;
    }
  } catch (error) {
    console.error('Failed to get monthly usage from localStorage:', error);
  }
  return 0;
}

export async function getMonthlySearchCount(userId: string): Promise<MonthlyUsage> {
  let count = 0;
  
  if (useSupabase) {
    count = await getMonthlyUsageFromSupabase(userId);
  } else {
    count = getMonthlyUsageFromLocalStorage(userId);
  }
  
  return {
    count,
    limit: USAGE_LIMIT,
    month: getMonthKey()
  };
}

async function logSearchToSupabase(userId: string, searchQuery: string): Promise<void> {
  try {
    const { error } = (await supabase
      .from('api_usage')
      .insert({
        user_id: userId,
        search_query: searchQuery,
        timestamp: new Date().toISOString()
      })) as { error: unknown };

    if (error) {
      console.error('Failed to log search to Supabase:', error);
    }
  } catch (error) {
    console.error('Error logging search to Supabase:', error);
  }
}

function logSearchToLocalStorage(userId: string, searchQuery: string): void {
  try {
    const stored = localStorage.getItem(USAGE_STORAGE_KEY);
    const allUsage = stored ? JSON.parse(stored) as Record<string, UsageRecord[]> : {};
    const currentMonth = getMonthKey();
    const userKey = `${userId}-${currentMonth}`;
    
    if (!allUsage[userKey]) {
      allUsage[userKey] = [];
    }
    
    allUsage[userKey].push({
      searchQuery,
      timestamp: Date.now()
    });
    
    // Clean up old months (keep only current and previous month)
    const previousMonth = getMonthKey(new Date(new Date().setMonth(new Date().getMonth() - 1)));
    const keysToKeep = Object.keys(allUsage).filter(key => 
      key.endsWith(currentMonth) || key.endsWith(previousMonth)
    );
    const cleanedUsage: Record<string, UsageRecord[]> = {};
    keysToKeep.forEach(key => {
      cleanedUsage[key] = allUsage[key];
    });
    
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(cleanedUsage));
  } catch (error) {
    console.error('Failed to log search to localStorage:', error);
  }
}

export async function logSearchUsage(userId: string, searchQuery: string): Promise<void> {
  if (useSupabase) {
    await logSearchToSupabase(userId, searchQuery);
  } else {
    logSearchToLocalStorage(userId, searchQuery);
  }
}

// Share Profile Functions
const SHARE_STORAGE_KEY = 'switch-library-share-profile';

function mapSupabaseShareToProfile(row: Record<string, unknown>): ShareProfile {
  return {
    shareId: row.share_id as string,
    userId: row.user_id as string,
    enabled: row.enabled as boolean,
    showDisplayName: row.show_display_name as boolean ?? true,
    showAvatar: row.show_avatar as boolean ?? true,
    acceptFollowRequests: row.accept_follow_requests as boolean ?? true,
    createdAt: row.created_at as string,
    revokedAt: row.revoked_at as string | undefined,
  };
}

export async function getShareProfile(userId: string): Promise<ShareProfile | null> {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('share_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return mapSupabaseShareToProfile(data);
  }

  // localStorage fallback
  try {
    const stored = localStorage.getItem(SHARE_STORAGE_KEY);
    if (stored) {
      const profiles = JSON.parse(stored) as ShareProfile[];
      return profiles.find(p => p.userId === userId) || null;
    }
  } catch (error) {
    console.error('Failed to get share profile from localStorage:', error);
  }
  return null;
}

export async function enableSharing(userId: string): Promise<ShareProfile | null> {
  if (useSupabase) {
    // Try to update existing profile first
    const existing = await getShareProfile(userId);
    
    if (existing) {
      const { data, error } = await supabase
        .from('share_profiles')
        .update({ enabled: true, revoked_at: null })
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !data) {
        console.error('Failed to enable sharing:', error);
        return null;
      }
      return mapSupabaseShareToProfile(data);
    }

    // Create new share profile with acceptFollowRequests defaulting to true
    const { data, error } = await supabase
      .from('share_profiles')
      .insert({ user_id: userId, enabled: true, accept_follow_requests: true })
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to create share profile:', error);
      return null;
    }
    return mapSupabaseShareToProfile(data);
  }

  // localStorage fallback
  try {
    const stored = localStorage.getItem(SHARE_STORAGE_KEY);
    const profiles = stored ? JSON.parse(stored) as ShareProfile[] : [];
    const existing = profiles.find(p => p.userId === userId);
    
    if (existing) {
      existing.enabled = true;
      existing.revokedAt = undefined;
      localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(profiles));
      return existing;
    }

    const newProfile: ShareProfile = {
      shareId: crypto.randomUUID(),
      userId,
      enabled: true,
      showDisplayName: true,
      showAvatar: true,
      acceptFollowRequests: true,
      createdAt: new Date().toISOString(),
    };
    profiles.push(newProfile);
    localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(profiles));
    return newProfile;
  } catch (error) {
    console.error('Failed to enable sharing in localStorage:', error);
  }
  return null;
}

export async function disableSharing(userId: string): Promise<boolean> {
  if (useSupabase) {
    const { error } = await supabase
      .from('share_profiles')
      .update({ enabled: false, revoked_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to disable sharing:', error);
      return false;
    }
    return true;
  }

  // localStorage fallback
  try {
    const stored = localStorage.getItem(SHARE_STORAGE_KEY);
    if (stored) {
      const profiles = JSON.parse(stored) as ShareProfile[];
      const profile = profiles.find(p => p.userId === userId);
      if (profile) {
        profile.enabled = false;
        profile.revokedAt = new Date().toISOString();
        localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(profiles));
      }
    }
    return true;
  } catch (error) {
    console.error('Failed to disable sharing in localStorage:', error);
  }
  return false;
}

export async function regenerateShareId(userId: string): Promise<ShareProfile | null> {
  if (useSupabase) {
    // Delete existing and create new
    await supabase
      .from('share_profiles')
      .delete()
      .eq('user_id', userId);

    const { data, error } = await supabase
      .from('share_profiles')
      .insert({ user_id: userId, enabled: true })
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to regenerate share ID:', error);
      return null;
    }
    return mapSupabaseShareToProfile(data);
  }

  // localStorage fallback
  try {
    const stored = localStorage.getItem(SHARE_STORAGE_KEY);
    const profiles = stored ? JSON.parse(stored) as ShareProfile[] : [];
    const filtered = profiles.filter(p => p.userId !== userId);
    
    const newProfile: ShareProfile = {
      shareId: crypto.randomUUID(),
      userId,
      enabled: true,
      showDisplayName: true,
      showAvatar: true,
      acceptFollowRequests: true,
      createdAt: new Date().toISOString(),
    };
    filtered.push(newProfile);
    localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(filtered));
    return newProfile;
  } catch (error) {
    console.error('Failed to regenerate share ID in localStorage:', error);
  }
  return null;
}

// Public functions for viewing shared libraries
export async function getSharedProfileByShareId(shareId: string): Promise<ShareProfile | null> {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('share_profiles')
      .select('*')
      .eq('share_id', shareId)
      .eq('enabled', true)
      .single();

    if (error || !data) {
      return null;
    }
    return mapSupabaseShareToProfile(data);
  }

  // localStorage fallback
  try {
    const stored = localStorage.getItem(SHARE_STORAGE_KEY);
    if (stored) {
      const profiles = JSON.parse(stored) as ShareProfile[];
      return profiles.find(p => p.shareId === shareId && p.enabled) || null;
    }
  } catch (error) {
    console.error('Failed to get shared profile from localStorage:', error);
  }
  return null;
}

export async function loadSharedGames(shareId: string): Promise<GameEntry[]> {
  // First get the share profile to find the user ID
  const shareProfile = await getSharedProfileByShareId(shareId);
  if (!shareProfile) {
    return [];
  }

  if (useSupabase) {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', shareProfile.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load shared games:', error);
      return [];
    }

    return ((data as Record<string, unknown>[] | null) || []).map(mapSupabaseGameToEntry);
  }

  // localStorage fallback
  return loadGamesFromLocalStorage(shareProfile.userId);
}

export async function getSharedUserProfile(shareId: string): Promise<{ displayName: string; avatarUrl: string } | null> {
  const shareProfile = await getSharedProfileByShareId(shareId);
  if (!shareProfile) {
    return null;
  }

  if (useSupabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', shareProfile.userId)
      .single();

    if (error || !data) {
      return null;
    }

    const profileData = data as Record<string, unknown>;
    // Respect privacy settings
    return {
      displayName: shareProfile.showDisplayName 
        ? (profileData.display_name as string) 
        : 'Anonymous',
      avatarUrl: shareProfile.showAvatar 
        ? (profileData.avatar_url as string) 
        : '',
    };
  }

  // localStorage fallback - no profile info available
  return { 
    displayName: shareProfile.showDisplayName ? 'User' : 'Anonymous', 
    avatarUrl: '' 
  };
}

// Update share profile privacy settings
export async function updateSharePrivacy(
  userId: string, 
  settings: { showDisplayName?: boolean; showAvatar?: boolean; acceptFollowRequests?: boolean }
): Promise<ShareProfile | null> {
  if (useSupabase) {
    const updateData: Record<string, boolean> = {};
    if (settings.showDisplayName !== undefined) {
      updateData.show_display_name = settings.showDisplayName;
    }
    if (settings.showAvatar !== undefined) {
      updateData.show_avatar = settings.showAvatar;
    }
    if (settings.acceptFollowRequests !== undefined) {
      updateData.accept_follow_requests = settings.acceptFollowRequests;
    }

    const { data, error } = await supabase
      .from('share_profiles')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to update share privacy:', error);
      return null;
    }
    return mapSupabaseShareToProfile(data);
  }

  // localStorage fallback
  try {
    const stored = localStorage.getItem(SHARE_STORAGE_KEY);
    if (stored) {
      const profiles = JSON.parse(stored) as ShareProfile[];
      const profile = profiles.find(p => p.userId === userId);
      if (profile) {
        if (settings.showDisplayName !== undefined) {
          profile.showDisplayName = settings.showDisplayName;
        }
        if (settings.showAvatar !== undefined) {
          profile.showAvatar = settings.showAvatar;
        }
        if (settings.acceptFollowRequests !== undefined) {
          profile.acceptFollowRequests = settings.acceptFollowRequests;
        }
        localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(profiles));
        return profile;
      }
    }
  } catch (error) {
    console.error('Failed to update share privacy in localStorage:', error);
  }
  return null;
}

// Update user display name
export async function updateDisplayName(userId: string, displayName: string): Promise<boolean> {
  if (useSupabase) {
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', userId);

    if (error) {
      console.error('Failed to update display name:', error);
      return false;
    }
    return true;
  }

  // localStorage doesn't store user profiles
  return false;
}

// Get user profile info
export async function getUserProfile(userId: string): Promise<{ displayName: string; avatarUrl: string } | null> {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    const profileData = data as Record<string, unknown>;
    return {
      displayName: profileData.display_name as string,
      avatarUrl: profileData.avatar_url as string,
    };
  }

  return null;
}

// ===== Follow List Functions =====

// Mapping functions for follow entries
function mapSupabaseFriendToEntry(row: Record<string, unknown>): FriendEntry {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    friendShareId: row.friend_share_id as string,
    nickname: row.nickname as string,
    followBackRequested: (row.follow_back_requested as boolean) || false,
    addedAt: row.added_at as string,
    requestedAt: row.requested_at as string | undefined,
  };
}

// Load follows from localStorage
function loadFriendsFromLocalStorage(userId: string): FriendEntry[] {
  try {
    const stored = localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (stored) {
      const allFriends = JSON.parse(stored) as FriendEntry[];
      // Migrate old entries
      return allFriends
        .filter(friend => friend.userId === userId)
        .map(friend => ({
          ...friend,
          followBackRequested: friend.followBackRequested || false,
        }));
    }
  } catch (error) {
    console.error('Failed to load friends from localStorage:', error);
  }
  return [];
}

// Save follows to localStorage
function saveFriendsToLocalStorage(friends: FriendEntry[]): void {
  try {
    const stored = localStorage.getItem(FRIENDS_STORAGE_KEY);
    const allFriends = stored ? JSON.parse(stored) as FriendEntry[] : [];
    const otherUsersFriends = allFriends.filter(f => !friends.some(nf => nf.userId === f.userId));
    localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify([...otherUsersFriends, ...friends]));
  } catch (error) {
    console.error('Failed to save friends to localStorage:', error);
  }
}

// Delete follow from localStorage
function deleteFriendFromLocalStorage(friendId: string): void {
  try {
    const stored = localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (stored) {
      const allFriends = JSON.parse(stored) as FriendEntry[];
      const filtered = allFriends.filter(f => f.id !== friendId);
      localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('Failed to delete friend from localStorage:', error);
  }
}

// Check if user is already following this share profile
export async function isFollowing(userId: string, shareId: string): Promise<boolean> {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('friend_lists')
      .select('id')
      .eq('user_id', userId)
      .eq('friend_share_id', shareId)
      .single();

    if (error || !data) {
      return false;
    }
    return true;
  }

  // localStorage fallback
  const friends = loadFriendsFromLocalStorage(userId);
  return friends.some(f => f.friendShareId === shareId);
}

// Check if user accepts follow-back requests
export async function checkAcceptsFollowRequests(shareId: string): Promise<boolean> {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('share_profiles')
      .select('accept_follow_requests')
      .eq('share_id', shareId)
      .eq('enabled', true)
      .single();

    if (error || !data) {
      return false;
    }
    const profileData = data as Record<string, unknown>;
    // Default to true if not set
    return profileData.accept_follow_requests !== false;
  }

  // localStorage fallback - always accept in demo mode
  return true;
}

// Follow a user (instant, no approval needed)
export async function followUser(userId: string, shareId: string, nickname?: string): Promise<FriendEntry | null> {
  // Check if already following
  const alreadyFollowing = await isFollowing(userId, shareId);
  if (alreadyFollowing) {
    console.log('Already following this user');
    return null;
  }

  // Fetch the user's profile to auto-fill nickname if not provided
  let finalNickname = nickname;
  if (!finalNickname) {
    const profile = await getSharedUserProfile(shareId);
    if (profile) {
      finalNickname = profile.displayName;
    }
  }

  // Trim and validate nickname
  if (!finalNickname) {
    console.error('Nickname is required');
    return null;
  }

  finalNickname = finalNickname.trim().substring(0, 50);
  const now = new Date().toISOString();

  if (useSupabase) {
    const { data, error } = await supabase
      .from('friend_lists')
      .insert({
        user_id: userId,
        friend_share_id: shareId,
        nickname: finalNickname,
        status: 'accepted',
        follow_back_requested: false,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to follow user:', error);
      return null;
    }

    return mapSupabaseFriendToEntry(data as Record<string, unknown>);
  }

  // localStorage fallback
  const newFollow: FriendEntry = {
    id: crypto.randomUUID(),
    userId,
    friendShareId: shareId,
    nickname: finalNickname,
    followBackRequested: false,
    addedAt: now,
  };

  const friends = loadFriendsFromLocalStorage(userId);
  friends.push(newFollow);
  saveFriendsToLocalStorage(friends);

  return newFollow;
}

// Request someone to follow you back (sets flag on your existing follow entry)
export async function requestFollowBack(userId: string, theirShareId: string): Promise<boolean> {
  // First check if we're following them
  const isCurrentlyFollowing = await isFollowing(userId, theirShareId);
  if (!isCurrentlyFollowing) {
    console.log('Must be following someone before requesting follow back');
    return false;
  }

  // Check if they accept follow requests
  const acceptsRequests = await checkAcceptsFollowRequests(theirShareId);
  if (!acceptsRequests) {
    console.log('User is not accepting follow-back requests');
    return false;
  }

  const now = new Date().toISOString();

  if (useSupabase) {
    const { error } = await supabase
      .from('friend_lists')
      .update({ follow_back_requested: true, requested_at: now })
      .eq('user_id', userId)
      .eq('friend_share_id', theirShareId);

    if (error) {
      console.error('Failed to request follow back:', error);
      return false;
    }
    return true;
  }

  // localStorage fallback
  try {
    const stored = localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (stored) {
      const allFriends = JSON.parse(stored) as FriendEntry[];
      const idx = allFriends.findIndex(f => f.userId === userId && f.friendShareId === theirShareId);
      if (idx !== -1) {
        allFriends[idx].followBackRequested = true;
        allFriends[idx].requestedAt = now;
        localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(allFriends));
        return true;
      }
    }
  } catch (error) {
    console.error('Failed to request follow back in localStorage:', error);
  }
  return false;
}

// Cancel a follow-back request you sent
export async function cancelFollowBackRequest(userId: string, theirShareId: string): Promise<boolean> {
  if (useSupabase) {
    const { error } = await supabase
      .from('friend_lists')
      .update({ follow_back_requested: false, requested_at: null })
      .eq('user_id', userId)
      .eq('friend_share_id', theirShareId);

    if (error) {
      console.error('Failed to cancel follow back request:', error);
      return false;
    }
    return true;
  }

  // localStorage fallback
  try {
    const stored = localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (stored) {
      const allFriends = JSON.parse(stored) as FriendEntry[];
      const idx = allFriends.findIndex(f => f.userId === userId && f.friendShareId === theirShareId);
      if (idx !== -1) {
        allFriends[idx].followBackRequested = false;
        allFriends[idx].requestedAt = undefined;
        localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(allFriends));
        return true;
      }
    }
  } catch (error) {
    console.error('Failed to cancel follow back request in localStorage:', error);
  }
  return false;
}

// Unfollow a user
export async function unfollowUser(userId: string, followId: string): Promise<boolean> {
  if (useSupabase) {
    const { error } = await supabase
      .from('friend_lists')
      .delete()
      .eq('id', followId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to unfollow user:', error);
      return false;
    }
    return true;
  }

  // localStorage fallback
  deleteFriendFromLocalStorage(followId);
  return true;
}

// Update follow nickname
export async function updateFollowNickname(userId: string, followId: string, newNickname: string): Promise<boolean> {
  const trimmedNickname = newNickname.trim().substring(0, 50);

  if (!trimmedNickname) {
    console.error('Nickname cannot be empty');
    return false;
  }

  if (useSupabase) {
    const { error } = await supabase
      .from('friend_lists')
      .update({ nickname: trimmedNickname })
      .eq('id', followId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to update follow nickname:', error);
      return false;
    }
    return true;
  }

  // localStorage fallback
  try {
    const stored = localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (stored) {
      const allFriends = JSON.parse(stored) as FriendEntry[];
      const friendIndex = allFriends.findIndex(f => f.id === followId && f.userId === userId);
      
      if (friendIndex !== -1) {
        allFriends[friendIndex].nickname = trimmedNickname;
        localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(allFriends));
        return true;
      }
    }
  } catch (error) {
    console.error('Failed to update follow nickname in localStorage:', error);
  }
  return false;
}

// Get people you're following with enriched details
export async function getFollowing(userId: string): Promise<FriendWithDetails[]> {
  let followEntries: FriendEntry[] = [];

  if (useSupabase) {
    const { data, error } = await supabase
      .from('friend_lists')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (error || !data) {
      console.error('Failed to load following from Supabase:', error);
      return [];
    }

    followEntries = ((data as Record<string, unknown>[] | null) || []).map(mapSupabaseFriendToEntry);
  } else {
    followEntries = loadFriendsFromLocalStorage(userId);
  }

  // Get my share profile to check if they follow me back
  const myShareProfile = await getShareProfile(userId);

  // Enrich with profile data and game counts
  const enrichedFollows = await Promise.all(
    followEntries.map(async (follow) => {
      const [profile, games] = await Promise.all([
        getSharedUserProfile(follow.friendShareId),
        loadSharedGames(follow.friendShareId),
      ]);

      // Check if they follow me back
      let theyFollowYou = false;
      if (myShareProfile) {
        // Get the user ID of who I'm following
        const theirShareProfile = await getSharedProfileByShareId(follow.friendShareId);
        if (theirShareProfile) {
          // Check if they have an entry following my share ID
          theyFollowYou = await isFollowingShareId(theirShareProfile.userId, myShareProfile.shareId);
        }
      }

      return {
        ...follow,
        profile,
        gameCount: games.length,
        theyFollowYou,
      };
    })
  );

  return enrichedFollows;
}

// Helper: Check if a user is following a specific share ID
async function isFollowingShareId(userId: string, shareId: string): Promise<boolean> {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('friend_lists')
      .select('id')
      .eq('user_id', userId)
      .eq('friend_share_id', shareId)
      .single();

    return !error && !!data;
  }

  const friends = loadFriendsFromLocalStorage(userId);
  return friends.some(f => f.friendShareId === shareId);
}

// Get people following you (Followers)
export async function getFollowers(userId: string): Promise<FollowerEntry[]> {
  // Get my share profile
  const myShareProfile = await getShareProfile(userId);
  if (!myShareProfile) {
    return [];
  }

  let followerEntries: FriendEntry[] = [];

  if (useSupabase) {
    // Get all entries where friend_share_id = my share ID
    const { data, error } = await supabase
      .from('friend_lists')
      .select('*')
      .eq('friend_share_id', myShareProfile.shareId)
      .order('added_at', { ascending: false });

    if (error || !data) {
      console.error('Failed to load followers from Supabase:', error);
      return [];
    }

    followerEntries = ((data as Record<string, unknown>[] | null) || []).map(mapSupabaseFriendToEntry);
  } else {
    // localStorage fallback - search all entries for ones pointing to my share ID
    try {
      const stored = localStorage.getItem(FRIENDS_STORAGE_KEY);
      if (stored) {
        const allFriends = JSON.parse(stored) as FriendEntry[];
        followerEntries = allFriends.filter(f => f.friendShareId === myShareProfile.shareId);
      }
    } catch (error) {
      console.error('Failed to load followers from localStorage:', error);
    }
  }

  // Get my following list to check which followers I follow back
  let myFollowing: FriendEntry[] = [];
  if (useSupabase) {
    const { data } = await supabase
      .from('friend_lists')
      .select('*')
      .eq('user_id', userId);
    
    if (data) {
      myFollowing = ((data as Record<string, unknown>[] | null) || []).map(mapSupabaseFriendToEntry);
    }
  } else {
    myFollowing = loadFriendsFromLocalStorage(userId);
  }

  // Enrich with profile data
  const enrichedFollowers = await Promise.all(
    followerEntries.map(async (follower) => {
      // Get the follower's share profile (so we can link to their library)
      const followerShareProfile = await getShareProfileByUserId(follower.userId);
      
      let profile: { displayName: string; avatarUrl: string } | null = null;
      let gameCount = 0;
      let followerShareId: string | null = null;

      if (followerShareProfile && followerShareProfile.enabled) {
        profile = await getSharedUserProfile(followerShareProfile.shareId);
        const games = await loadSharedGames(followerShareProfile.shareId);
        gameCount = games.length;
        followerShareId = followerShareProfile.shareId;
      } else {
        // They don't have sharing enabled, try to get basic profile
        profile = await getUserProfile(follower.userId);
      }

      // Check if I follow them back
      const youFollowThem = followerShareId 
        ? myFollowing.some(f => f.friendShareId === followerShareId)
        : false;

      return {
        id: follower.id,
        followerUserId: follower.userId,
        followerShareId,
        nickname: follower.nickname,
        followBackRequested: follower.followBackRequested,
        addedAt: follower.addedAt,
        requestedAt: follower.requestedAt,
        profile,
        gameCount,
        youFollowThem,
      };
    })
  );

  return enrichedFollowers;
}

// Get follow-back requests (people following you who want you to follow them back)
export async function getFollowBackRequests(userId: string): Promise<FollowerEntry[]> {
  const followers = await getFollowers(userId);
  
  // Filter to only those with follow_back_requested = true and not expired
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  return followers.filter(f => {
    if (!f.followBackRequested) return false;
    if (!f.requestedAt) return true; // No timestamp means it's valid
    return new Date(f.requestedAt).getTime() > thirtyDaysAgo;
  });
}

// Get share profile by user ID (helper)
async function getShareProfileByUserId(userId: string): Promise<ShareProfile | null> {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('share_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }
    return mapSupabaseShareToProfile(data);
  }

  // localStorage fallback
  try {
    const stored = localStorage.getItem(SHARE_STORAGE_KEY);
    if (stored) {
      const profiles = JSON.parse(stored) as ShareProfile[];
      return profiles.find(p => p.userId === userId) || null;
    }
  } catch (error) {
    console.error('Failed to get share profile by userId from localStorage:', error);
  }
  return null;
}

// Legacy aliases for backwards compatibility
export const isFriend = isFollowing;
export const addFriend = followUser;
export const removeFriend = unfollowUser;
export const updateFriendNickname = updateFollowNickname;
export const getFriends = getFollowing;
export const checkAcceptsFriendRequests = checkAcceptsFollowRequests;

// Delete user account and all associated data
export async function deleteUserAccount(userId: string): Promise<boolean> {
  if (useSupabase) {
    try {
      // Delete user data in order (due to foreign key constraints)
      // Note: The database should have ON DELETE CASCADE set up for most relations
      
      // Delete API usage records
      await supabase.from('api_usage').delete().eq('user_id', userId);
      
      // Delete friend lists
      await supabase.from('friend_lists').delete().eq('user_id', userId);
      
      // Delete share profile
      await supabase.from('share_profiles').delete().eq('user_id', userId);
      
      // Delete games
      await supabase.from('games').delete().eq('user_id', userId);
      
      // Delete profile
      await supabase.from('profiles').delete().eq('id', userId);
      
      // Note: Deleting the auth user requires admin privileges
      // This should be done via a server-side endpoint or database function
      // For now, the user data is deleted and they will be signed out
      // The auth user record will remain but without any associated data
      
      return true;
    } catch (error) {
      console.error('Failed to delete user account:', error);
      return false;
    }
  }

  // localStorage fallback - clear all user data
  try {
    const gamesKey = 'switch-library-games';
    const stored = localStorage.getItem(gamesKey);
    if (stored) {
      const allGames = JSON.parse(stored) as GameEntry[];
      const filtered = allGames.filter(g => g.userId !== userId);
      localStorage.setItem(gamesKey, JSON.stringify(filtered));
    }
    
    // Clear share profile
    const shareKey = 'switch-library-share-profile';
    const shareStored = localStorage.getItem(shareKey);
    if (shareStored) {
      const profiles = JSON.parse(shareStored) as ShareProfile[];
      const filtered = profiles.filter(p => p.userId !== userId);
      localStorage.setItem(shareKey, JSON.stringify(filtered));
    }
    
    // Clear friend lists
    const friendsStored = localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (friendsStored) {
      const allFriends = JSON.parse(friendsStored) as FriendEntry[];
      const filtered = allFriends.filter(f => f.userId !== userId);
      localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(filtered));
    }
    
    // Clear API usage
    const usageKey = 'switch-library-api-usage';
    const usageStored = localStorage.getItem(usageKey);
    if (usageStored) {
      const allUsage = JSON.parse(usageStored) as Record<string, unknown>;
      const filtered = Object.keys(allUsage)
        .filter(key => !key.startsWith(`${userId}-`))
        .reduce((acc, key) => {
          acc[key] = allUsage[key];
          return acc;
        }, {} as Record<string, unknown>);
      localStorage.setItem(usageKey, JSON.stringify(filtered));
    }
    
    return true;
  } catch (error) {
    console.error('Failed to delete user account from localStorage:', error);
    return false;
  }
}

export { useSupabase };
