import { useState, useEffect } from 'react';
import type { Platform } from '../types';

type SortOption = 'title_asc' | 'title_desc' | 'added_newest' | 'added_oldest' | 'purchase_newest' | 'purchase_oldest' | 'platform' | 'format' | 'completed_first' | 'not_completed_first';
type ViewMode = 'grid' | 'list' | 'compact';
type SearchViewMode = 'grid' | 'list' | 'compact';
type FormatFilter = 'all' | 'Physical' | 'Digital';
type Theme = 'light' | 'dark' | 'nes' | 'famicom' | 'system';
type SearchSortOption = 'relevance' | 'release_desc' | 'release_asc' | 'title_asc' | 'title_desc';

export interface UserPreferences {
  theme: Theme;
  library?: {
    filterPlatform: Platform | 'all';
    filterFormat: FormatFilter;
    filterCompleted: 'all' | 'completed' | 'not_completed';
    filterFavorite: 'all' | 'favorites_only' | 'not_favorites';
    sortBy: SortOption;
    viewMode: ViewMode;
  };
  search?: {
    platform: Platform | 'all';
    region: 'all' | number;
    sortBy: SearchSortOption;
    viewMode: SearchViewMode;
  };
  friends?: {
    sortBy: 'added_desc' | 'added_asc' | 'nickname_asc' | 'nickname_desc' | 'games_desc' | 'games_asc';
  };
}

const STORAGE_KEY = 'switch-library-preferences';

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  library: {
    filterPlatform: 'all',
    filterFormat: 'all',
    filterCompleted: 'all',
    filterFavorite: 'all',
    sortBy: 'added_newest',
    viewMode: 'grid',
  },
  search: {
    platform: 'all',
    region: 'all',
    sortBy: 'relevance',
    viewMode: 'grid',
  },
  friends: {
    sortBy: 'added_desc',
  },
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
    return DEFAULT_PREFERENCES;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }, [preferences]);

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement;
    const theme = preferences.theme;
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [preferences.theme]);

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  };

  const setTheme = (theme: Theme) => {
    setPreferences(prev => ({ ...prev, theme }));
  };

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  return {
    preferences,
    theme: preferences.theme,
    updatePreferences,
    setTheme,
    resetPreferences,
  };
}
