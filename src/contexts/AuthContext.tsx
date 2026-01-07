import { useReducer, useEffect, type ReactNode } from 'react';
import type { User, AuthState } from '../types';
import { AuthContext } from './AuthContextType';

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

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const user = JSON.parse(stored) as User;
          dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        } else {
          dispatch({ type: 'LOGIN_ERROR' });
        }
      } catch {
        dispatch({ type: 'LOGIN_ERROR' });
      }
    };

    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    if (code) {
      // Handle OAuth callback - in production this would exchange the code for a token
      // For now, we'll clear the URL and check local storage
      window.history.replaceState({}, document.title, window.location.pathname);
      checkAuth();
    } else {
      checkAuth();
    }
  }, []);

  const login = () => {
    // GitHub OAuth configuration
    // In production, you would set up a GitHub OAuth App and use its client ID
    // The redirect URI should be your GitHub Pages URL
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    
    if (!clientId) {
      // Demo mode: Create a mock user for testing
      console.warn('GitHub OAuth not configured. Using demo mode.');
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
      return;
    }

    // Redirect to GitHub OAuth
    const redirectUri = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const scope = 'read:user';
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
    window.location.href = authUrl;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
