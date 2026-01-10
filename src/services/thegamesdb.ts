// TheGamesDB API Service
// API Documentation: https://api.thegamesdb.net/

// Always use proxy to avoid CORS issues in both development and production
// Development: Proxy configured in vite.config.ts to http://localhost:7071
// Production: Can be either relative path (integrated) or full Azure Functions URL
// Note: API key is now managed by the backend proxy, not the frontend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/thegamesdb';

export interface TheGamesDBGame {
  id: number;
  game_title: string;
  release_date?: string;
  platform: number;
  players?: number;
  overview?: string;
  developers?: number[];
  publishers?: number[];
  genres?: number[];
  rating?: string;
  region_id?: number;
  last_updated?: string;
  coop?: string;
  youtube?: string;
  os?: string;
  processor?: string;
  ram?: string;
  hdd?: string;
  video?: string;
  sound?: string;
  alternates?: string[];
}

export interface TheGamesDBSearchResult {
  count: number;
  games: TheGamesDBGame[];
  debugUrl?: string; // For debugging purposes
  remaining_monthly_allowance?: number;
  extra_allowance?: number;
}

export interface TheGamesDBImage {
  id: number;
  type: string;
  side?: string;
  filename: string;
  resolution?: string;
}

export interface TheGamesDBGameImages {
  base_url: {
    original: string;
    small: string;
    thumb: string;
    cropped_center_thumb: string;
    medium: string;
    large: string;
  };
  images: Record<string, TheGamesDBImage[]>;
}

// Nintendo Switch platform IDs in TheGamesDB
export const PLATFORM_IDS = {
  NINTENDO_SWITCH: 4971,
  // TODO: Update Switch 2 platform ID when TheGamesDB adds support for it
  // Currently using Switch platform ID as fallback
  NINTENDO_SWITCH_2: 4971,
};

// All Nintendo Switch platform IDs for filtering
export const SWITCH_PLATFORM_IDS = [
  PLATFORM_IDS.NINTENDO_SWITCH,
  PLATFORM_IDS.NINTENDO_SWITCH_2,
];

export interface SearchOptions {
  platformId?: number;        // Specific platform (defaults to Switch)
  includeFields?: string[];   // Additional fields to include (boxart, platform, etc.)
  page?: number;              // Page number for pagination (1-based)
}

export const isTheGamesDBConfigured = () => {
  // API key is now managed by the backend, so this is always true
  return true;
};

// API Allowance tracking
const ALLOWANCE_STORAGE_KEY = 'thegamesdb_allowance';
const ALLOWANCE_TIMESTAMP_KEY = 'thegamesdb_allowance_timestamp';

interface AllowanceInfo {
  remaining: number;
  extra: number;
  timestamp: number;
}

export function getStoredAllowance(): AllowanceInfo | null {
  try {
    const stored = localStorage.getItem(ALLOWANCE_STORAGE_KEY);
    const timestamp = localStorage.getItem(ALLOWANCE_TIMESTAMP_KEY);
    if (stored && timestamp) {
      return {
        remaining: parseInt(stored),
        extra: 0,
        timestamp: parseInt(timestamp)
      };
    }
  } catch (error) {
    console.error('Failed to get stored allowance:', error);
  }
  return null;
}

export function storeAllowance(remaining: number): void {
  try {
    localStorage.setItem(ALLOWANCE_STORAGE_KEY, remaining.toString());
    localStorage.setItem(ALLOWANCE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Failed to store allowance:', error);
  }
}

export function isAllowanceLow(): boolean {
  const allowance = getStoredAllowance();
  return allowance ? allowance.remaining < 50 : false;
}

export function isAllowanceExhausted(): boolean {
  const allowance = getStoredAllowance();
  return allowance ? allowance.remaining === 0 : false;
}

// API Response Caching
const SEARCH_CACHE_KEY = 'thegamesdb_search_cache';
const GAME_CACHE_KEY = 'thegamesdb_game_cache';
const SEARCH_CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour for search results
const GAME_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours for game details

interface CachedResponse<T> {
  data: T;
  timestamp: number;
}

function getSearchCache(): Record<string, CachedResponse<TheGamesDBSearchResult>> {
  try {
    const cached = localStorage.getItem(SEARCH_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (error) {
    console.error('Failed to get search cache:', error);
  }
  return {};
}

function setSearchCache(key: string, data: TheGamesDBSearchResult): void {
  try {
    const cache = getSearchCache();
    // Limit cache size - keep only last 50 searches
    const keys = Object.keys(cache);
    if (keys.length > 50) {
      const oldestKey = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp)[0];
      delete cache[oldestKey];
    }
    cache[key] = { data, timestamp: Date.now() };
    localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to set search cache:', error);
  }
}

function getCachedSearch(key: string): TheGamesDBSearchResult | null {
  const cache = getSearchCache();
  const cached = cache[key];
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_EXPIRY_MS) {
    console.log('Using cached search result for:', key);
    return cached.data;
  }
  return null;
}

function getGameCache(): Record<number, CachedResponse<TheGamesDBGame>> {
  try {
    const cached = localStorage.getItem(GAME_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (error) {
    console.error('Failed to get game cache:', error);
  }
  return {};
}

function setGameCache(gameId: number, data: TheGamesDBGame): void {
  try {
    const cache = getGameCache();
    // Limit cache size - keep only last 100 games
    const keys = Object.keys(cache).map(Number);
    if (keys.length > 100) {
      const oldestKey = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp)[0];
      delete cache[oldestKey];
    }
    cache[gameId] = { data, timestamp: Date.now() };
    localStorage.setItem(GAME_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to set game cache:', error);
  }
}

function getCachedGame(gameId: number): TheGamesDBGame | null {
  const cache = getGameCache();
  const cached = cache[gameId];
  if (cached && Date.now() - cached.timestamp < GAME_CACHE_EXPIRY_MS) {
    console.log('Using cached game data for ID:', gameId);
    return cached.data;
  }
  return null;
}

// Clear all API caches (useful for debugging)
export function clearApiCache(): void {
  localStorage.removeItem(SEARCH_CACHE_KEY);
  localStorage.removeItem(GAME_CACHE_KEY);
  console.log('API cache cleared');
}

export async function searchGames(
  query: string, 
  options: SearchOptions = {}
): Promise<TheGamesDBSearchResult> {
  const {
    platformId = PLATFORM_IDS.NINTENDO_SWITCH,
    includeFields = ['boxart'],
    page = 1,
  } = options;

  // Create cache key from query parameters
  const cacheKey = `${query.toLowerCase().trim()}_${platformId}_${page}`;
  
  // Check cache first
  const cachedResult = getCachedSearch(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // API key is now added by the backend proxy
  const params = new URLSearchParams({
    name: query,
    include: includeFields.join(','),
  });

  // Always filter by platform (Nintendo Switch by default)
  if (platformId) {
    params.set('filter[platform]', platformId.toString());
  }

  // Add pagination
  if (page > 1) {
    params.set('page', page.toString());
  }

  try {
    const url = `${API_BASE_URL}/Games/ByGameName?${params}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TheGamesDB API error: ${response.status}`);
    }
    const data = await response.json();
    
    // Store API allowance if available
    if (data.remaining_monthly_allowance !== undefined) {
      storeAllowance(data.remaining_monthly_allowance);
    }
    
    const games = data.data?.games || [];
    
    const result: TheGamesDBSearchResult = {
      count: games.length,
      games,
      debugUrl: url,
      remaining_monthly_allowance: data.remaining_monthly_allowance,
      extra_allowance: data.extra_allowance,
    };
    
    // Cache the result
    setSearchCache(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Failed to search games:', error);
    return { count: 0, games: [] };
  }
}

export async function getGameById(gameId: number): Promise<TheGamesDBGame | null> {
  // Check cache first
  const cachedGame = getCachedGame(gameId);
  if (cachedGame) {
    return cachedGame;
  }

  // API key is now added by the backend proxy
  const params = new URLSearchParams({
    id: gameId.toString(),
    fields: 'players,publishers,genres,overview,last_updated,rating,platform,coop,youtube,os,processor,ram,hdd,video,sound,alternates',
    include: 'boxart,platform',
  });

  try {
    const response = await fetch(`${API_BASE_URL}/Games/ByGameID?${params}`);
    if (!response.ok) {
      throw new Error(`TheGamesDB API error: ${response.status}`);
    }
    const data = await response.json();
    console.log('getGameById raw response:', data);
    
    // Store API allowance if available
    if (data.remaining_monthly_allowance !== undefined) {
      storeAllowance(data.remaining_monthly_allowance);
    }
    
    const games = data.data?.games;
    let game: TheGamesDBGame | null = null;
    
    // games is an array, find the game by ID
    if (Array.isArray(games)) {
      game = games.find((g: TheGamesDBGame) => g.id === gameId) || null;
    } else if (games && games[gameId]) {
      // Fallback: if games is an object keyed by ID
      game = games[gameId];
    }
    
    // Cache the result
    if (game) {
      setGameCache(gameId, game);
    }
    
    return game;
  } catch (error) {
    console.error('Failed to get game:', error);
    return null;
  }
}

export async function getGameImages(gameId: number): Promise<TheGamesDBGameImages | null> {
  // API key is now added by the backend proxy
  const params = new URLSearchParams({
    games_id: gameId.toString(),
  });

  try {
    const response = await fetch(`${API_BASE_URL}/Games/Images?${params}`);
    if (!response.ok) {
      throw new Error(`TheGamesDB API error: ${response.status}`);
    }
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Failed to get game images:', error);
    return null;
  }
}

export function getBoxartUrl(images: TheGamesDBGameImages | null, gameId: number, size: 'small' | 'medium' | 'large' | 'original' = 'medium'): string | null {
  if (!images || !images.images[gameId]) {
    return null;
  }

  const gameImages = images.images[gameId];
  const boxart = gameImages.find(img => img.type === 'boxart' && img.side === 'front');
  
  if (!boxart) {
    return null;
  }

  const baseUrl = images.base_url[size] || images.base_url.original;
  return `${baseUrl}${boxart.filename}`;
}

// Lookup data caching
const GENRES_CACHE_KEY = 'thegamesdb_genres';
const DEVELOPERS_CACHE_KEY = 'thegamesdb_developers';
const PUBLISHERS_CACHE_KEY = 'thegamesdb_publishers';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedLookup {
  data: Record<number, string>;
  timestamp: number;
}

function getCachedLookup(key: string): Record<number, string> | null {
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed: CachedLookup = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_EXPIRY_MS) {
        return parsed.data;
      }
    }
  } catch (error) {
    console.error('Failed to get cached lookup:', error);
  }
  return null;
}

function setCachedLookup(key: string, data: Record<number, string>): void {
  try {
    const cached: CachedLookup = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch (error) {
    console.error('Failed to cache lookup:', error);
  }
}

export async function getGenres(): Promise<Record<number, string>> {
  const cached = getCachedLookup(GENRES_CACHE_KEY);
  if (cached) return cached;

  try {
    // API key is now added by the backend proxy
    const response = await fetch(`${API_BASE_URL}/Genres`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    
    if (data.remaining_monthly_allowance !== undefined) {
      storeAllowance(data.remaining_monthly_allowance);
    }
    
    const genres: Record<number, string> = {};
    if (data.data?.genres) {
      for (const [id, genre] of Object.entries(data.data.genres)) {
        genres[parseInt(id)] = (genre as { name: string }).name;
      }
    }
    setCachedLookup(GENRES_CACHE_KEY, genres);
    return genres;
  } catch (error) {
    console.error('Failed to fetch genres:', error);
    return {};
  }
}

export async function getDevelopers(): Promise<Record<number, string>> {
  const cached = getCachedLookup(DEVELOPERS_CACHE_KEY);
  if (cached) return cached;

  try {
    // API key is now added by the backend proxy
    const response = await fetch(`${API_BASE_URL}/Developers`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    
    if (data.remaining_monthly_allowance !== undefined) {
      storeAllowance(data.remaining_monthly_allowance);
    }
    
    const developers: Record<number, string> = {};
    if (data.data?.developers) {
      for (const [id, dev] of Object.entries(data.data.developers)) {
        developers[parseInt(id)] = (dev as { name: string }).name;
      }
    }
    setCachedLookup(DEVELOPERS_CACHE_KEY, developers);
    return developers;
  } catch (error) {
    console.error('Failed to fetch developers:', error);
    return {};
  }
}

export async function getPublishers(): Promise<Record<number, string>> {
  const cached = getCachedLookup(PUBLISHERS_CACHE_KEY);
  if (cached) return cached;

  try {
    // API key is now added by the backend proxy
    const response = await fetch(`${API_BASE_URL}/Publishers`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    
    if (data.remaining_monthly_allowance !== undefined) {
      storeAllowance(data.remaining_monthly_allowance);
    }
    
    const publishers: Record<number, string> = {};
    if (data.data?.publishers) {
      for (const [id, pub] of Object.entries(data.data.publishers)) {
        publishers[parseInt(id)] = (pub as { name: string }).name;
      }
    }
    setCachedLookup(PUBLISHERS_CACHE_KEY, publishers);
    return publishers;
  } catch (error) {
    console.error('Failed to fetch publishers:', error);
    return {};
  }
}

// Helper to map IDs to names
export function mapIdsToNames(ids: number[] | undefined, lookup: Record<number, string>): string[] {
  if (!ids) return [];
  return ids.map(id => lookup[id] || `Unknown (${id})`);
}
