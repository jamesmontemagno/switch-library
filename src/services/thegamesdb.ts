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
}

export interface TheGamesDBSearchResult {
  count: number;
  games: TheGamesDBGame[];
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

// Region IDs from TheGamesDB
export const REGION_IDS = {
  US: 1,      // United States
  UK: 2,      // United Kingdom  
  EU: 3,      // Europe
  JP: 4,      // Japan
  AU: 5,      // Australia
  SS: 6,      // Sweden
  DK: 7,      // Denmark
  FI: 8,      // Finland
  FR: 9,      // France
  DE: 10,     // Germany
  IT: 11,     // Italy
  NL: 12,     // Netherlands
  KR: 13,     // South Korea
  TW: 14,     // Taiwan
  CN: 15,     // China
  ES: 16,     // Spain
  WW: 17,     // World
};

// Region labels for UI
export const REGION_LABELS: Record<number, string> = {
  [REGION_IDS.US]: 'United States',
  [REGION_IDS.UK]: 'United Kingdom',
  [REGION_IDS.EU]: 'Europe',
  [REGION_IDS.JP]: 'Japan',
  [REGION_IDS.AU]: 'Australia',
  [REGION_IDS.FR]: 'France',
  [REGION_IDS.DE]: 'Germany',
  [REGION_IDS.IT]: 'Italy',
  [REGION_IDS.ES]: 'Spain',
  [REGION_IDS.KR]: 'South Korea',
  [REGION_IDS.WW]: 'Worldwide',
};

// Default English-speaking regions
export const DEFAULT_REGIONS = [REGION_IDS.US, REGION_IDS.UK, REGION_IDS.EU, REGION_IDS.AU, REGION_IDS.WW];

export interface SearchOptions {
  platformId?: number;        // Specific platform (defaults to Switch)
  regions?: number[];         // Region IDs to filter by
  includeFields?: string[];   // Additional fields to include (boxart, platform, etc.)
}

export const isTheGamesDBConfigured = () => {
  return Boolean(API_KEY);
};

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

  try {
    const response = await fetch(`${API_BASE_URL}/Games/ByGameName?${params}`);
    if (!response.ok) {
      throw new Error(`TheGamesDB API error: ${response.status}`);
    }
    const data = await response.json();
    
    let games = data.data?.games || [];
    
    // Filter by regions if specified (client-side filtering since API may not support it directly)
    // Note: TheGamesDB doesn't always include region_id in search results,
    // so this filter is best-effort
    if (options.regions && options.regions.length > 0) {
      games = games.filter((game: TheGamesDBGame) => {
        // If no region_id, include it (assume worldwide)
        if (!game.region_id) return true;
        return options.regions!.includes(game.region_id);
      });
    }
    
    return {
      count: games.length,
      games,
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
