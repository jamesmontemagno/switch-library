// TheGamesDB API Service
// API Documentation: https://api.thegamesdb.net/

// Use proxy in development to avoid CORS issues, direct API in production
const API_BASE_URL = import.meta.env.DEV ? '/api/thegamesdb' : 'https://api.thegamesdb.net/v1';
const API_KEY = import.meta.env.VITE_THEGAMESDB_API_KEY || '';

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
  alternates?: string;
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
  return Boolean(API_KEY);
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

export function storeAllowance(remaining: number, _extra: number = 0): void {
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

export async function searchGames(
  query: string, 
  options: SearchOptions = {}
): Promise<TheGamesDBSearchResult> {
  if (!API_KEY) {
    console.warn('TheGamesDB API key not configured');
    return { count: 0, games: [] };
  }

  const {
    platformId = PLATFORM_IDS.NINTENDO_SWITCH,
    includeFields = ['boxart'],
    page = 1,
  } = options;

  const params = new URLSearchParams({
    apikey: API_KEY,
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
      storeAllowance(data.remaining_monthly_allowance, data.extra_allowance || 0);
    }
    
    const games = data.data?.games || [];
    
    return {
      count: games.length,
      games,
      debugUrl: url,
      remaining_monthly_allowance: data.remaining_monthly_allowance,
      extra_allowance: data.extra_allowance,
    };
  } catch (error) {
    console.error('Failed to search games:', error);
    return { count: 0, games: [] };
  }
}

export async function getGameById(gameId: number): Promise<TheGamesDBGame | null> {
  if (!API_KEY) {
    console.warn('TheGamesDB API key not configured');
    return null;
  }

  const params = new URLSearchParams({
    apikey: API_KEY,
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
    const games = data.data?.games;
    return games && games[gameId] ? games[gameId] : null;
  } catch (error) {
    console.error('Failed to get game:', error);
    return null;
  }
}

export async function getGameImages(gameId: number): Promise<TheGamesDBGameImages | null> {
  if (!API_KEY) {
    console.warn('TheGamesDB API key not configured');
    return null;
  }

  const params = new URLSearchParams({
    apikey: API_KEY,
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
