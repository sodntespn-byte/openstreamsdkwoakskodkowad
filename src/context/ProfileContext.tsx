'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { STORAGE_KEYS } from '@/lib/constants';
import type { SerializedViewerProfile } from '@/lib/viewerProfileUtils';

interface ProfileContextValue {
  profiles: SerializedViewerProfile[];
  activeProfile: SerializedViewerProfile | null;
  activeProfileId: number | null;
  isLoading: boolean;
  isHydrated: boolean;
  refreshProfiles: () => Promise<void>;
  selectProfile: (profileId: number) => void;
  clearActiveProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

function readStoredProfileId(userId: number): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.activeProfile);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: number; profileId?: number };
    if (parsed.userId !== userId || typeof parsed.profileId !== 'number') return null;
    return parsed.profileId;
  } catch {
    return null;
  }
}

function writeStoredProfileId(userId: number, profileId: number | null) {
  if (typeof window === 'undefined') return;
  if (profileId === null) {
    localStorage.removeItem(STORAGE_KEYS.activeProfile);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.activeProfile, JSON.stringify({ userId, profileId }));
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, token, isLoading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<SerializedViewerProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const refreshProfiles = useCallback(async () => {
    if (!token) {
      setProfiles([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/profiles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setProfiles([]);
        return;
      }
      const data = await res.json();
      const list = (data.profiles || []) as SerializedViewerProfile[];
      setProfiles(list);

      if (user) {
        const stored = readStoredProfileId(user.id);
        const valid = stored && list.some((p) => p.id === stored);
        if (stored && !valid) {
          writeStoredProfileId(user.id, null);
          setActiveProfileId(null);
        } else if (stored && valid) {
          setActiveProfileId(stored);
        }
      }
    } catch {
      setProfiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (!user || !token) {
      setProfiles([]);
      setActiveProfileId(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.activeProfile);
      }
      return;
    }
    const stored = readStoredProfileId(user.id);
    setActiveProfileId(stored);
    void refreshProfiles();
  }, [user, token, refreshProfiles]);

  const selectProfile = useCallback(
    (profileId: number) => {
      if (!user) return;
      setActiveProfileId(profileId);
      writeStoredProfileId(user.id, profileId);
    },
    [user]
  );

  const clearActiveProfile = useCallback(() => {
    setActiveProfileId(null);
    if (user) writeStoredProfileId(user.id, null);
  }, [user]);

  const activeProfile = useMemo(() => {
    if (activeProfileId == null) return null;
    return profiles.find((p) => p.id === activeProfileId) || null;
  }, [profiles, activeProfileId]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profiles,
      activeProfile,
      activeProfileId,
      isLoading: authLoading || isLoading,
      isHydrated,
      refreshProfiles,
      selectProfile,
      clearActiveProfile,
    }),
    [
      profiles,
      activeProfile,
      activeProfileId,
      authLoading,
      isLoading,
      isHydrated,
      refreshProfiles,
      selectProfile,
      clearActiveProfile,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
