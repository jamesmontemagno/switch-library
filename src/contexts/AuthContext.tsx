import { useReducer, useEffect, type ReactNode } from 'react';
import type { User, AuthState } from '../types';
import { AuthContext } from './AuthContextType';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { logger } from '../services/logger';

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
      logger.setUser(action.payload.id);
      logger.auth('User logged in', { userId: action.payload.id, login: action.payload.login });
      return {
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGIN_ERROR':
      logger.setUser(null);
      logger.auth('Login failed or user logged out');
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'LOGOUT':
      logger.setUser(null);
      logger.auth('User logged out');
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
async function mapSupabaseUser(supabaseUser: { id: string; email?: string; user_metadata?: Record<string, unknown>; created_at?: string }): Promise<User> {
  const metadata = supabaseUser.user_metadata || {};
  const email = supabaseUser.email || '';
  
  // Don't fetch account_level here - it's only needed on the admin page
  // The useIsAdmin hook will fetch it lazily when needed
  
  // For GitHub OAuth users
  if (metadata.provider_id) {
    return {
      id: supabaseUser.id,
      githubId: (metadata.provider_id as number) || 0,
      login: (metadata.user_name as string) || (metadata.preferred_username as string) || 'user',
      displayName: (metadata.full_name as string) || (metadata.name as string) || 'User',
      avatarUrl: (metadata.avatar_url as string) || '',
      email,
      // accountLevel will be fetched lazily if needed (admin page only)
      createdAt: supabaseUser.created_at || new Date().toISOString(),
    };
  }
  
  // For email/password users
  const username = email.split('@')[0] || 'user';
  return {
    id: supabaseUser.id,
    login: username,
    displayName: (metadata.display_name as string) || username,
    avatarUrl: '',
    email,
    // accountLevel will be fetched lazily if needed (admin page only)
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
            const user = await mapSupabaseUser(session.user);
            dispatch({ type: 'LOGIN_SUCCESS', payload: user });
          } else {
            dispatch({ type: 'LOGIN_ERROR' });
          }
        } catch (error) {
          console.error('Failed to check Supabase auth:', error);
          logger.error('Failed to check Supabase auth', error);
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
          logger.error('Failed to check localStorage auth', error);
          dispatch({ type: 'LOGIN_ERROR' });
        }
      }
    };

    checkAuth();

    // Listen for auth state changes (Supabase)
    if (useSupabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const user = await mapSupabaseUser(session.user);
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
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
      dispatch({ type: 'LOGIN_SUCCESS', payload: mockUser });
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    if (useSupabase) {
      dispatch({ type: 'LOGIN_START' });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Email login error:', error);
        dispatch({ type: 'LOGIN_ERROR' });
        return { error };
      }
      if (data.user) {
        try {
          const user = await mapSupabaseUser(data.user);
          dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        } catch (mappingError) {
          console.error('User mapping error:', mappingError);
          dispatch({ type: 'LOGIN_ERROR' });
          return { error: new Error('Failed to process user data') };
        }
      }
      return { error: null };
    } else {
      // Demo mode
      console.warn('Supabase not configured. Using demo mode.');
      const username = email.split('@')[0];
      const mockUser: User = {
        id: 'demo-user-' + Date.now(),
        login: username,
        displayName: username,
        avatarUrl: '',
        email,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
      dispatch({ type: 'LOGIN_SUCCESS', payload: mockUser });
      return { error: null };
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    if (useSupabase) {
      dispatch({ type: 'LOGIN_START' });
      const username = email.split('@')[0];
      const finalDisplayName = displayName?.trim() || username;
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            display_name: finalDisplayName,
          },
        },
      });
      if (error) {
        console.error('Email signup error:', error);
        dispatch({ type: 'LOGIN_ERROR' });
        return { error };
      }
      
      // Check if email confirmation is required
      // If session is null but user exists, email confirmation is needed
      if (data.user && !data.session) {
        dispatch({ type: 'LOGIN_ERROR' });
        return { error: null, needsConfirmation: true };
      }
      
      if (data.user) {
        try {
          // User is authenticated immediately (email confirmation disabled)
          const user = await mapSupabaseUser(data.user);
          dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        } catch (mappingError) {
          console.error('User mapping error:', mappingError);
          dispatch({ type: 'LOGIN_ERROR' });
          return { error: new Error('Failed to process user data') };
        }
      }
      return { error: null, needsConfirmation: false };
    } else {
      // Demo mode
      console.warn('Supabase not configured. Using demo mode.');
      const username = email.split('@')[0];
      const finalDisplayName = displayName?.trim() || username;
      const mockUser: User = {
        id: 'demo-user-' + Date.now(),
        login: username,
        displayName: finalDisplayName,
        avatarUrl: '',
        email,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
      dispatch({ type: 'LOGIN_SUCCESS', payload: mockUser });
      return { error: null, needsConfirmation: false };
    }
  };

  const resetPassword = async (email: string) => {
    if (useSupabase) {
      const redirectTo = new URL('/auth?reset=true', window.location.origin).href;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        console.error('Password reset error:', error);
        return { error };
      }
      return { error: null };
    } else {
      console.warn('Supabase not configured. Using demo mode.');
      return { error: null };
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
    <AuthContext.Provider value={{ ...state, login, loginWithEmail, signUpWithEmail, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
