import { NextRequest, NextResponse } from 'next/server';
import { sql, query, isOfflineMode, inMemoryData } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const minRating = searchParams.get('min_rating');
    const quality = searchParams.get('quality');
    const only4k = searchParams.get('only_4k') === '1' || searchParams.get('only_4k') === 'true';

    if (isOfflineMode) {
      let history = inMemoryData.watchHistory
        .filter((h) => h.user_id === user.userId)
        .sort((a, b) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime());

      if (minRating) {
        const m = Number(minRating);
        if (Number.isFinite(m)) {
          history = history.filter((h) => (h.vote_average ?? 0) >= m);
        }
      }
      if (quality) {
        const q = quality.toLowerCase();
        history = history.filter(
          (h) => h.max_quality && String(h.max_quality).toLowerCase().includes(q)
        );
      }
      if (only4k) {
        history = history.filter((h) => {
          const mq = (h.max_quality || '').toLowerCase();
          return mq.includes('4k') || mq.includes('2160') || mq.includes('uhd');
        });
      }

      return NextResponse.json(history.slice(0, 100));
    }

    const params: unknown[] = [user.userId];
    let where = 'WHERE user_id = $1';

    if (minRating) {
      const m = Number(minRating);
      if (Number.isFinite(m)) {
        params.push(m);
        where += ` AND vote_average IS NOT NULL AND vote_average >= $${params.length}`;
      }
    }
    if (quality) {
      params.push(`%${quality}%`);
      where += ` AND max_quality ILIKE $${params.length}`;
    }
    if (only4k) {
      where += ` AND (
        LOWER(COALESCE(max_quality, '')) LIKE '%4k%'
        OR LOWER(COALESCE(max_quality, '')) LIKE '%2160%'
        OR LOWER(COALESCE(max_quality, '')) LIKE '%uhd%'
      )`;
    }

    const result = await query(
      `SELECT * FROM watch_history ${where} ORDER BY watched_at DESC LIMIT 100`,
      params
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Get history error:', error);
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const data = await request.json();
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
    } = data;

    if (!tmdb_id || !title || !media_type) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

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

      return NextResponse.json(historyItem);
    }

    const va =
      vote_average != null && Number.isFinite(Number(vote_average)) ? Number(vote_average) : null;
    const mq = typeof max_quality === 'string' ? max_quality.slice(0, 50) : null;

    const result = await sql`
      INSERT INTO watch_history (user_id, tmdb_id, imdb_id, title, poster_path, media_type, season, episode, progress, vote_average, max_quality)
      VALUES (${user.userId}, ${tmdb_id}, ${imdb_id || null}, ${title}, ${poster_path || null}, ${media_type}, ${season || null}, ${episode || null}, ${progress || 0}, ${va}, ${mq})
      ON CONFLICT (user_id, tmdb_id, season, episode)
      DO UPDATE SET
        progress = EXCLUDED.progress,
        watched_at = CURRENT_TIMESTAMP,
        vote_average = COALESCE(EXCLUDED.vote_average, watch_history.vote_average),
        max_quality = COALESCE(EXCLUDED.max_quality, watch_history.max_quality),
        imdb_id = COALESCE(EXCLUDED.imdb_id, watch_history.imdb_id)
      RETURNING *
    `;

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Save history error:', error);
    return NextResponse.json({ error: 'Erro ao salvar histórico' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Clear all history for user
    if (isOfflineMode) {
      inMemoryData.watchHistory = inMemoryData.watchHistory.filter(
        (h) => h.user_id !== user.userId
      );
      return NextResponse.json({ message: 'Histórico limpo com sucesso' });
    }

    await sql`
      DELETE FROM watch_history WHERE user_id = ${user.userId}
    `;

    return NextResponse.json({ message: 'Histórico limpo com sucesso' });
  } catch (error) {
    console.error('Clear history error:', error);
    return NextResponse.json({ error: 'Erro ao limpar histórico' }, { status: 500 });
  }
}
