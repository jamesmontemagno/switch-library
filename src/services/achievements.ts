import type { Achievement, UserAchievement, GameEntry } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { logger } from './logger';

const ACHIEVEMENTS_STORAGE_KEY = 'switch-library-achievements';
const useSupabase = isSupabaseConfigured();

// Define all achievements
export const ACHIEVEMENTS: Achievement[] = [
  // Collection achievements
  {
    id: 'first_game',
    name: 'First Step',
    description: 'Add your first game to the library',
    category: 'collection',
    icon: 'faGamepad',
    requirement: 1,
    rarity: 'common',
  },
  {
    id: 'collector_5',
    name: 'Collector',
    description: 'Own 5 games in your library',
    category: 'collection',
    icon: 'faBoxOpen',
    requirement: 5,
    rarity: 'common',
  },
  {
    id: 'collector_10',
    name: 'Growing Collection',
    description: 'Own 10 games in your library',
    category: 'collection',
    icon: 'faBoxes',
    requirement: 10,
    rarity: 'common',
  },
  {
    id: 'collector_25',
    name: 'Enthusiast',
    description: 'Own 25 games in your library',
    category: 'collection',
    icon: 'faStore',
    requirement: 25,
    rarity: 'rare',
  },
  {
    id: 'collector_50',
    name: 'True Collector',
    description: 'Own 50 games in your library',
    category: 'collection',
    icon: 'faWarehouse',
    requirement: 50,
    rarity: 'rare',
  },
  {
    id: 'collector_100',
    name: 'Master Collector',
    description: 'Own 100 games in your library',
    category: 'collection',
    icon: 'faCrown',
    requirement: 100,
    rarity: 'epic',
  },
  {
    id: 'collector_250',
    name: 'Legendary Collector',
    description: 'Own 250 games in your library',
    category: 'collection',
    icon: 'faTrophy',
    requirement: 250,
    rarity: 'legendary',
  },

  // Completion achievements
  {
    id: 'first_completion',
    name: 'Achievement Unlocked',
    description: 'Complete your first game',
    category: 'completion',
    icon: 'faTrophy',
    requirement: 1,
    rarity: 'common',
  },
  {
    id: 'completionist_5',
    name: 'Finisher',
    description: 'Complete 5 games',
    category: 'completion',
    icon: 'faCheckCircle',
    requirement: 5,
    rarity: 'common',
  },
  {
    id: 'completionist_10',
    name: 'Game Master',
    description: 'Complete 10 games',
    category: 'completion',
    icon: 'faCheckDouble',
    requirement: 10,
    rarity: 'rare',
  },
  {
    id: 'completionist_25',
    name: 'True Completionist',
    description: 'Complete 25 games',
    category: 'completion',
    icon: 'faMedal',
    requirement: 25,
    rarity: 'rare',
  },
  {
    id: 'completionist_50',
    name: 'Gaming Legend',
    description: 'Complete 50 games',
    category: 'completion',
    icon: 'faStar',
    requirement: 50,
    rarity: 'epic',
  },
  {
    id: 'completion_rate_50',
    name: 'Halfway There',
    description: 'Complete 50% of your collection',
    category: 'completion',
    icon: 'faPercent',
    requirement: 50,
    rarity: 'rare',
  },
  {
    id: 'completion_rate_100',
    name: 'Perfect Collection',
    description: 'Complete 100% of your collection',
    category: 'completion',
    icon: 'faGem',
    requirement: 100,
    rarity: 'legendary',
  },

  // Social achievements
  {
    id: 'first_friend',
    name: 'Making Friends',
    description: 'Follow your first friend',
    category: 'social',
    icon: 'faUserPlus',
    requirement: 1,
    rarity: 'common',
  },
  {
    id: 'social_5',
    name: 'Social Gamer',
    description: 'Follow 5 friends',
    category: 'social',
    icon: 'faUserGroup',
    requirement: 5,
    rarity: 'common',
  },
  {
    id: 'social_10',
    name: 'Community Member',
    description: 'Follow 10 friends',
    category: 'social',
    icon: 'faUsers',
    requirement: 10,
    rarity: 'rare',
  },
  {
    id: 'social_25',
    name: 'Social Butterfly',
    description: 'Follow 25 friends',
    category: 'social',
    icon: 'faUserFriends',
    requirement: 25,
    rarity: 'epic',
  },
  {
    id: 'sharing_enabled',
    name: 'Open Library',
    description: 'Enable library sharing',
    category: 'social',
    icon: 'faShareNodes',
    requirement: 1,
    rarity: 'common',
  },

  // Variety achievements
  {
    id: 'both_formats',
    name: 'Best of Both Worlds',
    description: 'Own both Physical and Digital games',
    category: 'variety',
    icon: 'faLayerGroup',
    requirement: 1,
    rarity: 'common',
  },
  {
    id: 'physical_collector_10',
    name: 'Physical Enthusiast',
    description: 'Own 10 physical games',
    category: 'variety',
    icon: 'faCompactDisc',
    requirement: 10,
    rarity: 'common',
  },
  {
    id: 'digital_collector_10',
    name: 'Digital Enthusiast',
    description: 'Own 10 digital games',
    category: 'variety',
    icon: 'faDownload',
    requirement: 10,
    rarity: 'common',
  },
  {
    id: 'switch_2_early',
    name: 'Early Adopter',
    description: 'Add your first Nintendo Switch 2 game',
    category: 'variety',
    icon: 'faRocket',
    requirement: 1,
    rarity: 'rare',
  },
  {
    id: 'wishlist_10',
    name: 'Wishful Thinking',
    description: 'Add 10 games to your wishlist',
    category: 'variety',
    icon: 'faHeart',
    requirement: 10,
    rarity: 'common',
  },

  // Milestone achievements
  {
    id: 'organized',
    name: 'Organized Gamer',
    description: 'Add notes to 10 games',
    category: 'milestone',
    icon: 'faNoteSticky',
    requirement: 10,
    rarity: 'common',
  },
  {
    id: 'time_traveler',
    name: 'Time Traveler',
    description: 'Track purchase dates for 10 games',
    category: 'milestone',
    icon: 'faCalendar',
    requirement: 10,
    rarity: 'common',
  },
  {
    id: 'collector_1year',
    name: 'One Year Strong',
    description: 'Use the library for 1 year',
    category: 'milestone',
    icon: 'faCake',
    requirement: 1,
    rarity: 'rare',
  },
];

// Calculate user stats from game entries
export interface UserStats {
  totalGames: number;
  ownedGames: number;
  completedGames: number;
  completionRate: number;
  physicalGames: number;
  digitalGames: number;
  switch2Games: number;
  wishlistGames: number;
  gamesWithNotes: number;
  gamesWithPurchaseDates: number;
}

export function calculateUserStats(games: GameEntry[]): UserStats {
  const ownedGames = games.filter(g => g.status === 'Owned');
  const completedGames = games.filter(g => g.completed && g.status === 'Owned');
  
  return {
    totalGames: games.length,
    ownedGames: ownedGames.length,
    completedGames: completedGames.length,
    completionRate: ownedGames.length > 0 ? (completedGames.length / ownedGames.length) * 100 : 0,
    physicalGames: games.filter(g => g.format === 'Physical').length,
    digitalGames: games.filter(g => g.format === 'Digital').length,
    switch2Games: games.filter(g => g.platform === 'Nintendo Switch 2').length,
    wishlistGames: games.filter(g => g.status === 'Wishlist').length,
    gamesWithNotes: games.filter(g => g.notes && g.notes.trim().length > 0).length,
    gamesWithPurchaseDates: games.filter(g => g.purchaseDate).length,
  };
}

// Check which achievements should be unlocked based on current stats
export function checkAchievements(
  stats: UserStats,
  friendCount: number,
  sharingEnabled: boolean,
  accountCreatedAt: string
): string[] {
  const unlockedAchievements: string[] = [];
  
  // Collection achievements
  if (stats.ownedGames >= 1) unlockedAchievements.push('first_game');
  if (stats.ownedGames >= 5) unlockedAchievements.push('collector_5');
  if (stats.ownedGames >= 10) unlockedAchievements.push('collector_10');
  if (stats.ownedGames >= 25) unlockedAchievements.push('collector_25');
  if (stats.ownedGames >= 50) unlockedAchievements.push('collector_50');
  if (stats.ownedGames >= 100) unlockedAchievements.push('collector_100');
  if (stats.ownedGames >= 250) unlockedAchievements.push('collector_250');
  
  // Completion achievements
  if (stats.completedGames >= 1) unlockedAchievements.push('first_completion');
  if (stats.completedGames >= 5) unlockedAchievements.push('completionist_5');
  if (stats.completedGames >= 10) unlockedAchievements.push('completionist_10');
  if (stats.completedGames >= 25) unlockedAchievements.push('completionist_25');
  if (stats.completedGames >= 50) unlockedAchievements.push('completionist_50');
  if (stats.completionRate >= 50 && stats.ownedGames >= 5) unlockedAchievements.push('completion_rate_50');
  if (stats.completionRate >= 100 && stats.ownedGames >= 3) unlockedAchievements.push('completion_rate_100');
  
  // Social achievements
  if (friendCount >= 1) unlockedAchievements.push('first_friend');
  if (friendCount >= 5) unlockedAchievements.push('social_5');
  if (friendCount >= 10) unlockedAchievements.push('social_10');
  if (friendCount >= 25) unlockedAchievements.push('social_25');
  if (sharingEnabled) unlockedAchievements.push('sharing_enabled');
  
  // Variety achievements
  if (stats.physicalGames >= 1 && stats.digitalGames >= 1) unlockedAchievements.push('both_formats');
  if (stats.physicalGames >= 10) unlockedAchievements.push('physical_collector_10');
  if (stats.digitalGames >= 10) unlockedAchievements.push('digital_collector_10');
  if (stats.switch2Games >= 1) unlockedAchievements.push('switch_2_early');
  if (stats.wishlistGames >= 10) unlockedAchievements.push('wishlist_10');
  
  // Milestone achievements
  if (stats.gamesWithNotes >= 10) unlockedAchievements.push('organized');
  if (stats.gamesWithPurchaseDates >= 10) unlockedAchievements.push('time_traveler');
  
  // Time-based achievement (1 year)
  const accountAge = Date.now() - new Date(accountCreatedAt).getTime();
  const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
  if (accountAge >= oneYearInMs) {
    unlockedAchievements.push('collector_1year');
  }
  
  return unlockedAchievements;
}

// Calculate achievement progress
export function calculateAchievementProgress(achievement: Achievement, stats: UserStats, friendCount: number): number {
  switch (achievement.id) {
    // Collection
    case 'first_game':
    case 'collector_5':
    case 'collector_10':
    case 'collector_25':
    case 'collector_50':
    case 'collector_100':
    case 'collector_250':
      return Math.min((stats.ownedGames / achievement.requirement) * 100, 100);
    
    // Completion
    case 'first_completion':
    case 'completionist_5':
    case 'completionist_10':
    case 'completionist_25':
    case 'completionist_50':
      return Math.min((stats.completedGames / achievement.requirement) * 100, 100);
    
    case 'completion_rate_50':
    case 'completion_rate_100':
      return Math.min((stats.completionRate / achievement.requirement) * 100, 100);
    
    // Social
    case 'first_friend':
    case 'social_5':
    case 'social_10':
    case 'social_25':
      return Math.min((friendCount / achievement.requirement) * 100, 100);
    
    // Variety
    case 'physical_collector_10':
      return Math.min((stats.physicalGames / achievement.requirement) * 100, 100);
    
    case 'digital_collector_10':
      return Math.min((stats.digitalGames / achievement.requirement) * 100, 100);
    
    case 'wishlist_10':
      return Math.min((stats.wishlistGames / achievement.requirement) * 100, 100);
    
    // Milestone
    case 'organized':
      return Math.min((stats.gamesWithNotes / achievement.requirement) * 100, 100);
    
    case 'time_traveler':
      return Math.min((stats.gamesWithPurchaseDates / achievement.requirement) * 100, 100);
    
    default:
      return 0;
  }
}

// LocalStorage functions
function loadAchievementsFromLocalStorage(userId: string): UserAchievement[] {
  try {
    const stored = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (stored) {
      const allAchievements = JSON.parse(stored) as UserAchievement[];
      return allAchievements.filter(a => a.userId === userId);
    }
  } catch (error) {
    console.error('Failed to load achievements from localStorage:', error);
  }
  return [];
}

function saveAchievementsToLocalStorage(achievements: UserAchievement[]): void {
  try {
    const stored = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    const allAchievements = stored ? JSON.parse(stored) as UserAchievement[] : [];
    
    // Remove old achievements for this user
    const userId = achievements[0]?.userId;
    const otherUsersAchievements = allAchievements.filter(a => a.userId !== userId);
    
    localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify([...otherUsersAchievements, ...achievements]));
  } catch (error) {
    console.error('Failed to save achievements to localStorage:', error);
  }
}

// Supabase functions
async function loadAchievementsFromSupabase(userId: string): Promise<UserAchievement[]> {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to load achievements from Supabase:', error);
    return [];
  }

  return ((data as Record<string, unknown>[] | null) || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    userId: row.user_id as string,
    achievementId: row.achievement_id as string,
    unlockedAt: row.unlocked_at as string,
    progress: row.progress as number | undefined,
  }));
}

async function saveAchievementsToSupabase(achievements: UserAchievement[]): Promise<boolean> {
  const supabaseAchievements = achievements.map(a => ({
    id: a.id,
    user_id: a.userId,
    achievement_id: a.achievementId,
    unlocked_at: a.unlockedAt,
    progress: a.progress,
  }));

  const { error } = await supabase
    .from('user_achievements')
    .upsert(supabaseAchievements);

  if (error) {
    console.error('Failed to save achievements to Supabase:', error);
    return false;
  }

  return true;
}

// Public API
export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
  logger.database('select', 'user_achievements', { userId });
  
  if (useSupabase) {
    return await loadAchievementsFromSupabase(userId);
  }
  return loadAchievementsFromLocalStorage(userId);
}

export async function unlockAchievements(userId: string, achievementIds: string[]): Promise<boolean> {
  logger.database('insert', 'user_achievements', { userId, count: achievementIds.length });
  
  const existingAchievements = await getUserAchievements(userId);
  const existingIds = new Set(existingAchievements.map(a => a.achievementId));
  
  // Only add new achievements
  const newAchievements = achievementIds
    .filter(id => !existingIds.has(id))
    .map(id => ({
      id: crypto.randomUUID(),
      userId,
      achievementId: id,
      unlockedAt: new Date().toISOString(),
    }));
  
  if (newAchievements.length === 0) {
    return true; // Nothing to unlock
  }
  
  const allAchievements = [...existingAchievements, ...newAchievements];
  
  if (useSupabase) {
    return await saveAchievementsToSupabase(allAchievements);
  }
  
  saveAchievementsToLocalStorage(allAchievements);
  return true;
}

// Get newly unlocked achievements (for notifications)
export async function getNewlyUnlockedAchievements(
  previousAchievementIds: string[],
  currentAchievementIds: string[]
): Promise<typeof ACHIEVEMENTS> {
  const newIds = currentAchievementIds.filter(id => !previousAchievementIds.includes(id));
  return ACHIEVEMENTS.filter(a => newIds.includes(a.id));
}
