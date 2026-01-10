import { supabase, isSupabaseConfigured } from './supabase';
import type { GameEntry, ShareProfile } from '../types';

const LOCAL_STORAGE_KEY = 'switch-library-games';

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
    return {
      displayName: profileData.display_name as string,
      avatarUrl: profileData.avatar_url as string,
    };
  }

  // localStorage fallback - no profile info available
  return { displayName: 'User', avatarUrl: '' };
}

export { useSupabase };
