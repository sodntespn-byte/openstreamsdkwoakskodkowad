'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

type CinemaPhase = 'closed' | 'loading' | 'entering' | 'playing' | 'exiting';

interface WatchCinemaExperienceProps {
  open: boolean;
  onClose: () => void;
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  imdbId?: string | null;
  season?: number;
  episode?: number;
  title: string;
  showEpisodeNav?: boolean;
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  episodeLabel?: string;
}

export function WatchCinemaExperience({
  open,
  onClose,
  mediaType,
  tmdbId,
  imdbId,
  season,
  episode,
  title,
  showEpisodeNav,
  hasPrevEpisode,
  hasNextEpisode,
  onPrevEpisode,
  onNextEpisode,
  episodeLabel,
}: WatchCinemaExperienceProps) {
  const [phase, setPhase] = useState<CinemaPhase>('closed');

  const close = useCallback(() => {
    setPhase('exiting');
    window.setTimeout(() => {
      setPhase('closed');
      onClose();
    }, 650);
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setPhase('closed');
      document.documentElement.classList.remove('watch-cinema-active');
      return;
    }
    setPhase('loading');
    document.documentElement.classList.add('watch-cinema-active');
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.classList.remove('watch-cinema-active');
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const handlePlayerReady = useCallback(() => {
    setPhase((p) => (p === 'exiting' || p === 'closed' ? p : 'entering'));
    window.setTimeout(() => {
      setPhase((p) => (p === 'entering' ? 'playing' : p));
    }, 900);
  }, []);

  useEffect(() => {
    if (!open || phase !== 'loading') return;
    const fallback = window.setTimeout(() => {
      setPhase((p) => (p === 'loading' ? 'entering' : p));
      window.setTimeout(() => {
        setPhase((p) => (p === 'entering' ? 'playing' : p));
      }, 900);
    }, 12_000);
    return () => window.clearTimeout(fallback);
  }, [open, phase]);

  if (!open && phase === 'closed') return null;

  const isVisible = phase !== 'closed';

  return (
    <div
      className={cn(
        'watch-cinema-root fixed inset-0 z-[200]',
        phase === 'exiting' && 'watch-cinema-root--exit',
        !isVisible && 'pointer-events-none opacity-0'
      )}
      role="dialog"
      aria-modal="true"
      aria-label={`A reproduzir ${title}`}
    >
      <div
        className={cn(
          'watch-cinema-backdrop absolute inset-0 bg-black/90 backdrop-blur-2xl transition-opacity duration-700',
          (phase === 'entering' || phase === 'playing') && 'opacity-100',
          phase === 'loading' && 'opacity-80',
          phase === 'exiting' && 'opacity-0'
        )}
      />

      <div
        className={cn(
          'watch-cinema-glow absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-primary)]',
          phase === 'entering' && 'watch-cinema-glow--in',
          phase === 'playing' && 'watch-cinema-glow--hold',
          phase === 'exiting' && 'watch-cinema-glow--out'
        )}
        aria-hidden
      />

      <button
        type="button"
        onClick={close}
        className={cn(
          'absolute right-4 top-[calc(var(--safe-top)+1rem)] z-[220] flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 transition hover:bg-black/80',
          (phase === 'playing' || phase === 'entering') && 'opacity-100',
          phase === 'loading' && 'opacity-70'
        )}
        aria-label="Sair do player"
      >
        <X size={22} />
      </button>

      <div
        className={cn(
          'watch-cinema-player-wrap absolute inset-0 flex items-center justify-center p-4 md:p-8',
          phase === 'loading' && 'watch-cinema-player-wrap--load',
          phase === 'entering' && 'watch-cinema-player-wrap--in',
          phase === 'playing' && 'watch-cinema-player-wrap--play',
          phase === 'exiting' && 'watch-cinema-player-wrap--out'
        )}
      >
        <div className="relative h-full w-full max-h-full max-w-[100vw] aspect-video shadow-[0_0_80px_rgba(250,204,21,0.35)]">
          <VideoPlayer
            mediaType={mediaType}
            tmdbId={tmdbId}
            imdbId={imdbId}
            season={season}
            episode={episode}
            title={title}
            className="h-full w-full rounded-lg md:rounded-xl overflow-hidden"
            onReady={handlePlayerReady}
            defaultMode="proxy"
          />
        </div>
      </div>

      {showEpisodeNav && (phase === 'playing' || phase === 'entering') && (
        <div className="absolute bottom-6 left-1/2 z-[220] flex -translate-x-1/2 flex-wrap items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onPrevEpisode}
            disabled={!hasPrevEpisode}
            className="bg-black/50"
          >
            <ChevronLeft size={18} />
            Anterior
          </Button>
          {episodeLabel && (
            <span className="rounded bg-black/60 px-3 py-1 text-sm text-white">{episodeLabel}</span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={onNextEpisode}
            disabled={!hasNextEpisode}
            className="bg-black/50"
          >
            Próximo
            <ChevronRight size={18} />
          </Button>
        </div>
      )}
    </div>
  );
}
