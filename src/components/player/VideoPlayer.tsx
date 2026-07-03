'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { superflixApi } from '@/services/tmdb';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle, Maximize, Minimize, ExternalLink } from 'lucide-react';

type PlayerMode = 'proxy' | 'direct';

interface VideoPlayerProps {
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  imdbId?: string | null;
  season?: number;
  episode?: number;
  title?: string;
  onProgress?: (progress: number) => void;
  onEnded?: () => void;
  /** Chamado quando o iframe carrega com sucesso (uma vez por URL). */
  onReady?: () => void;
  /** Modo inicial: proxy evita erros de sandbox/cookies em iframe cross-origin. */
  defaultMode?: PlayerMode;
  className?: string;
}

function isProxyErrorPage(doc: Document | null | undefined): boolean {
  if (!doc?.body) return false;
  const text = doc.body.innerText?.trim() ?? '';
  if (text.startsWith('{') && text.includes('"error"')) return true;
  const p = doc.body.querySelector('p')?.textContent?.trim() ?? '';
  return (
    p.includes('Origem não autorizada') ||
    p.includes('Não foi possível contactar') ||
    p.includes('Erro interno do proxy')
  );
}

function isCloudflareCaptchaPage(doc: Document | null | undefined): boolean {
  if (!doc?.body) return false;
  const text = doc.body.innerText?.toLowerCase() ?? '';
  return (
    text.includes('validação segura') ||
    text.includes('confirme que você é humano') ||
    text.includes('protegido por cloudflare') ||
    text.includes('captcha') ||
    doc.body.querySelector('.captcha-box') !== null ||
    doc.body.querySelector('#cf-turnstile-form') !== null
  );
}

export function VideoPlayer({
  mediaType,
  tmdbId,
  imdbId,
  season,
  episode,
  title,
  className,
  onReady,
}: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mode, setMode] = useState<PlayerMode>('direct');
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyFiredRef = useRef(false);

  const movieId = mediaType === 'movie' ? imdbId || null : null;
  const canPlayMovie = mediaType !== 'movie' || !!movieId;

  const buildUrls = useCallback(
    (playerMode: PlayerMode) => {
      const id = mediaType === 'movie' ? movieId! : String(tmdbId);
      const direct = superflixApi.getDirectUrl(mediaType, id, season, episode);
      if (playerMode === 'proxy') {
        return superflixApi.getPlayerUrl(mediaType, id, season, episode, true);
      }
      return direct;
    },
    [mediaType, movieId, tmdbId, season, episode]
  );

  const playerUrl = canPlayMovie ? buildUrls(mode) : '';

  const clearLoadTimeout = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  };

  const scheduleLoadTimeout = useCallback(() => {
    clearLoadTimeout();
    loadTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setError('O player demorou a carregar. Tente recarregar ou abrir numa nova aba.');
    }, 25_000);
  }, []);

  const directUrl = canPlayMovie ? buildUrls('direct') : '';

  useEffect(() => {
    setError(null);
    setIsLoading(true);
    readyFiredRef.current = false;
  }, [mediaType, tmdbId, imdbId, season, episode]);

  useEffect(() => {
    if (!canPlayMovie) {
      setIsLoading(false);
      setError(
        mediaType === 'movie'
          ? 'IMDb ID indisponível para este filme — reprodução não suportada.'
          : null
      );
      return;
    }
    setIsLoading(true);
    setError(null);
    scheduleLoadTimeout();
    return clearLoadTimeout;
  }, [playerUrl, canPlayMovie, mediaType, scheduleLoadTimeout]);

  const handleLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (mode === 'proxy' && isProxyErrorPage(doc)) {
      clearLoadTimeout();
      setIsLoading(false);
      setError(
        doc?.body?.querySelector('p')?.textContent?.trim() ||
          'Não foi possível carregar o player via proxy.'
      );
      return;
    }

    if (mode === 'proxy' && isCloudflareCaptchaPage(doc)) {
      clearLoadTimeout();
      // Mudar para modo direto quando proxy falha com Cloudflare
      setMode('direct');
      setError(
        'A SuperflixAPI está protegida por Cloudflare. Tentando abrir diretamente...'
      );
      return;
    }

    clearLoadTimeout();
    setIsLoading(false);
    setError(null);
    if (!readyFiredRef.current) {
      readyFiredRef.current = true;
      onReady?.();
    }
  };

  const handleError = () => {
    clearLoadTimeout();
    setIsLoading(false);
    setError('Erro ao carregar o player. Tente recarregar ou abrir numa nova aba.');
  };

  const retry = () => {
    clearLoadTimeout();
    setError(null);
    setIsLoading(true);
    readyFiredRef.current = false;
    if (iframeRef.current && playerUrl) iframeRef.current.src = playerUrl;
    scheduleLoadTimeout();
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
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-black aspect-video w-full',
        isFullscreen && 'fixed inset-0 z-50',
        className
      )}
    >
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[var(--accent-primary)] animate-spin mx-auto mb-4" />
            <p className="text-white">Carregando player…</p>
            <p className="text-white/50 text-sm mt-2">Via proxy seguro</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="text-center px-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-white mb-4">{error}</p>
            {canPlayMovie && (
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => retry()}
                  className="px-4 py-2 bg-[var(--accent-primary)] text-black rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Recarregar
                </button>
                {directUrl && (
                  <a
                    href={directUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
                  >
                    <ExternalLink size={16} />
                    Abrir numa nova aba
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {canPlayMovie && playerUrl && (
        <iframe
          key={`${mode}-${playerUrl}`}
          ref={iframeRef}
          src={playerUrl}
          title={title || 'Player'}
          className={cn('absolute inset-0 w-full h-full border-0', (isLoading || error) && 'invisible')}
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute bottom-4 right-4 p-2 bg-black/50 rounded-lg text-white hover:bg-black/70 transition-colors z-20"
        aria-label={isFullscreen ? 'Sair do modo tela cheia' : 'Tela cheia'}
      >
        {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
      </button>

      {title && !isLoading && !error && (
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent opacity-0 hover:opacity-100 transition-opacity z-10 pointer-events-none">
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
