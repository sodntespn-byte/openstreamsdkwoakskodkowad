'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';

export type ThemeId = 'dark' | 'light' | 'frutiger';

interface ThemeContextType {
  theme: ThemeId;
  toggleTheme: () => void;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeId>('dark');
  const [mounted, setMounted] = useState(false);

  const applyDom = useCallback((t: ThemeId) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(STORAGE_KEYS.theme, t);
  }, []);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) as ThemeId;
    if (savedTheme && ['dark', 'light', 'frutiger'].includes(savedTheme)) {
      setThemeState(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const defaultTheme: ThemeId = prefersDark ? 'dark' : 'light';
      setThemeState(defaultTheme);
      document.documentElement.setAttribute('data-theme', defaultTheme);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const t = user?.theme as ThemeId | undefined;
    if (t && ['dark', 'light', 'frutiger'].includes(t)) {
      setThemeState(t);
      applyDom(t);
    }
  }, [mounted, user?.theme, user?.id, applyDom]);

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
    applyDom(newTheme);
  };

  const toggleTheme = () => {
    const order: ThemeId[] = ['dark', 'light', 'frutiger'];
    const i = order.indexOf(theme);
    const next = order[(i + 1) % order.length];
    setTheme(next);
  };

  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: () => {}, setTheme: () => {} }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
