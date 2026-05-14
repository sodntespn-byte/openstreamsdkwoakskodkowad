'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { STORAGE_KEYS } from '@/lib/constants';
import { tmdb } from '@/services/tmdb';
import { LandingPage } from '@/components/landing/LandingPage';
import { HeroSection, SkeletonHero } from '@/components/content/HeroSection';
import { CategoryRow, SkeletonRow } from '@/components/content/CategoryRow';
import { ContinueWatchingRow } from '@/components/content/ContinueWatchingRow';
import type { Content } from '@/types/content';

interface HomeData {
  trending: Content[];
  popularMovies: Content[];
  popularTv: Content[];
  topRatedMovies: Content[];
  topRatedTv: Content[];
  upcoming: Content[];
  anime: Content[];
}

function hasStoredToken(): boolean {
  try {
    return typeof window !== 'undefined' && !!localStorage.getItem(STORAGE_KEYS.token);
  } catch {
    return false;
  }
}

/**
 * Catálogo (logado) ou landing (visitante). `ssr: false` no `page.tsx` evita HTML
 * vazio no deploy e leitura imediata do token no cliente (Square Cloud / SPA).
 */
export default function HomeClient() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [preferGuest, setPreferGuest] = useState(() => !hasStoredToken());
  const [data, setData] = useState<HomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      setPreferGuest(!isAuthenticated);
    }
  }, [authLoading, isAuthenticated]);

  const loadHomeData = useCallback(async () => {
    try {
      const [
        trendingRes,
        popularMoviesRes,
        popularTvRes,
        topRatedMoviesRes,
        topRatedTvRes,
        upcomingRes,
        animeRes,
      ] = await Promise.all([
        tmdb.getTrending('all', 'week'),
        tmdb.getPopular('movie'),
        tmdb.getPopular('tv'),
        tmdb.getTopRated('movie'),
        tmdb.getTopRated('tv'),
        tmdb.getUpcoming(),
        tmdb.getAnime(),
      ]);

      setData({
        trending: trendingRes.results || [],
        popularMovies: popularMoviesRes.results || [],
        popularTv: popularTvRes.results || [],
        topRatedMovies: topRatedMoviesRes.results || [],
        topRatedTv: topRatedTvRes.results || [],
        upcoming: upcomingRes.results || [],
        anime: animeRes.results || [],
      });
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (preferGuest || authLoading) return;
    if (!isAuthenticated) return;
    void loadHomeData();
  }, [preferGuest, authLoading, isAuthenticated, loadHomeData]);

  if (preferGuest) {
    return <LandingPage />;
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[var(--bg-primary)] px-4">
        <div className="loading-spinner" aria-hidden />
        <p className="mt-4 text-sm text-[var(--text-secondary)]">A carregar…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <section className="scroll-mt-[var(--header-total)]">
          <SkeletonHero />
          <div className="relative z-10 -mt-24 space-y-2 pb-24">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <section className="scroll-mt-[var(--header-total)]">
        <HeroSection
          items={data?.trending.slice(0, 5)}
          autoRotate
          rotateInterval={8000}
        />

        <div className="relative z-10 -mt-24 space-y-2 pb-24">
          <ContinueWatchingRow />

          <CategoryRow
            title="Em Alta"
            items={data?.trending || []}
            showType
            href="/trending"
            variant="backdrop"
          />

          <CategoryRow
            title="Filmes Populares"
            items={data?.popularMovies || []}
            href="/movies"
          />

          <CategoryRow
            title="Séries Populares"
            items={data?.popularTv || []}
            href="/series"
          />

          <CategoryRow
            title="Animes"
            items={data?.anime || []}
            href="/anime"
          />

          <CategoryRow
            title="Filmes Mais Votados"
            items={data?.topRatedMovies || []}
          />

          <CategoryRow
            title="Séries Mais Votadas"
            items={data?.topRatedTv || []}
          />

          <CategoryRow
            title="Em Breve"
            items={data?.upcoming || []}
            variant="backdrop"
          />
        </div>
      </section>
    </div>
  );
}
