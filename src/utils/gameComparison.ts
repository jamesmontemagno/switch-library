/**
 * Utility functions for comparing games across libraries
 * Handles fuzzy matching to catch title variations
 */

/**
 * Normalizes a game title for comparison by:
 * - Converting to lowercase
 * - Removing special characters (™, ®, ©, etc.)
 * - Removing punctuation (colons, dashes, apostrophes, etc.)
 * - Removing extra whitespace
 * - Removing common subtitle separators
 */
export function normalizeGameTitle(title: string): string {
  return title
    .toLowerCase()
    // Remove trademark symbols and copyright
    .replace(/[™®©]/g, '')
    // Remove punctuation but keep spaces
    .replace(/[:\-–—''`'"".!?()[\]{}]/g, ' ')
    // Remove extra whitespace and trim
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Creates a comparison key for a game that can be used in Sets/Maps
 * Uses both thegamesdbId (if available) and normalized title for matching
 */
export interface GameComparisonKey {
  id?: number;
  normalizedTitle: string;
}

/**
 * Checks if two games match based on ID or title similarity
 * Priority order:
 * 1. If both have the same ID (and IDs exist), they match
 * 2. If normalized titles match, they match (even with different IDs)
 * 3. If one has an ID and the other doesn't, use title matching
 */
export function gamesMatch(game1: GameComparisonKey, game2: GameComparisonKey): boolean {
  // Exact ID match (highest confidence) - both must have IDs and they must match
  if (game1.id && game2.id && game1.id === game2.id) {
    return true;
  }
  
  // Normalized title match (catches variations and different IDs)
  // This is the key improvement - match by title even if IDs differ or are missing
  if (game1.normalizedTitle === game2.normalizedTitle) {
    return true;
  }
  
  return false;
}

/**
 * Finds matching game from a list based on comparison key
 */
export function findMatchingGame(
  targetGame: GameComparisonKey,
  gamesList: GameComparisonKey[]
): GameComparisonKey | undefined {
  return gamesList.find(game => gamesMatch(targetGame, game));
}
