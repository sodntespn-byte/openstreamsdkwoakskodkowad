import { NextRequest, NextResponse } from 'next/server';
import { sql, isOfflineMode, inMemoryData } from '@/lib/db';
import { getCurrentUser, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Tentar autenticar via header primeiro, depois via body (para sendBeacon)
    let user = await getCurrentUser(request);

    const body = await request.json();
    const { items, token } = body;

    // Se nao autenticou via header, tentar via token no body (sendBeacon)
    if (!user && token) {
      user = verifyToken(token);
    }

    if (!user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Items deve ser um array' }, { status: 400 });
    }

    const synced: unknown[] = [];

    for (const item of items) {
      const {
        tmdb_id,
        imdb_id,
        title,
        poster_path,
        media_type,
        season,
        episode,
        progress,
        vote_average,
        max_quality,
      } = item;

      if (!tmdb_id || !title || !media_type) continue;

      if (isOfflineMode) {
        const existingIndex = inMemoryData.watchHistory.findIndex(
          (h) =>
            h.user_id === user.userId &&
            h.tmdb_id === tmdb_id &&
            h.season === season &&
            h.episode === episode
        );

        const historyItem = {
          id: existingIndex >= 0 ? inMemoryData.watchHistory[existingIndex].id : Date.now(),
          user_id: user.userId,
          tmdb_id,
          imdb_id: imdb_id || null,
          title,
          poster_path: poster_path || null,
          media_type,
          season: season || null,
          episode: episode || null,
          progress: progress || 0,
          watched_at: new Date(),
          vote_average:
            vote_average != null && Number.isFinite(Number(vote_average))
              ? Number(vote_average)
              : null,
          max_quality: typeof max_quality === 'string' ? max_quality.slice(0, 50) : null,
        };

        if (existingIndex >= 0) {
          inMemoryData.watchHistory[existingIndex] = historyItem;
        } else {
          inMemoryData.watchHistory.push(historyItem);
        }

        synced.push(historyItem);
      } else {
        const va =
          vote_average != null && Number.isFinite(Number(vote_average))
            ? Number(vote_average)
            : null;
        const mq = typeof max_quality === 'string' ? max_quality.slice(0, 50) : null;

        const result = await sql`
          INSERT INTO watch_history (user_id, tmdb_id, imdb_id, title, poster_path, media_type, season, episode, progress, vote_average, max_quality)
          VALUES (${user.userId}, ${tmdb_id}, ${imdb_id || null}, ${title}, ${poster_path || null}, ${media_type}, ${season || null}, ${episode || null}, ${progress || 0}, ${va}, ${mq})
          ON CONFLICT (user_id, tmdb_id, season, episode)
          DO UPDATE SET
            progress = GREATEST(watch_history.progress, EXCLUDED.progress),
            watched_at = CURRENT_TIMESTAMP,
            vote_average = COALESCE(EXCLUDED.vote_average, watch_history.vote_average),
            max_quality = COALESCE(EXCLUDED.max_quality, watch_history.max_quality),
            imdb_id = COALESCE(EXCLUDED.imdb_id, watch_history.imdb_id)
          RETURNING *
        `;

        if (result.rows.length > 0) {
          synced.push(result.rows[0]);
        }
      }
    }

    return NextResponse.json({
      message: `${synced.length} itens sincronizados`,
      synced,
    });
  } catch (error) {
    console.error('Sync history error:', error);
    return NextResponse.json({ error: 'Erro ao sincronizar histórico' }, { status: 500 });
  }
}
