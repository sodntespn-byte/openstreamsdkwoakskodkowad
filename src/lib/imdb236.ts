/**
 * Cliente servidor para IMDb236 (RapidAPI).
 * Chave: RAPIDAPI_KEY no .env.local — nunca expor no cliente.
 */

const HOST = 'imdb236.p.rapidapi.com';

function normalizeImdbId(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('tt') || s.startsWith('nm')) return s;
  if (/^\d+$/.test(s)) return `tt${s}`;
  return s;
}

export async function fetchImdb236Document(imdbId: string): Promise<unknown | null> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return null;

  const id = normalizeImdbId(imdbId);
  try {
    const res = await fetch(`https://${HOST}/api/imdb/${encodeURIComponent(id)}`, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': HOST,
        Accept: 'application/json',
      },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Extrai nota numérica (0–10) de respostas heterogéneas da API. */
export function extractImdbRating(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;

  const n = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const x = parseFloat(v.replace(',', '.'));
      return Number.isFinite(x) ? x : null;
    }
    return null;
  };

  let r = n(o.rating);
  if (r != null) return clamp10(r);

  r = n(o.imDbRating);
  if (r != null) return clamp10(r);

  const ar = o.aggregateRating;
  if (ar && typeof ar === 'object') {
    const arO = ar as Record<string, unknown>;
    r = n(arO.ratingValue);
    if (r != null) return clamp10(r);
  }

  const ratings = o.ratings;
  if (ratings && typeof ratings === 'object') {
    const ro = ratings as Record<string, unknown>;
    r = n(ro.imDb);
    if (r != null) return clamp10(r);
  }

  return null;
}

function clamp10(x: number): number {
  if (x > 10) return 10;
  if (x < 0) return 0;
  return Math.round(x * 10) / 10;
}

export function pickImdbSummary(data: unknown): {
  title?: string;
  year?: string;
  plot?: string;
  genres?: string[];
} | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const title =
    (typeof o.primaryTitle === 'string' && o.primaryTitle) ||
    (typeof o.title === 'string' && o.title) ||
    (typeof o.name === 'string' && o.name) ||
    undefined;
  const year =
    (typeof o.startYear === 'number' && String(o.startYear)) ||
    (typeof o.year === 'string' && o.year) ||
    undefined;
  const plot = typeof o.plot === 'string' ? o.plot : typeof o.description === 'string' ? o.description : undefined;
  let genres: string[] | undefined;
  if (Array.isArray(o.genres)) {
    genres = o.genres.filter((g): g is string => typeof g === 'string');
  } else if (typeof o.genres === 'string') {
    genres = o.genres.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  }
  return { title, year, plot, genres };
}
