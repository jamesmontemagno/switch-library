import { useState, useEffect } from 'react';
import type { Platform } from '../types';

type SortOption = 'title_asc' | 'title_desc' | 'added_newest' | 'added_oldest' | 'purchase_newest' | 'purchase_oldest' | 'platform' | 'format' | 'completed_first' | 'not_completed_first';
type ViewMode = 'grid' | 'list' | 'compact';
type FormatFilter = 'all' | 'Physical' | 'Digital';

export interface UserPreferences {
  searchRegions: string[];
  library?: {
    filterPlatform: Platform | 'all';
    filterFormat: FormatFilter;
    filterCompleted: 'all' | 'completed' | 'not_completed';
    sortBy: SortOption;
    viewMode: ViewMode;
  };
}

const STORAGE_KEY = 'switch-library-preferences';

const DEFAULT_PREFERENCES: UserPreferences = {
  searchRegions: ['US'],
  library: {
    filterPlatform: 'all',
    filterFormat: 'all',
    filterCompleted: 'all',
    sortBy: 'added_newest',
    viewMode: 'grid',
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

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  };

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  return {
    preferences,
    updatePreferences,
    resetPreferences,
  };
}
