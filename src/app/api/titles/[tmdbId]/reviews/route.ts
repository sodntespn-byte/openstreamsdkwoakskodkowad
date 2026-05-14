import { NextRequest, NextResponse } from 'next/server';
import { sql, isOfflineMode, inMemoryData } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { extractImdbRating, fetchImdb236Document } from '@/lib/imdb236';
import { sanitizePlainText } from '@/lib/sanitize';

function blendRating(imdb: number | null, communityAvg: number | null): number | null {
  if (imdb != null && communityAvg != null) {
    return Math.round((imdb * 0.55 + communityAvg * 0.45) * 10) / 10;
  }
  if (communityAvg != null) return communityAvg;
  return imdb;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tmdbId: string }> }
) {
  const { tmdbId } = await context.params;
  const tmdb = Number(tmdbId);
  const { searchParams } = new URL(request.url);
  const mediaType = (searchParams.get('media_type') || 'movie') as string;
  const imdbId = searchParams.get('imdb_id');

  if (!Number.isFinite(tmdb)) {
    return NextResponse.json({ error: 'tmdbId inválido' }, { status: 400 });
  }

  let imdbRating: number | null = null;
  if (imdbId) {
    const doc = await fetchImdb236Document(imdbId);
    imdbRating = extractImdbRating(doc);
  }

  let reviews: {
    id: number;
    user_id: number;
    rating: number;
    body: string;
    created_at: string;
  }[] = [];
  let avgCommunity: number | null = null;
  let count = 0;

  if (isOfflineMode) {
    const list = inMemoryData.titleReviews.filter(
      (r) => r.tmdb_id === tmdb && r.media_type === mediaType
    );
    count = list.length;
    if (count > 0) {
      avgCommunity = Math.round((list.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
    }
    reviews = list.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      rating: r.rating,
      body: r.body,
      created_at: new Date(r.created_at).toISOString(),
    }));
  } else {
    const stats = await sql`
      SELECT COALESCE(AVG(rating)::float, NULL) AS avg_rating, COUNT(*)::int AS cnt
      FROM title_reviews
      WHERE tmdb_id = ${tmdb} AND media_type = ${mediaType}
    `;
    const row = stats.rows[0] as { avg_rating: number | null; cnt: number };
    count = row.cnt;
    if (row.avg_rating != null && count > 0) {
      avgCommunity = Math.round(Number(row.avg_rating) * 10) / 10;
    }

    const list = await sql`
      SELECT id, user_id, rating, body, created_at
      FROM title_reviews
      WHERE tmdb_id = ${tmdb} AND media_type = ${mediaType}
      ORDER BY created_at DESC
      LIMIT 80
    `;
    reviews = (list.rows as { id: number; user_id: number; rating: number; body: string; created_at: Date }[]).map(
      (r) => ({
        ...r,
        created_at: new Date(r.created_at).toISOString(),
      })
    );
  }

  const blended = blendRating(imdbRating, avgCommunity);

  return NextResponse.json({
    tmdb_id: tmdb,
    media_type: mediaType,
    imdb_id: imdbId,
    imdb_rating: imdbRating,
    community_avg: avgCommunity,
    community_count: count,
    blended_rating: blended,
    reviews,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tmdbId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { tmdbId } = await context.params;
  const tmdb = Number(tmdbId);
  const body = await request.json();
  const mediaType = (body.media_type || 'movie') as string;
  const rating = Number(body.rating);
  const text =
    typeof body.body === 'string' ? sanitizePlainText(body.body, 2000) : '';

  if (!Number.isFinite(tmdb) || !['movie', 'tv'].includes(mediaType)) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
    return NextResponse.json({ error: 'Avaliação de 1 a 10' }, { status: 400 });
  }

  if (isOfflineMode) {
    const id = inMemoryData.titleReviews.length
      ? Math.max(...inMemoryData.titleReviews.map((r) => r.id)) + 1
      : 1;
    const row = {
      id,
      user_id: user.userId,
      tmdb_id: tmdb,
      media_type: mediaType,
      rating: Math.round(rating),
      body: text,
      created_at: new Date(),
    };
    inMemoryData.titleReviews.push(row);
    return NextResponse.json({ ok: true, review: row });
  }

  const result = await sql`
    INSERT INTO title_reviews (user_id, tmdb_id, media_type, rating, body)
    VALUES (${user.userId}, ${tmdb}, ${mediaType}, ${Math.round(rating)}, ${text})
    RETURNING id, user_id, tmdb_id, media_type, rating, body, created_at
  `;

  return NextResponse.json({ ok: true, review: result.rows[0] });
}
