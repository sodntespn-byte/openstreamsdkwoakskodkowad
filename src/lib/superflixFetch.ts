import { resolveWithCloudflare, fetchWithResolvedDNS } from '@/lib/dns-resolver';
import { SUPERFLIX_API_MIRRORS } from '@/lib/constants';

/** Referer aceite pela SuperflixAPI ao pedir o player. */
export const SUPERFLIX_PLAYER_REFERER =
  process.env.SUPERFLIX_EMBED_REFERER || 'https://superflix.app/';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchViaResolvedDns(
  url: string,
  referer: string,
  maxRedirects = 5
): Promise<{ status: number; body: string } | null> {
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    const urlObj = new URL(currentUrl);
    const resolvedIP = await resolveWithCloudflare(urlObj.hostname);
    if (!resolvedIP) return null;

    try {
      const result = await fetchWithResolvedDNS(currentUrl, resolvedIP, { referer });
      if (result.status >= 300 && result.status < 400 && result.redirect) {
        currentUrl = result.redirect.startsWith('http')
          ? result.redirect
          : new URL(result.redirect, currentUrl).href;
        redirectCount++;
        continue;
      }
      return { status: result.status, body: result.body };
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchViaNative(url: string, referer: string): Promise<{ status: number; body: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        Referer: referer,
        Origin: new URL(referer).origin,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    });
    const body = await res.text();
    return { status: res.status, body };
  } catch (e) {
    if (process.env.DEBUG_PROXY === '1') {
      console.error('[superflixFetch] native', url, e);
    }
    return null;
  }
}

/** Obtém HTML do player Superflix (DNS customizado → fetch nativo → mirrors). */
export async function fetchSuperflixPlayerHtml(
  url: string,
  referer = SUPERFLIX_PLAYER_REFERER
): Promise<{ status: number; body: string; finalUrl: string } | null> {
  const tryUrl = async (target: string) => {
    const viaNative = await fetchViaNative(target, referer);
    if (viaNative && viaNative.status === 200 && viaNative.body.length > 200) {
      return { ...viaNative, finalUrl: target };
    }
    const viaDns = await fetchViaResolvedDns(target, referer);
    if (viaDns && viaDns.status === 200 && viaDns.body.length > 200) {
      return { ...viaDns, finalUrl: target };
    }
    return null;
  };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const result = await tryUrl(url);
  if (result) return result;

  for (const mirror of SUPERFLIX_API_MIRRORS) {
    const mirrorOrigin = new URL(mirror).origin;
    if (mirrorOrigin === parsed.origin) continue;
    const alt = new URL(parsed.pathname + parsed.search + parsed.hash, mirrorOrigin).href;
    const altResult = await tryUrl(alt);
    if (altResult) return altResult;
  }

  return null;
}

/** Episódio do calendário público (`/calendario.php`). */
export interface SuperflixCalendarEpisode {
  title: string;
  episode: string;
  season: number;
  number: number;
  air_date: string;
  type: number;
  tmdb_id: string;
  imdb_id: string;
  poster: string;
  backdrop: string;
  status: 'Atualizado' | 'Futuro' | 'Hoje';
}

function parseCalendarJson(body: string): SuperflixCalendarEpisode[] | null {
  try {
    const data = JSON.parse(body) as unknown;
    if (!Array.isArray(data)) return null;
    return data as SuperflixCalendarEpisode[];
  } catch {
    return null;
  }
}

/** Calendário de lançamentos (espelhos SuperFlixAPI, prioridade ao domínio configurado). */
export async function fetchSuperflixCalendar(): Promise<SuperflixCalendarEpisode[] | null> {
  const path = '/calendario.php';

  for (const mirror of SUPERFLIX_API_MIRRORS) {
    const url = new URL(path, mirror).href;

    const viaDns = await fetchViaResolvedDns(url, SUPERFLIX_PLAYER_REFERER);
    if (viaDns && viaDns.status === 200) {
      const parsed = parseCalendarJson(viaDns.body);
      if (parsed && parsed.length > 0) return parsed;
    }

    const viaNative = await fetchViaNative(url, SUPERFLIX_PLAYER_REFERER);
    if (viaNative && viaNative.status === 200) {
      const parsed = parseCalendarJson(viaNative.body);
      if (parsed && parsed.length > 0) return parsed;
    }
  }

  return null;
}
