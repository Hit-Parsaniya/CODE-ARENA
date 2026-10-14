import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, LoginPayload, SignupPayload } from '../types/auth';
import { api } from '../services/api';

export interface LoginResult {
  user: User;
  redirectPath: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  backendStatus: 'ok' | 'offline' | 'checking';
  login: (payload: LoginPayload) => Promise<LoginResult>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => void;
  refreshHealth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'aicode_token';
const USER_KEY = 'aicode_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [backendStatus, setBackendStatus] = useState<'ok' | 'offline' | 'checking'>('checking');

  const refreshHealth = async () => {
    try {
      const res = await api.checkHealth();
      setBackendStatus(res.status === 'ok' ? 'ok' : 'offline');
    } catch {
      setBackendStatus('offline');
    }
  };

  useEffect(() => {
    refreshHealth();
    const interval = setInterval(refreshHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        try {
          const profile = await api.getCurrentUser(storedToken);
          setUser(profile);
          setToken(storedToken);
          localStorage.setItem(USER_KEY, JSON.stringify(profile));
        } catch (err) {
          console.warn('Session expired or invalid token:', err);
          logout();
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (payload: LoginPayload): Promise<LoginResult> => {
    const data = await api.login(payload);
    const actualRole = (data.user.role === 'admin' || !!data.user.is_admin) ? 'admin' : 'user';
    const intendedRole = payload.intended_role || 'user';

    // If intended_role was "admin" but the account's actual role is "user" -> reject with inline error
    if (intendedRole === 'admin' && actualRole !== 'admin') {
      throw new Error('This account does not have admin access');
    }

    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));

    const redirectPath = (intendedRole === 'admin' && actualRole === 'admin')
      ? '/admin/dashboard'
      : '/dashboard';

    return { user: data.user, redirectPath };
  };

  const signup = async (payload: SignupPayload) => {
    const data = await api.signup(payload);
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isAdmin: !!user && (user.role === 'admin' || !!user.is_admin),
        isLoading,
        backendStatus,
        login,
        signup,
        logout,
        refreshHealth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
