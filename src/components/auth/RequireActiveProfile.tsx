'use client';

import { useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';

/**
 * Utilizadores autenticados precisam de um perfil ativo para ver o conteúdo principal.
 */
export function RequireActiveProfile({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { activeProfileId, isHydrated } = useProfile();

  useLayoutEffect(() => {
    if (!isHydrated || authLoading) return;
    if (isAuthenticated && activeProfileId == null) {
      router.replace('/profiles');
    }
  }, [isHydrated, authLoading, isAuthenticated, activeProfileId, router]);

  /** Visitantes: mostrar já a landing / marketing sem esperar hidratação do perfil. */
  if (!authLoading && !isAuthenticated) {
    return <>{children}</>;
  }

  if (!isHydrated || authLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
        <div className="loading-spinner" aria-hidden />
        <p className="text-sm text-[var(--text-secondary)]">A carregar…</p>
      </div>
    );
  }

  if (activeProfileId == null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
        <div className="loading-spinner" aria-hidden />
        <p className="text-sm text-[var(--text-secondary)]">A abrir perfis…</p>
      </div>
    );
  }

  return <>{children}</>;
}
