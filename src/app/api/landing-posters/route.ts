import { NextResponse } from 'next/server';
import { TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE } from '@/lib/constants';
import type { Content, TMDBResponse } from '@/types/content';

function apiKey(): string {
  return (
    process.env.TMDB_API_KEY ||
    process.env.NEXT_PUBLIC_TMDB_API_KEY ||
    TMDB_API_KEY ||
    ''
  );
}

async function fetchPage(url: string): Promise<Content[]> {
  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) return [];
  const data = (await res.json()) as TMDBResponse<Content>;
  return data.results || [];
}

export async function GET() {
  const key = apiKey();
  if (!key) {
    return NextResponse.json({ posters: [] });
  }

  const seen = new Set<number>();
  const posters: { id: number; url: string }[] = [];

  const pushUnique = (list: Content[]) => {
    for (const m of list) {
      if (!m?.poster_path || seen.has(m.id)) continue;
      seen.add(m.id);
      posters.push({
        id: m.id,
        url: `${TMDB_IMAGE_BASE}/w342${m.poster_path}`,
      });
      if (posters.length >= 120) return;
    }
  };

  const endpoints = [
    `${TMDB_BASE_URL}/trending/movie/week?api_key=${key}&language=pt-BR`,
    `${TMDB_BASE_URL}/movie/popular?api_key=${key}&language=pt-BR&page=1`,
    `${TMDB_BASE_URL}/movie/popular?api_key=${key}&language=pt-BR&page=2`,
    `${TMDB_BASE_URL}/movie/top_rated?api_key=${key}&language=pt-BR&page=1`,
    `${TMDB_BASE_URL}/movie/now_playing?api_key=${key}&language=pt-BR&page=1`,
    `${TMDB_BASE_URL}/movie/upcoming?api_key=${key}&language=pt-BR&page=1`,
  ];

  for (const url of endpoints) {
    if (posters.length >= 72) break;
    try {
      pushUnique(await fetchPage(url));
    } catch {
      /* continua outras fontes */
    }
  }

  return NextResponse.json(
    { posters },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400',
      },
    }
  );
}
