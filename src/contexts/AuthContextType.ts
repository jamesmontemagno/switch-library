import { createContext } from 'react';
import type { AuthState } from '../types';

export interface AuthContextType extends AuthState {
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
