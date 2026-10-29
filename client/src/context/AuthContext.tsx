import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { ApiService } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isSetupCompleted: boolean;
  homeKeyVerified: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyHomeKey: (key: string) => Promise<boolean>;
  setSetupCompletedStatus: (completed: boolean) => void;
  favorites: string[];
  toggleFavorite: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSetupCompleted, setIsSetupCompleted] = useState(false);
  const [homeKeyVerified, setHomeKeyVerified] = useState(() => {
    return localStorage.getItem('dominatee_home_key_verified') === 'true';
  });
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    checkInitialState();
  }, []);

  const checkInitialState = async () => {
    try {
      const res = await ApiService.getBootstrap();
      setIsSetupCompleted(res.config.setup_completed === 1);
      if (res.user) {
        setUser(res.user);
        try {
          setFavorites(JSON.parse(res.user.favorites_json || '[]'));
        } catch (_) {
          setFavorites([]);
        }
      }
      if (!res.config.require_home_key) {
        setHomeKeyVerified(true);
      }
    } catch (err) {
      console.warn('[Auth] Check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, pass: string) => {
    const res = await ApiService.login(email, pass);
    setUser(res.user);
    try {
      setFavorites(JSON.parse(res.user.favorites_json || '[]'));
    } catch (_) {
      setFavorites([]);
    }
  };

  const register = async (name: string, email: string, pass: string, phone?: string) => {
    const res = await ApiService.register(name, email, pass, phone);
    setUser(res.user);
  };

  const logout = async () => {
    await ApiService.logout();
    setUser(null);
  };

  const verifyHomeKey = async (key: string): Promise<boolean> => {
    const res = await ApiService.verifyHomeKey(key);
    if (res.valid) {
      setHomeKeyVerified(true);
      localStorage.setItem('dominatee_home_key_verified', 'true');
      return true;
    }
    return false;
  };

  const setSetupCompletedStatus = (completed: boolean) => {
    setIsSetupCompleted(completed);
  };

  const toggleFavorite = async (id: string) => {
    const next = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
    setFavorites(next);
    try {
      await fetch('/api/auth/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorites: next }),
      });
    } catch (_) { }
  };

  const isFavorite = (id: string) => favorites.includes(id);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin: user?.role === 'admin',
        isSetupCompleted,
        homeKeyVerified,
        login,
        register,
        logout,
        verifyHomeKey,
        setSetupCompletedStatus,
        favorites,
        toggleFavorite,
        isFavorite,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
