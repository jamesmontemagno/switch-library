import { createContext } from 'react';
import type { AuthState } from '../types';

export interface AuthContextType extends AuthState {
  login: () => void | Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  logout: () => void | Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
