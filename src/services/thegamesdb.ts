// Game Search Service
// Data source: Azure SQL Database (synced from TheGamesDB)
// Note: All user-facing queries now use SQL database, not TheGamesDB API directly

import { logger } from './logger';

// Backend API base URL - proxied in development, full URL in production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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
  country_id?: number;
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
  // Boxart URLs
  boxart?: {
    filename: string;
    original: string;
    small: string;
    thumb: string;
    cropped_center_thumb: string;
    medium: string;
    large: string;
  };
}

export interface TheGamesDBSearchResult {
  count: number;
  games: TheGamesDBGame[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
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

// Nintendo Switch platform IDs
export const PLATFORM_IDS = {
  NINTENDO_SWITCH: 4971,
  NINTENDO_SWITCH_2: 5021,
};

// All Nintendo Switch platform IDs for filtering
export const SWITCH_PLATFORM_IDS = [
  PLATFORM_IDS.NINTENDO_SWITCH,
  PLATFORM_IDS.NINTENDO_SWITCH_2,
];

export interface SearchOptions {
  platformId?: number;        // Specific platform (defaults to Switch)
  genreIds?: number[];        // Filter by genres
  developerIds?: number[];    // Filter by developers
  publisherIds?: number[];    // Filter by publishers
  releaseYear?: number;       // Filter by release year
  coop?: boolean;             // Filter by co-op support
  minPlayers?: number;        // Filter by minimum player count
  page?: number;              // Page number for pagination (1-based)
  pageSize?: number;          // Results per page (default: 20, max: 50)
}

export const isTheGamesDBConfigured = () => {
  // SQL database is always available (no API key needed for user queries)
  return true;
};

// Legacy API allowance functions - kept for backwards compatibility but return unlimited
// Since we now use SQL database, there are no API rate limits
export function getStoredAllowance(): { remaining: number; extra: number; timestamp: number } | null {
  // Return unlimited allowance since SQL has no limits
  return { remaining: 999999, extra: 0, timestamp: Date.now() };
}

export function storeAllowance(): void {
  // No-op: SQL database has no allowance limits
}

export function isAllowanceLow(): boolean {
  // Always false - SQL has no limits
  return false;
}

export function isAllowanceExhausted(): boolean {
  // Always false - SQL has no limits
  return false;
}

// API Response Caching
// Reduced TTL since SQL queries are fast, but still cache to reduce redundant network calls
const SEARCH_CACHE_KEY = 'sql_search_cache';
const GAME_CACHE_KEY = 'sql_game_cache';
const SEARCH_CACHE_EXPIRY_MS = 1 * 60 * 60 * 1000; // 1 hour (reduced from 7 days)
const GAME_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours (reduced from 30 days)

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

// SQL database response types
interface SqlGameDto {
  id: number;
  gameTitle: string;
  releaseDate?: string;
  platform: number;
  platformName: string;
  regionId?: number;
  players?: number;
  overview?: string;
  rating?: string;
  coop?: string;
  youtube?: string;
  alternates?: string[];
  genres: { id: number; name: string }[];
  developers: { id: number; name: string }[];
  publishers: { id: number; name: string }[];
  boxart?: {
    filename: string;
    original: string;
    small: string;
    thumb: string;
    croppedCenterThumb: string;
    medium: string;
    large: string;
  };
}

interface SqlSearchResult {
  games: SqlGameDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Convert SQL DTO to our standard game format
function mapSqlGameToStandard(sqlGame: SqlGameDto): TheGamesDBGame {
  return {
    id: sqlGame.id,
    game_title: sqlGame.gameTitle,
    release_date: sqlGame.releaseDate,
    platform: sqlGame.platform,
    players: sqlGame.players,
    overview: sqlGame.overview,
    developers: sqlGame.developers?.map(d => d.id),
    publishers: sqlGame.publishers?.map(p => p.id),
    genres: sqlGame.genres?.map(g => g.id),
    rating: sqlGame.rating,
    region_id: sqlGame.regionId,
    coop: sqlGame.coop,
    youtube: sqlGame.youtube,
    alternates: sqlGame.alternates,
    boxart: sqlGame.boxart ? {
      filename: sqlGame.boxart.filename,
      original: sqlGame.boxart.original,
      small: sqlGame.boxart.small,
      thumb: sqlGame.boxart.thumb,
      cropped_center_thumb: sqlGame.boxart.croppedCenterThumb,
      medium: sqlGame.boxart.medium,
      large: sqlGame.boxart.large,
    } : undefined,
  };
}

export async function searchGames(
  query: string, 
  options: SearchOptions = {}
): Promise<TheGamesDBSearchResult> {
  const {
    platformId,
    genreIds,
    developerIds,
    publisherIds,
    releaseYear,
    coop,
    minPlayers,
    page = 1,
    pageSize = 20,
  } = options;

  // Create cache key from all query parameters including filters
  const cacheKey = `${query.toLowerCase().trim()}_${platformId || 'all'}_${genreIds?.join('-') || ''}_${developerIds?.join('-') || ''}_${publisherIds?.join('-') || ''}_${releaseYear || ''}_${coop ?? ''}_${minPlayers || ''}_${page}_${pageSize}`;
  
  // Check cache first
  const cachedResult = getCachedSearch(cacheKey);
  if (cachedResult) {
    logger.cache('hit', `search:${cacheKey}`, { query, gameCount: cachedResult.count });
    return cachedResult;
  }

  logger.cache('miss', `search:${cacheKey}`, { query });
  logger.apiUsage('SQL.searchGames', { query, platformId, page });

  // Build query parameters for SQL endpoint
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (platformId) params.set('platformId', platformId.toString());
  if (genreIds?.length) params.set('genreIds', genreIds.join(','));
  if (developerIds?.length) params.set('developerIds', developerIds.join(','));
  if (publisherIds?.length) params.set('publisherIds', publisherIds.join(','));
  if (releaseYear) params.set('releaseYear', releaseYear.toString());
  if (coop !== undefined) params.set('coop', coop.toString());
  if (minPlayers) params.set('minPlayers', minPlayers.toString());
  params.set('page', page.toString());
  params.set('pageSize', Math.min(pageSize, 50).toString());

  try {
    const url = `${API_BASE_URL}/search?${params}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      logger.error('SQL search error', new Error(`Status ${response.status}`), { query, url });
      throw new Error(`SQL search error: ${response.status}`);
    }
    
    const data: SqlSearchResult = await response.json();
    
    // Convert SQL results to standard format
    const games = data.games.map(mapSqlGameToStandard);
    
    const result: TheGamesDBSearchResult = {
      count: games.length,
      games,
      totalCount: data.totalCount,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
    };
    
    // Cache the result
    setSearchCache(cacheKey, result);
    logger.cache('set', `search:${cacheKey}`, { query, gameCount: result.count });
    logger.info('Games search completed', { query, count: result.count, totalCount: data.totalCount });
    
    return result;
  } catch (error) {
    logger.error('Failed to search games', error, { query });
    console.error('Failed to search games:', error);
    return { count: 0, games: [] };
  }
}

export async function getGameById(gameId: number): Promise<TheGamesDBGame | null> {
  // Check cache first
  const cachedGame = getCachedGame(gameId);
  if (cachedGame) {
    logger.cache('hit', `game:${gameId}`, { gameId, title: cachedGame.game_title });
    return cachedGame;
  }

  logger.cache('miss', `game:${gameId}`, { gameId });
  logger.apiUsage('SQL.getGameById', { gameId });

  try {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        logger.warn('Game not found', { gameId });
        return null;
      }
      logger.error('SQL API error', new Error(`Status ${response.status}`), { gameId });
      throw new Error(`SQL API error: ${response.status}`);
    }
    
    const data: SqlGameDto = await response.json();
    const game = mapSqlGameToStandard(data);
    
    // Cache the result
    setGameCache(gameId, game);
    logger.cache('set', `game:${gameId}`, { gameId, title: game.game_title });
    logger.info('Game loaded by ID', { gameId, title: game.game_title });
    
    return game;
  } catch (error) {
    logger.error('Failed to get game by ID', error, { gameId });
    console.error('Failed to get game:', error);
    return null;
  }
}

export async function getGameImages(): Promise<TheGamesDBGameImages | null> {
  // Images are now included in game details from SQL
  // This function is kept for backwards compatibility
  return null;
}

export function getBoxartUrl(images: TheGamesDBGameImages | null): string | null {
  if (!images) {
    return null;
  }
  return null;
}

// Lookup data caching
const GENRES_CACHE_KEY = 'sql_genres';
const DEVELOPERS_CACHE_KEY = 'sql_developers';
const PUBLISHERS_CACHE_KEY = 'sql_publishers';
const LOOKUP_CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedLookup {
  data: Record<number, string>;
  timestamp: number;
}

function getCachedLookup(key: string): Record<number, string> | null {
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed: CachedLookup = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < LOOKUP_CACHE_EXPIRY_MS) {
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
    const response = await fetch(`${API_BASE_URL}/lookup/genres`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    
    const genres: Record<number, string> = {};
    if (result.data && Array.isArray(result.data)) {
      for (const item of result.data) {
        genres[item.id] = item.name;
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
    const response = await fetch(`${API_BASE_URL}/lookup/developers`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    
    const developers: Record<number, string> = {};
    if (result.data && Array.isArray(result.data)) {
      for (const item of result.data) {
        developers[item.id] = item.name;
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
    const response = await fetch(`${API_BASE_URL}/lookup/publishers`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const result = await response.json();
    
    const publishers: Record<number, string> = {};
    if (result.data && Array.isArray(result.data)) {
      for (const item of result.data) {
        publishers[item.id] = item.name;
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

// Bulk game fetch for trending feature
export interface BulkGameResult {
  id: number;
  title: string;
  releaseDate?: string;
  platform: string;
  platformId: number;
  region_id?: number;
  coverUrl?: string;
  overview?: string;
}

export async function getGamesByIds(
  ids: number[]
): Promise<{ found: BulkGameResult[]; notFound: number[] }> {
  if (ids.length === 0) {
    return { found: [], notFound: [] };
  }

  logger.apiUsage('SQL.getGamesByIds', { count: ids.length });

  try {
    const response = await fetch(`${API_BASE_URL}/games/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      logger.error('Bulk games fetch error', new Error(`Status ${response.status}`), { ids });
      throw new Error(`Bulk games SQL error: ${response.status}`);
    }

    const data = await response.json();
    logger.info('Bulk games loaded', { 
      foundCount: data.foundCount, 
      notFoundCount: data.notFoundCount 
    });

    // Parse the found games into a consistent format
    const foundGames: BulkGameResult[] = (data.found || []).map((game: SqlGameDto) => {
      const coverUrl = game.boxart?.thumb || game.boxart?.small || game.boxart?.medium;
      
      return {
        id: game.id,
        title: game.gameTitle,
        releaseDate: game.releaseDate,
        platform: game.platformName || (game.platform === PLATFORM_IDS.NINTENDO_SWITCH_2 ? 'Nintendo Switch 2' : 'Nintendo Switch'),
        platformId: game.platform,
        region_id: game.regionId,
        coverUrl,
        overview: game.overview,
      };
    });

    // Cache found games for future single lookups
    foundGames.forEach(game => {
      const fullGame = (data.found || []).find((g: SqlGameDto) => g.id === game.id);
      if (fullGame) {
        setGameCache(game.id, mapSqlGameToStandard(fullGame));
      }
    });

    return {
      found: foundGames,
      notFound: data.notFound || [],
    };
  } catch (error) {
    logger.error('Failed to get games by IDs', error, { ids });
    return { found: [], notFound: ids };
  }
}

// Get upcoming game releases
export interface UpcomingGamesResult {
  games: BulkGameResult[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getUpcomingGames(
  days: number = 90,
  platformId?: number,
  page: number = 1,
  pageSize: number = 20
): Promise<UpcomingGamesResult> {
  logger.apiUsage('SQL.getUpcomingGames', { days, platformId, page });

  try {
    const params = new URLSearchParams();
    params.set('days', days.toString());
    if (platformId) params.set('platformId', platformId.toString());
    params.set('page', page.toString());
    params.set('pageSize', pageSize.toString());

    const response = await fetch(`${API_BASE_URL}/upcoming?${params}`);
    
    if (!response.ok) {
      logger.error('Upcoming games fetch error', new Error(`Status ${response.status}`));
      throw new Error(`Upcoming games error: ${response.status}`);
    }

    const data: SqlSearchResult = await response.json();
    
    const games: BulkGameResult[] = data.games.map((game: SqlGameDto) => ({
      id: game.id,
      title: game.gameTitle,
      releaseDate: game.releaseDate,
      platform: game.platformName || (game.platform === PLATFORM_IDS.NINTENDO_SWITCH_2 ? 'Nintendo Switch 2' : 'Nintendo Switch'),
      platformId: game.platform,
      region_id: game.regionId,
      coverUrl: game.boxart?.thumb || game.boxart?.small || game.boxart?.medium,
      overview: game.overview,
    }));

    return {
      games,
      totalCount: data.totalCount,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
    };
  } catch (error) {
    logger.error('Failed to get upcoming games', error);
    return { games: [], totalCount: 0, page: 1, pageSize, totalPages: 0 };
  }
}

// Get game recommendations
export async function getGameRecommendations(
  gameId: number,
  limit: number = 10
): Promise<BulkGameResult[]> {
  logger.apiUsage('SQL.getRecommendations', { gameId, limit });

  try {
    const response = await fetch(`${API_BASE_URL}/recommendations/${gameId}?limit=${limit}`);
    
    if (!response.ok) {
      logger.error('Recommendations fetch error', new Error(`Status ${response.status}`), { gameId });
      throw new Error(`Recommendations error: ${response.status}`);
    }

    const data = await response.json();
    
    return (data.recommendations || []).map((game: SqlGameDto) => ({
      id: game.id,
      title: game.gameTitle,
      releaseDate: game.releaseDate,
      platform: game.platformName || (game.platform === PLATFORM_IDS.NINTENDO_SWITCH_2 ? 'Nintendo Switch 2' : 'Nintendo Switch'),
      platformId: game.platform,
      region_id: game.regionId,
      coverUrl: game.boxart?.thumb || game.boxart?.small || game.boxart?.medium,
      overview: game.overview,
    }));
  } catch (error) {
    logger.error('Failed to get recommendations', error, { gameId });
    return [];
  }
}

// Get database statistics
export interface DatabaseStats {
  totalGames: number;
  switchGames: number;
  switch2Games: number;
  totalGenres: number;
  totalDevelopers: number;
  totalPublishers: number;
  lastSyncTime?: string;
}

export async function getDatabaseStats(): Promise<DatabaseStats | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/stats`);
    
    if (!response.ok) {
      logger.error('Stats fetch error', new Error(`Status ${response.status}`));
      return null;
    }

    return await response.json();
  } catch (error) {
    logger.error('Failed to get database stats', error);
    return null;
  }
}

// Region mappings (based on TheGamesDB region IDs)
export const REGIONS: Record<number, string> = {
  0: 'Global',
  1: 'North America',
  2: 'North America',
  3: 'Japan',
  4: 'Australia',
  5: 'Asia',
  6: 'Europe',
  7: 'South America',
  8: 'Africa',
  9: 'Middle East',
};

export function getRegionName(regionId: number | undefined): string {
  if (regionId === undefined || regionId === null) return 'Unknown';
  if (regionId === 0) return 'Global';
  return REGIONS[regionId] || `Region ${regionId}`;
}
