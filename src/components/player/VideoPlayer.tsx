'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  buildBackendDirectUrl,
  loadPlayerPrefs,
  pickBackend,
  PLAYER_BACKEND_LABELS,
  rankBackendsForViewer,
  savePlayerPrefs,
  wrapEmbedProxy,
  type PlayerBackendId,
  type PlayerPrefs,
} from '@/lib/playerProviders';
import { getViewerPrimaryLanguage } from '@/lib/playerLocale';
import { Loader2, AlertCircle, Maximize, Minimize } from 'lucide-react';

interface VideoPlayerProps {
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  imdbId?: string | null;
  season?: number;
  episode?: number;
  title?: string;
  onProgress?: (progress: number) => void;
  onEnded?: () => void;
  className?: string;
}

export function VideoPlayer({
  mediaType,
  tmdbId,
  imdbId,
  season,
  episode,
  title,
  onProgress: _onProgress,
  onEnded: _onEnded,
  className,
}: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useProxy, setUseProxy] = useState(true);
  const [prefs, setPrefs] = useState<PlayerPrefs>({ mode: 'auto' });
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setPrefs(loadPlayerPrefs());
  }, []);

  const primaryLang = useMemo(() => getViewerPrimaryLanguage(), []);

  const rankedBackends = useMemo(() => rankBackendsForViewer(), [primaryLang]);

  const activeBackend: PlayerBackendId = useMemo(() => pickBackend(prefs), [prefs]);

  const directUrl = useMemo(
    () =>
      buildBackendDirectUrl(activeBackend, {
        mediaType,
        tmdbId,
        imdbId,
        season,
        episode,
      }),
    [activeBackend, mediaType, tmdbId, imdbId, season, episode]
  );

  const playerUrl = useMemo(() => {
    if (useProxy) return wrapEmbedProxy(directUrl, primaryLang);
    return directUrl;
  }, [directUrl, useProxy, primaryLang]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
  }, [playerUrl]);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setError('Erro ao carregar o player. Tente novamente.');
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const setModeAuto = () => {
    const next: PlayerPrefs = { mode: 'auto' };
    setPrefs(next);
    savePlayerPrefs(next);
  };

  const setModeManual = (b: PlayerBackendId) => {
    const next: PlayerPrefs = { mode: 'manual', manualProvider: b };
    setPrefs(next);
    savePlayerPrefs(next);
  };

  const autoFirstLabel = PLAYER_BACKEND_LABELS[rankedBackends[0]];

  const suggestedOrder = rankedBackends.map((id) => PLAYER_BACKEND_LABELS[id]).join(' → ');

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-black aspect-video w-full',
        isFullscreen && 'fixed inset-0 z-50',
        className
      )}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-[1]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[var(--accent-primary)] animate-spin mx-auto mb-4" />
            <p className="text-white">Carregando player...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-[2]">
          <div className="text-center px-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-white mb-4">{error}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  setUseProxy(!useProxy);
                }}
                className="px-4 py-2 bg-[var(--accent-primary)] text-black rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
              >
                {useProxy ? 'Tentar sem proxy' : 'Tentar com proxy'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  if (iframeRef.current) {
                    iframeRef.current.src = playerUrl;
                  }
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
              >
                Recarregar
              </button>
            </div>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={playerUrl}
        className={cn(
          'absolute inset-0 w-full h-full',
          (isLoading || error) && 'invisible'
        )}
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        onLoad={handleLoad}
        onError={handleError}
        title={title ? `Player: ${title}` : 'Reprodutor de vídeo'}
      />

      <div className="absolute bottom-14 left-3 right-14 z-10 flex flex-wrap items-center gap-2 sm:gap-3 rounded-lg bg-black/55 px-2 py-1.5 text-xs sm:text-sm text-white/95 backdrop-blur-sm border border-white/10">
        <label className="flex items-center gap-1.5 shrink-0">
          <span className="text-white/70 hidden sm:inline">Fonte</span>
          <select
            value={prefs.mode === 'manual' && prefs.manualProvider ? prefs.manualProvider : 'auto'}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'auto') setModeAuto();
              else setModeManual(v as PlayerBackendId);
            }}
            className="max-w-[11rem] sm:max-w-none rounded-md border border-white/20 bg-black/80 px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
          >
            <option value="auto">Automático ({autoFirstLabel})</option>
            <option value="superflix">{PLAYER_BACKEND_LABELS.superflix}</option>
            <option value="111movies">{PLAYER_BACKEND_LABELS['111movies']}</option>
            <option value="warezcdn">{PLAYER_BACKEND_LABELS.warezcdn}</option>
          </select>
        </label>
        <span className="text-white/50 hidden md:inline truncate max-w-[min(28rem,45vw)]" title={suggestedOrder}>
          Ordem sugerida: {suggestedOrder}
        </span>
      </div>

      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute bottom-4 right-4 p-2 bg-black/50 rounded-lg text-white hover:bg-black/70 transition-colors z-10"
        aria-label={isFullscreen ? 'Sair do modo tela cheia' : 'Tela cheia'}
      >
        {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
      </button>

      {title && !isLoading && !error && (
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          <h2 className="text-white font-semibold">
            {title}
            {mediaType === 'tv' && season && episode && (
              <span className="text-gray-300 font-normal ml-2">
                S{season}:E{episode}
              </span>
            )}
          </h2>
        </div>
      )}
    </div>
  );
}
