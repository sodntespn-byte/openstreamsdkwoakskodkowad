import { STORAGE_KEYS } from '@/lib/constants';
import {
  getViewerPrimaryLanguage,
  getViewerRegionHint,
  type ViewerRegionHint,
} from '@/lib/playerLocale';

/** Fontes de embed suportadas (cada uma com URL directa + proxy). */
export type PlayerBackendId = 'superflix' | '111movies' | 'warezcdn';

export interface PlayerPrefs {
  mode: 'auto' | 'manual';
  manualProvider?: PlayerBackendId;
}

const DEFAULT_PREFS: PlayerPrefs = { mode: 'auto' };

const ALL_BACKENDS: PlayerBackendId[] = ['superflix', '111movies', 'warezcdn'];

export function loadPlayerPrefs(): PlayerPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.playerPrefs);
    if (!raw) return DEFAULT_PREFS;
    const j = JSON.parse(raw) as Partial<PlayerPrefs>;
    if (j.mode !== 'auto' && j.mode !== 'manual') return DEFAULT_PREFS;
    if (j.mode === 'manual' && j.manualProvider && ALL_BACKENDS.includes(j.manualProvider)) {
      return { mode: 'manual', manualProvider: j.manualProvider };
    }
    if (j.mode === 'manual') return DEFAULT_PREFS;
    return { mode: 'auto' };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePlayerPrefs(p: PlayerPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.playerPrefs, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export const PLAYER_BACKEND_LABELS: Record<PlayerBackendId, string> = {
  superflix: 'SuperflixAPI',
  '111movies': '111movies',
  warezcdn: 'WarezCDN',
};

/** Pontuação heurística: catálogo BR (warezcdn), agregador regional (superflix), API global (111movies). */
function baseScores(region: ViewerRegionHint, primaryLang: string): Record<PlayerBackendId, number> {
  const lang = primaryLang.toLowerCase();
  let s: Record<PlayerBackendId, number> = {
    superflix: 50,
    '111movies': 50,
    warezcdn: 50,
  };

  if (region === 'brazil') {
    s = { warezcdn: s.warezcdn + 40, superflix: s.superflix + 28, '111movies': s['111movies'] + 6 };
  } else if (region === 'latam') {
    s = { warezcdn: s.warezcdn + 28, superflix: s.superflix + 26, '111movies': s['111movies'] + 12 };
  } else if (region === 'iberia') {
    s = { superflix: s.superflix + 22, warezcdn: s.warezcdn + 18, '111movies': s['111movies'] + 14 };
  } else if (region === 'us') {
    s = { '111movies': s['111movies'] + 28, superflix: s.superflix + 18, warezcdn: s.warezcdn + 8 };
  }

  if (lang.startsWith('pt')) {
    s.warezcdn += 18;
    s.superflix += 14;
    s['111movies'] += 4;
  } else if (lang.startsWith('es')) {
    s.warezcdn += 22;
    s.superflix += 16;
    s['111movies'] += 10;
  } else if (lang.startsWith('en')) {
    s['111movies'] += 22;
    s.superflix += 12;
    s.warezcdn += 6;
  }

  return s;
}

/** Ordenação da melhor fonte estimada para o utilizador (modo automático). */
export function rankBackendsForViewer(): PlayerBackendId[] {
  const region = getViewerRegionHint();
  const primary = getViewerPrimaryLanguage();
  const scores = baseScores(region, primary);
  return [...ALL_BACKENDS].sort((a, b) => scores[b] - scores[a]);
}

export function pickBackend(prefs: PlayerPrefs): PlayerBackendId {
  if (prefs.mode === 'manual' && prefs.manualProvider) return prefs.manualProvider;
  return rankBackendsForViewer()[0];
}

function movieIdFor111movies(imdbId: string | null | undefined, tmdbId: number): string {
  if (imdbId && /^tt\d+$/i.test(imdbId.trim())) return imdbId.trim();
  return String(tmdbId);
}

/** URL directa do embed (antes do `/api/proxy/embed`). */
export function buildBackendDirectUrl(
  backend: PlayerBackendId,
  ctx: {
    mediaType: 'movie' | 'tv';
    tmdbId: number;
    imdbId?: string | null;
    season?: number;
    episode?: number;
  }
): string {
  const { mediaType, tmdbId, imdbId, season = 1, episode = 1 } = ctx;

  if (backend === 'superflix') {
    const baseUrl = 'https://superflixapi.cv';
    if (mediaType === 'movie') {
      const id = imdbId && imdbId.trim() ? imdbId.trim() : String(tmdbId);
      return `${baseUrl}/filme/${id}`;
    }
    return `${baseUrl}/serie/${tmdbId}/${season}/${episode}`;
  }

  if (backend === '111movies') {
    if (mediaType === 'movie') {
      const id = movieIdFor111movies(imdbId, tmdbId);
      return `https://111movies.net/movie/${id}`;
    }
    const id = movieIdFor111movies(imdbId, tmdbId);
    return `https://111movies.net/tv/${id}/${season}/${episode}`;
  }

  // warezcdn — rotas oficiais do site (TMDB): /filme/{id}, /serie/{id}/s/e
  if (mediaType === 'movie') {
    return `https://warezcdn.site/filme/${tmdbId}`;
  }
  return `https://warezcdn.site/serie/${tmdbId}/${season}/${episode}`;
}

export function wrapEmbedProxy(directUrl: string, primaryLang?: string): string {
  const lang = (primaryLang || getViewerPrimaryLanguage()).replace(/[^a-zA-Z-]/g, '').slice(0, 16) || 'pt-BR';
  const params = new URLSearchParams({ url: directUrl, lang });
  return `/api/proxy/embed?${params.toString()}`;
}
