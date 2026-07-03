'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';
import type { User } from '@/types/user';

function mapApiUser(raw: Record<string, unknown>): User {
  return {
    id: Number(raw.id),
    email: String(raw.email),
    name: String(raw.name),
    isAdmin: Boolean(raw.isAdmin),
    status: raw.status != null ? String(raw.status) : undefined,
    createdAt: raw.createdAt != null ? String(raw.createdAt) : undefined,
    avatarUrl: raw.avatarUrl != null ? String(raw.avatarUrl) : null,
    theme:
      raw.theme === 'light' || raw.theme === 'frutiger' || raw.theme === 'dark'
        ? raw.theme
        : 'dark',
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (
    payload:
      | string
      | {
          name?: string;
          avatar_url?: string;
          theme?: User['theme'];
          email?: string;
          currentPassword?: string;
        }
  ) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load auth state from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEYS.token);
    const savedUser = localStorage.getItem(STORAGE_KEYS.user);

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Error parsing saved user:', e);
        localStorage.removeItem(STORAGE_KEYS.token);
        localStorage.removeItem(STORAGE_KEYS.user);
      }
    }
    setIsLoading(false);
  }, []);

  // Sincronizar avatar e dados da conta com o servidor (ex.: foto guardada noutro dispositivo)
  useEffect(() => {
    if (!token || isLoading) return;
    void (async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = (await response.json()) as Record<string, unknown>;
        const fresh = mapApiUser(data);
        setUser(fresh);
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(fresh));
      } catch {
        /* manter cache local */
      }
    })();
  }, [token, isLoading]);

  const saveAuth = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(STORAGE_KEYS.token, newToken);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(newUser));
  }, []);

  const clearAuth = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const retry = typeof data.retryAfter === 'number' ? data.retryAfter : null;
      const base = typeof data.error === 'string' ? data.error : 'Erro ao fazer login';
      throw new Error(retry != null ? `${base} Aguarde ${retry}s.` : base);
    }

    saveAuth(data.token as string, mapApiUser(data.user as Record<string, unknown>));
  };

  const register = async (email: string, password: string, name?: string) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const retry = typeof data.retryAfter === 'number' ? data.retryAfter : null;
      const base = typeof data.error === 'string' ? data.error : 'Erro ao criar conta';
      throw new Error(retry != null ? `${base} Aguarde ${retry}s.` : base);
    }

    saveAuth(data.token as string, mapApiUser(data.user as Record<string, unknown>));
  };

  const logout = async () => {
    // Clear cookie on server
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Error clearing auth cookie:', error);
    }
    clearAuth();
  };

  const updateProfile = async (
    payload:
      | string
      | {
          name?: string;
          avatar_url?: string;
          theme?: User['theme'];
          email?: string;
          currentPassword?: string;
        }
  ) => {
    if (!token) throw new Error('Não autenticado');

    const body = typeof payload === 'string' ? { name: payload } : payload;

    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao atualizar perfil');
    }

    const updatedUser = mapApiUser(data.user as Record<string, unknown>);
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updatedUser));
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!token) throw new Error('Não autenticado');
    const response = await fetch('/api/auth/password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao alterar senha');
    }
  };

  const refreshUser = async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const updatedUser = mapApiUser(data as Record<string, unknown>);
        setUser(updatedUser);
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updatedUser));
      } else {
        // Token inválido, fazer logout
        clearAuth();
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}