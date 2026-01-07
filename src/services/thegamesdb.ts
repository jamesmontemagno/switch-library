// TheGamesDB API Service
// API Documentation: https://api.thegamesdb.net/

const API_BASE_URL = 'https://api.thegamesdb.net/v1';
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

// Nintendo Switch platform ID in TheGamesDB
export const PLATFORM_IDS = {
  NINTENDO_SWITCH: 4971,
  // TODO: Update Switch 2 platform ID when TheGamesDB adds support for it
  // Currently using Switch platform ID as fallback
  NINTENDO_SWITCH_2: 4971,
};

export const isTheGamesDBConfigured = () => {
  return Boolean(API_KEY);
};

export async function searchGames(query: string, platformId?: number): Promise<TheGamesDBSearchResult> {
  if (!API_KEY) {
    console.warn('TheGamesDB API key not configured');
    return { count: 0, games: [] };
  }

  const params = new URLSearchParams({
    apikey: API_KEY,
    name: query,
    include: 'boxart',
  });

  if (platformId) {
    params.set('filter[platform]', platformId.toString());
  }

  try {
    const response = await fetch(`${API_BASE_URL}/Games/ByGameName?${params}`);
    if (!response.ok) {
      throw new Error(`TheGamesDB API error: ${response.status}`);
    }
    const data = await response.json();
    return {
      count: data.data?.count || 0,
      games: data.data?.games || [],
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
