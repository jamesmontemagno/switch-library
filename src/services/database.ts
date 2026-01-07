import { supabase, isSupabaseConfigured } from './supabase';
import type { GameEntry } from '../types';

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

  return (data || []).map(mapSupabaseGameToEntry);
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
    barcode: row.barcode as string | undefined,
    eshopUrl: row.eshop_url as string | undefined,
    status: row.status as GameEntry['status'],
    condition: row.condition as GameEntry['condition'],
    notes: row.notes as string | undefined,
    thegamesdbId: row.thegamesdb_id as number | undefined,
    coverUrl: row.cover_url as string | undefined,
    gameMetadata: row.game_metadata as GameEntry['gameMetadata'],
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
    barcode: entry.barcode,
    eshop_url: entry.eshopUrl,
    status: entry.status,
    condition: entry.condition,
    notes: entry.notes,
    thegamesdb_id: entry.thegamesdbId,
    cover_url: entry.coverUrl,
    game_metadata: entry.gameMetadata,
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

export { useSupabase };
