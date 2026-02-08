import { supabase, isSupabaseConfigured } from './supabase';
import type { GameEntry, ShareProfile, FriendEntry, FriendWithDetails, FollowerEntry, TrendingGameAggregate, TrendingGame, TrendingResponse } from '../types';
import { logger } from './logger';

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
    isFavorite: row.favorite as boolean | undefined,
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
    favorite: entry.isFavorite,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

// Exported database service functions
export async function loadGames(userId: string): Promise<GameEntry[]> {
  logger.database('loadGames', 'games', { userId, mode: useSupabase ? 'supabase' : 'localStorage' });
  if (useSupabase) {
    const games = await loadGamesFromSupabase(userId);
    logger.info('Games loaded from Supabase', { count: games.length, userId });
    return games;
  }
  const games = loadGamesFromLocalStorage(userId);
  logger.info('Games loaded from localStorage', { count: games.length, userId });
  return games;
}

export async function saveGame(game: GameEntry, allGames?: GameEntry[], isNewGame?: boolean): Promise<GameEntry | null> {
  logger.database('saveGame', 'games', { gameId: game.id, title: game.title, mode: useSupabase ? 'supabase' : 'localStorage' });
  
  if (useSupabase) {
    const result = await saveGameToSupabase(game);
    if (result) {
      logger.info('Game saved to Supabase', { gameId: result.id, title: result.title });
      // Record game addition for trending (fire-and-forget) - only for new games
      if (isNewGame && game.thegamesdbId) {
        recordGameAddition(game.thegamesdbId).catch(() => {});
      }
    } else {
      logger.error('Failed to save game to Supabase', undefined, { gameId: game.id, title: game.title });
    }
    return result;
  }
  
  // For localStorage, we need all games to save
  if (allGames) {
    const existing = allGames.find(g => g.id === game.id);
    const updatedGames = existing
      ? allGames.map(g => g.id === game.id ? game : g)
      : [...allGames, game];
    saveGamesToLocalStorage(updatedGames.filter(g => g.userId === game.userId));
    logger.info('Game saved to localStorage', { gameId: game.id, title: game.title, isUpdate: !!existing });
    // Record game addition for trending (fire-and-forget) - only for new games
    if (!existing && game.thegamesdbId) {
      recordGameAddition(game.thegamesdbId).catch(() => {});
    }
  }
  return game;
}

export async function deleteGame(gameId: string): Promise<boolean> {
  logger.database('deleteGame', 'games', { gameId, mode: useSupabase ? 'supabase' : 'localStorage' });
  
  if (useSupabase) {
    const success = await deleteGameFromSupabase(gameId);
    if (success) {
      logger.info('Game deleted from Supabase', { gameId });
    } else {
      logger.error('Failed to delete game from Supabase', undefined, { gameId });
    }
    return success;
  }
  
  deleteGameFromLocalStorage(gameId);
  logger.info('Game deleted from localStorage', { gameId });
  return true;
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
      .maybeSingle();

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

    // Create new share profile
    const { data, error } = await supabase
      .from('share_profiles')
      .insert({ user_id: userId, enabled: true })
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
      .maybeSingle();

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
      .maybeSingle();

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
  settings: { showDisplayName?: boolean; showAvatar?: boolean }
): Promise<ShareProfile | null> {
  if (useSupabase) {
    const updateData: Record<string, boolean> = {};
    if (settings.showDisplayName !== undefined) {
      updateData.show_display_name = settings.showDisplayName;
    }
    if (settings.showAvatar !== undefined) {
      updateData.show_avatar = settings.showAvatar;
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
      .maybeSingle();

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

/**
 * Get full profile data including account level for the authenticated user
 */
export async function getFullUserProfile(userId: string): Promise<{ displayName: string; avatarUrl: string; accountLevel: string } | null> {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, account_level')
      .eq('id', userId)
      .single();

    if (error || !data) {
      logger.error('Failed to fetch full user profile', error, { userId });
      return null;
    }

    const profileData = data as Record<string, unknown>;
    return {
      displayName: profileData.display_name as string,
      avatarUrl: profileData.avatar_url as string,
      accountLevel: (profileData.account_level as string) || 'standard',
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
    addedAt: row.added_at as string,
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
        .filter(friend => friend.userId === userId);
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
      .maybeSingle();

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
// Follow a user (instant, no approval needed)
export async function followUser(userId: string, shareId: string, nickname?: string): Promise<FriendEntry | null> {
  logger.database('followUser', 'friend_lists', { userId, shareId, nickname });
  
  // Check if the user has sharing enabled - they must share to follow others
  const userShareProfile = await getShareProfile(userId);
  if (!userShareProfile || !userShareProfile.enabled) {
    logger.warn('User must enable sharing to follow others', { userId, hasProfile: !!userShareProfile, enabled: userShareProfile?.enabled });
    throw new Error('You must enable sharing on your library before you can follow others. Go to Library > Settings to enable sharing.');
  }
  
  // Check if already following
  const alreadyFollowing = await isFollowing(userId, shareId);
  if (alreadyFollowing) {
    logger.warn('Already following this user', { userId, shareId });
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
    logger.error('Nickname is required for followUser', undefined, { userId, shareId });
    return null;
  }

  finalNickname = finalNickname.trim().substring(0, 50);
  const now = new Date().toISOString();

  if (useSupabase) {
    logger.debug('Inserting follow relationship into Supabase', {
      user_id: userId,
      friend_share_id: shareId,
      nickname: finalNickname,
    });
    
    const { data, error } = await supabase
      .from('friend_lists')
      .insert({
        user_id: userId,
        friend_share_id: shareId,
        nickname: finalNickname,
        status: 'accepted',
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to follow user - Supabase error', error, { userId, shareId });
      return null;
    }
    
    if (!data) {
      logger.error('No data returned from follow insert', undefined, { userId, shareId });
      return null;
    }

    logger.info('Successfully followed user', { followId: data.id, nickname: finalNickname });
    return mapSupabaseFriendToEntry(data as Record<string, unknown>);
  }

  // localStorage fallback
  const newFollow: FriendEntry = {
    id: crypto.randomUUID(),
    userId,
    friendShareId: shareId,
    nickname: finalNickname,
    addedAt: now,
  };

  const friends = loadFriendsFromLocalStorage(userId);
  friends.push(newFollow);
  saveFriendsToLocalStorage(friends);

  return newFollow;
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
      .maybeSingle();

    return !error && !!data;
  }

  const friends = loadFriendsFromLocalStorage(userId);
  return friends.some(f => f.friendShareId === shareId);
}

// Get people following you (Followers)
export async function getFollowers(userId: string): Promise<FollowerEntry[]> {
  logger.database('getFollowers', 'friend_lists', { userId });
  
  // Get my share profile
  const myShareProfile = await getShareProfile(userId);
  
  if (!myShareProfile) {
    logger.debug('No share profile found, no followers', { userId });
    return [];
  }

  let followerEntries: FriendEntry[] = [];

  if (useSupabase) {
    logger.debug('Querying followers from Supabase', { myShareId: myShareProfile.shareId });
    
    // Get all entries where friend_share_id = my share ID
    const { data, error } = await supabase
      .from('friend_lists')
      .select('*')
      .eq('friend_share_id', myShareProfile.shareId)
      .order('added_at', { ascending: false });

    if (error || !data) {
      logger.error('Failed to load followers from Supabase', error, { userId, myShareId: myShareProfile.shareId });
      console.error('Failed to load followers from Supabase:', error);
      return [];
    }

    followerEntries = ((data as Record<string, unknown>[] | null) || []).map(mapSupabaseFriendToEntry);
    logger.info('Followers loaded from Supabase', { count: followerEntries.length });
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
  logger.debug('Enriching followers with profile data', { followerCount: followerEntries.length });
  
  const enrichedFollowers = await Promise.all(
    followerEntries.map(async (follower, index) => {
      logger.debug('Enriching follower', { index: index + 1, followerId: follower.id, followerUserId: follower.userId });
      
      // Get the follower's share profile (so we can link to their library)
      const followerShareProfile = await getShareProfileByUserId(follower.userId);
      
      let profile: { displayName: string; avatarUrl: string } | null = null;
      let gameCount = 0;
      let followerShareId: string | null = null;

      if (followerShareProfile && followerShareProfile.enabled) {
        logger.debug('Follower has enabled sharing', { index: index + 1, shareId: followerShareProfile.shareId });
        profile = await getSharedUserProfile(followerShareProfile.shareId);
        const games = await loadSharedGames(followerShareProfile.shareId);
        gameCount = games.length;
        followerShareId = followerShareProfile.shareId;
        logger.debug('Follower profile loaded', { index: index + 1, gameCount });
      } else {
        // They don't have sharing enabled, try to get basic profile
        logger.debug('Follower sharing disabled, using basic profile', { index: index + 1 });
        profile = await getUserProfile(follower.userId);
      }

      // Check if I follow them back
      const youFollowThem = followerShareId 
        ? myFollowing.some(f => f.friendShareId === followerShareId)
        : false;

      const enrichedFollower = {
        id: follower.id,
        followerUserId: follower.userId,
        followerShareId,
        nickname: follower.nickname,
        addedAt: follower.addedAt,
        profile,
        gameCount,
        youFollowThem,
      };
      
      logger.debug('Follower enrichment complete', { index: index + 1, hasProfile: !!profile, gameCount, youFollowThem });
      return enrichedFollower;
    })
  );

  logger.info('All followers enriched', { totalCount: enrichedFollowers.length });
  return enrichedFollowers;
}

// Get share profile by user ID (helper)
async function getShareProfileByUserId(userId: string): Promise<ShareProfile | null> {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('share_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

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

// Delete user account and all associated data
export async function deleteUserAccount(userId: string): Promise<boolean> {
  if (useSupabase) {
    try {
      // Delete user data in order (due to foreign key constraints)
      // Note: The database should have ON DELETE CASCADE set up for most relations
      
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

// ===== Trending Games Functions =====

const TRENDING_CACHE_KEY = 'switch-library-trending-v2'; // v2: Updated limits (15 recent, 10 top)
const TRENDING_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

interface TrendingCache {
  data: TrendingResponse;
  timestamp: number;
}

// Record a game addition for trending tracking (fire-and-forget)
export async function recordGameAddition(thegamesdbId: number): Promise<void> {
  if (!useSupabase || !thegamesdbId) {
    logger.debug('Skipping game addition recording', { useSupabase, thegamesdbId });
    return;
  }

  try {
    logger.database('recordGameAddition', 'game_additions', { thegamesdbId });
    
    const { error } = await supabase
      .from('game_additions')
      .insert({ thegamesdb_id: thegamesdbId });

    if (error) {
      logger.error('Failed to record game addition', error, { thegamesdbId });
    } else {
      logger.info('Game addition recorded for trending', { thegamesdbId });
    }
  } catch (error) {
    // Fire-and-forget - don't let this block the main operation
    logger.error('Error recording game addition', error, { thegamesdbId });
  }
}

// Get cached trending data
function getCachedTrending(): TrendingResponse | null {
  try {
    const cached = localStorage.getItem(TRENDING_CACHE_KEY);
    if (cached) {
      const parsed: TrendingCache = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < TRENDING_CACHE_TTL_MS) {
        logger.cache('hit', 'trending', { age: Date.now() - parsed.timestamp });
        return parsed.data;
      }
    }
  } catch (error) {
    logger.error('Failed to get cached trending data', error);
  }
  return null;
}

// Cache trending data
function setCachedTrending(data: TrendingResponse): void {
  try {
    const cache: TrendingCache = { data, timestamp: Date.now() };
    localStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify(cache));
    logger.cache('set', 'trending', { topGamesCount: data.topGames.length, recentCount: data.recentlyAdded.length });
  } catch (error) {
    logger.error('Failed to cache trending data', error);
  }
}

// Get trending games from Supabase and enrich with game details
export async function getTrendingGames(userId?: string): Promise<TrendingResponse> {
  logger.database('getTrendingGames', 'game_additions', { userId, mode: useSupabase ? 'supabase' : 'localStorage' });

  // Check cache first
  const cached = getCachedTrending();
  if (cached) {
    return cached;
  }

  // If not using Supabase, return user's own games as "trending"
  if (!useSupabase) {
    return getTrendingFromLocalStorage(userId);
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Query for game additions
    const { data: allAdditions, error: allError } = await supabase
      .from('game_additions')
      .select('thegamesdb_id, added_at')
      .order('added_at', { ascending: false })
      .limit(1000);

    if (allError) {
      logger.error('Failed to fetch game additions', allError);
      return getEmptyTrendingResponse();
    }

    // Aggregate the data
    const aggregateMap = new Map<number, { count: number; recentCount: number; lastAddedAt: string }>();
    
    // Type guard: allAdditions should be an array
    const additions = Array.isArray(allAdditions) ? allAdditions : [];
    
    for (const addition of additions) {
      const id = addition.thegamesdb_id;
      const addedAt = addition.added_at;
      const isRecent = new Date(addedAt) >= thirtyDaysAgo;
      
      const existing = aggregateMap.get(id);
      if (existing) {
        existing.count++;
        if (isRecent) existing.recentCount++;
        if (new Date(addedAt) > new Date(existing.lastAddedAt)) {
          existing.lastAddedAt = addedAt;
        }
      } else {
        aggregateMap.set(id, {
          count: 1,
          recentCount: isRecent ? 1 : 0,
          lastAddedAt: addedAt,
        });
      }
    }

    // Convert to array
    const aggregatedGames: TrendingGameAggregate[] = Array.from(aggregateMap.entries())
      .map(([thegamesdbId, stats]) => ({
        thegamesdbId,
        addCount: stats.count,
        recentAddCount: stats.recentCount,
        lastAddedAt: stats.lastAddedAt,
      }));

    // Top games by total count
    const topByCount = [...aggregatedGames]
      .sort((a, b) => b.addCount - a.addCount)
      .slice(0, 10);

    // Recently added (by recent count)
    const topByRecent = [...aggregatedGames]
      .filter(g => g.recentAddCount > 0)
      .sort((a, b) => b.recentAddCount - a.recentAddCount || 
        new Date(b.lastAddedAt).getTime() - new Date(a.lastAddedAt).getTime())
      .slice(0, 15);

    // Get unique game IDs to fetch details
    const allIds = [...new Set([
      ...topByCount.map(g => g.thegamesdbId),
      ...topByRecent.map(g => g.thegamesdbId),
    ])];

    // Fetch game details from backend (blob storage only)
    const { getGamesByIds } = await import('./thegamesdb');
    const { found: gameDetails } = await getGamesByIds(allIds);

    // Create lookup map for game details
    const detailsMap = new Map(gameDetails.map(g => [g.id, g]));

    // Enrich trending data with game details
    const enrichGame = (aggregate: TrendingGameAggregate): TrendingGame => {
      const details = detailsMap.get(aggregate.thegamesdbId);
      return {
        ...aggregate,
        title: details?.title,
        coverUrl: details?.coverUrl,
        releaseDate: details?.releaseDate,
        platform: details?.platform,
        platformId: details?.platformId,
        region_id: details?.region_id,
      };
    };

    const response: TrendingResponse = {
      topGames: topByCount.map(enrichGame),
      recentlyAdded: topByRecent.map(enrichGame),
      updatedAt: new Date().toISOString(),
    };

    setCachedTrending(response);
    logger.info('Trending games loaded', {
      topGamesCount: response.topGames.length,
      recentCount: response.recentlyAdded.length,
      gamesWithDetails: gameDetails.length,
    });

    return response;
  } catch (error) {
    logger.error('Error getting trending games', error);
    return getEmptyTrendingResponse();
  }
}

// Fallback for localStorage mode - show user's own recently added games
function getTrendingFromLocalStorage(userId?: string): TrendingResponse {
  if (!userId) return getEmptyTrendingResponse();

  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const allGames = JSON.parse(stored) as GameEntry[];
      const userGames = allGames
        .filter(game => game.userId === userId && game.thegamesdbId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 15);

      const trendingGames: TrendingGame[] = userGames.map(game => ({
        thegamesdbId: game.thegamesdbId!,
        addCount: 1,
        recentAddCount: 1,
        lastAddedAt: game.createdAt,
        title: game.title,
        coverUrl: game.coverUrl,
        platform: game.platform,
      }));

      return {
        topGames: trendingGames,
        recentlyAdded: trendingGames,
        updatedAt: new Date().toISOString(),
      };
    }
  } catch (error) {
    logger.error('Failed to get trending from localStorage', error);
  }
  return getEmptyTrendingResponse();
}

function getEmptyTrendingResponse(): TrendingResponse {
  return { topGames: [], recentlyAdded: [], updatedAt: new Date().toISOString() };
}

export function clearTrendingCache(): void {
  localStorage.removeItem(TRENDING_CACHE_KEY);
  logger.info('Trending cache cleared');
}

// ===== Admin Statistics Functions =====

export interface AdminStatistics {
  totalUsers: number;
  totalGames: number;
  gamesByPlatform: { platform: string; count: number }[];
  gamesByFormat: { format: string; count: number }[];
  activeSharers: number;
  totalFollows: number;
  apiUsageCount: number;
  signupsPerDay: Array<{ date: string; count: number }>;
  topGames: Array<{ title: string; count: number }>;
  weeklyStats?: {
    newUsers: number;
    newGames: number;
    newFollows: number;
    apiSearches: number;
  };
  monthlyStats?: {
    newUsers: number;
    newGames: number;
    newFollows: number;
    apiSearches: number;
  };
}

/**
 * Get comprehensive admin statistics (admin-only function)
 * Only works with Supabase, returns empty stats for localStorage mode
 */
export async function getAdminStatistics(): Promise<AdminStatistics | null> {
  if (!useSupabase) {
    logger.warn('Admin statistics only available in Supabase mode');
    return null;
  }

  try {
    logger.database('getAdminStatistics', 'multiple', {});

    // Use the database function for fast aggregate stats (bypasses RLS efficiently)
    const { data: statsData, error: statsError } = await supabase
      .rpc('get_admin_statistics');

    if (statsError) {
      logger.error('Failed to fetch admin statistics', statsError);
      throw statsError;
    }

    const basicStats = statsData as { 
      totalUsers: number; 
      totalGames: number; 
      activeSharers: number; 
      totalFollows: number; 
      apiUsageCount: number;
      weeklyStats?: {
        newUsers: number;
        newGames: number;
        newFollows: number;
        apiSearches: number;
      };
      monthlyStats?: {
        newUsers: number;
        newGames: number;
        newFollows: number;
        apiSearches: number;
      };
    };

    const totalUsers = basicStats.totalUsers;
    const totalGames = basicStats.totalGames;

    // Get games by platform
    const { data: platformData, error: platformError } = await supabase
      .from('games')
      .select('platform');

    if (platformError) {
      logger.error('Failed to fetch games by platform', platformError);
      throw platformError;
    }

    const platformCounts = new Map<string, number>();
    if (Array.isArray(platformData)) {
      platformData.forEach((game: unknown) => {
        const typedGame = game as { platform: string };
        platformCounts.set(typedGame.platform, (platformCounts.get(typedGame.platform) || 0) + 1);
      });
    }

    const gamesByPlatform = Array.from(platformCounts.entries())
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);

    // Get games by format
    const { data: formatData, error: formatError } = await supabase
      .from('games')
      .select('format');

    if (formatError) {
      logger.error('Failed to fetch games by format', formatError);
      throw formatError;
    }

    const formatCounts = new Map<string, number>();
    if (Array.isArray(formatData)) {
      formatData.forEach((game: unknown) => {
        const typedGame = game as { format: string };
        formatCounts.set(typedGame.format, (formatCounts.get(typedGame.format) || 0) + 1);
      });
    }

    const gamesByFormat = Array.from(formatCounts.entries())
      .map(([format, count]) => ({ format, count }))
      .sort((a, b) => b.count - a.count);

    // Use counts from the fast RPC call
    const activeSharers = basicStats.activeSharers;
    const totalFollows = basicStats.totalFollows;
    const apiUsageCount = basicStats.apiUsageCount;

    // Get signups per day (last 30 days) - No PII, just aggregated counts
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: signupsData, error: signupsError } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (signupsError) {
      logger.error('Failed to fetch signups data', signupsError);
      throw signupsError;
    }

    // Aggregate signups by day
    const signupsByDay = new Map<string, number>();
    if (Array.isArray(signupsData)) {
      signupsData.forEach((record: unknown) => {
        const typedRecord = record as { created_at: string };
        const date = new Date(typedRecord.created_at).toISOString().split('T')[0];
        signupsByDay.set(date, (signupsByDay.get(date) || 0) + 1);
      });
    }

    const signupsPerDay = Array.from(signupsByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get top games by count
    const { data: gamesData, error: topGamesError } = await supabase
      .from('games')
      .select('title');

    if (topGamesError) {
      logger.error('Failed to fetch games for top games', topGamesError);
      throw topGamesError;
    }

    const gameCounts = new Map<string, number>();
    if (Array.isArray(gamesData)) {
      gamesData.forEach((game: unknown) => {
        const typedGame = game as { title: string };
        gameCounts.set(typedGame.title, (gameCounts.get(typedGame.title) || 0) + 1);
      });
    }

    const topGames = Array.from(gameCounts.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const stats: AdminStatistics = {
      totalUsers: totalUsers || 0,
      totalGames: totalGames || 0,
      gamesByPlatform,
      gamesByFormat,
      activeSharers: activeSharers || 0,
      totalFollows: totalFollows || 0,
      apiUsageCount: apiUsageCount || 0,
      signupsPerDay,
      topGames,
      weeklyStats: basicStats.weeklyStats,
      monthlyStats: basicStats.monthlyStats,
    };

    logger.info('Admin statistics loaded', { 
      totalUsers: stats.totalUsers, 
      totalGames: stats.totalGames 
    });
    return stats;
  } catch (error) {
    logger.error('Failed to fetch admin statistics', error);
    return null;
  }
}
