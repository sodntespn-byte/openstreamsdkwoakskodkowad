'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { tmdb } from '@/services/tmdb';
import { HeroSection, SkeletonHero } from '@/components/content/HeroSection';
import { CategoryRow, SkeletonRow } from '@/components/content/CategoryRow';
import { ContinueWatchingRow } from '@/components/content/ContinueWatchingRow';
import { VirtualPcPromo } from '@/components/hyperbeam/VirtualPcPromo';
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

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/welcome');
      return;
    }
    loadHomeData();
  }, [authLoading, isAuthenticated, router, loadHomeData]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[var(--bg-primary)] px-4">
        <div className="loading-spinner" aria-hidden />
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          {!authLoading ? 'A redirecionar…' : 'A carregar…'}
        </p>
      </div>
    );
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
          <VirtualPcPromo />
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
