import { useReducer, useEffect, type ReactNode } from 'react';
import type { User, AuthState } from '../types';
import { AuthContext } from './AuthContextType';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const STORAGE_KEY = 'switch-library-auth';

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_ERROR' }
  | { type: 'LOGOUT' };

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true };
    case 'LOGIN_SUCCESS':
      return {
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGIN_ERROR':
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };
    default:
      return state;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

// Map Supabase user to our User type
function mapSupabaseUser(supabaseUser: { id: string; user_metadata?: Record<string, unknown>; created_at?: string }): User {
  const metadata = supabaseUser.user_metadata || {};
  return {
    id: supabaseUser.id,
    githubId: (metadata.provider_id as number) || 0,
    login: (metadata.user_name as string) || (metadata.preferred_username as string) || 'user',
    displayName: (metadata.full_name as string) || (metadata.name as string) || 'User',
    avatarUrl: (metadata.avatar_url as string) || 'https://github.com/identicons/user.png',
    createdAt: supabaseUser.created_at || new Date().toISOString(),
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const useSupabase = isSupabaseConfigured();

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (useSupabase) {
        // Check Supabase session
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const user = mapSupabaseUser(session.user);
            dispatch({ type: 'LOGIN_SUCCESS', payload: user });
          } else {
            dispatch({ type: 'LOGIN_ERROR' });
          }
        } catch (error) {
          console.error('Failed to check Supabase auth:', error);
          dispatch({ type: 'LOGIN_ERROR' });
        }
      } else {
        // Fallback to localStorage
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const user = JSON.parse(stored) as User;
            dispatch({ type: 'LOGIN_SUCCESS', payload: user });
          } else {
            dispatch({ type: 'LOGIN_ERROR' });
          }
        } catch (error) {
          console.error('Failed to check auth:', error);
          dispatch({ type: 'LOGIN_ERROR' });
        }
      }
    };

    checkAuth();

    // Listen for auth state changes (Supabase)
    if (useSupabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const user = mapSupabaseUser(session.user);
          dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        } else {
          dispatch({ type: 'LOGOUT' });
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [useSupabase]);

  const login = async () => {
    if (useSupabase) {
      // Use Supabase GitHub OAuth
      dispatch({ type: 'LOGIN_START' });
      // Build redirect URL properly to avoid malformed URLs
      const baseUrl = import.meta.env.BASE_URL || '/';
      const redirectTo = new URL(baseUrl, window.location.origin).href;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo,
        },
      });
      if (error) {
        console.error('Supabase OAuth error:', error);
        dispatch({ type: 'LOGIN_ERROR' });
      }
    } else {
      // Demo mode: Create a mock user for testing
      console.warn('Supabase not configured. Using demo mode.');
      const mockUser: User = {
        id: 'demo-user-' + Date.now(),
        githubId: 12345678,
        login: 'demo-user',
        displayName: 'Demo User',
        avatarUrl: 'https://github.com/identicons/demo-user.png',
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
      dispatch({ type: 'LOGIN_SUCCESS', payload: mockUser });
    }
  };

  const logout = async () => {
    if (useSupabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
