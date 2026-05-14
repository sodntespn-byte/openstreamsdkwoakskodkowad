import { NextRequest, NextResponse } from 'next/server';
import { sql, isOfflineMode, inMemoryData } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

function clampTitle(s: string): string {
  return s.trim().slice(0, 500) || 'Sem título';
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tmdbId = searchParams.get('tmdb_id');
    const mediaType = searchParams.get('media_type');

    if (tmdbId && mediaType) {
      const tid = Number(tmdbId);
      if (!Number.isFinite(tid)) {
        return NextResponse.json({ error: 'tmdb_id inválido' }, { status: 400 });
      }
      const mt = mediaType === 'tv' ? 'tv' : 'movie';

      if (isOfflineMode) {
        const favorited = inMemoryData.favorites.some(
          (f) => f.user_id === user.userId && f.tmdb_id === tid && f.media_type === mt
        );
        return NextResponse.json({ favorited });
      }

      const r = await sql`
        SELECT 1 FROM favorites
        WHERE user_id = ${user.userId} AND tmdb_id = ${tid} AND media_type = ${mt}
        LIMIT 1
      `;
      return NextResponse.json({ favorited: r.rows.length > 0 });
    }

    if (isOfflineMode) {
      const rows = inMemoryData.favorites
        .filter((f) => f.user_id === user.userId)
        .sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
      return NextResponse.json(rows);
    }

    const result = await sql`
      SELECT * FROM favorites
      WHERE user_id = ${user.userId}
      ORDER BY added_at DESC
      LIMIT 200
    `;
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Favorites GET error:', error);
    return NextResponse.json({ error: 'Erro ao listar favoritos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const data = await request.json();
    const tmdb_id = Number(data.tmdb_id);
    const title = clampTitle(typeof data.title === 'string' ? data.title : '');
    const poster_path =
      typeof data.poster_path === 'string' ? data.poster_path.slice(0, 500) : null;
    const media_type = data.media_type === 'tv' ? 'tv' : 'movie';

    if (!Number.isFinite(tmdb_id)) {
      return NextResponse.json({ error: 'tmdb_id inválido' }, { status: 400 });
    }

    if (isOfflineMode) {
      const exists = inMemoryData.favorites.some(
        (f) => f.user_id === user.userId && f.tmdb_id === tmdb_id && f.media_type === media_type
      );
      if (exists) {
        return NextResponse.json({ message: 'Já nos favoritos' });
      }
      const row = {
        id: Date.now(),
        user_id: user.userId,
        tmdb_id,
        title,
        poster_path,
        media_type,
        added_at: new Date(),
      };
      inMemoryData.favorites.push(row);
      return NextResponse.json(row);
    }

    const result = await sql`
      INSERT INTO favorites (user_id, tmdb_id, title, poster_path, media_type)
      VALUES (${user.userId}, ${tmdb_id}, ${title}, ${poster_path}, ${media_type})
      ON CONFLICT (user_id, tmdb_id, media_type) DO UPDATE SET
        title = EXCLUDED.title,
        poster_path = EXCLUDED.poster_path,
        added_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Favorites POST error:', error);
    return NextResponse.json({ error: 'Erro ao adicionar favorito' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tmdbId = searchParams.get('tmdb_id');
    const mediaType = searchParams.get('media_type');
    const tid = Number(tmdbId);
    const mt = mediaType === 'tv' ? 'tv' : 'movie';

    if (!Number.isFinite(tid) || !tmdbId) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    if (isOfflineMode) {
      inMemoryData.favorites = inMemoryData.favorites.filter(
        (f) => !(f.user_id === user.userId && f.tmdb_id === tid && f.media_type === mt)
      );
      return NextResponse.json({ message: 'Removido' });
    }

    await sql`
      DELETE FROM favorites
      WHERE user_id = ${user.userId} AND tmdb_id = ${tid} AND media_type = ${mt}
    `;
    return NextResponse.json({ message: 'Removido' });
  } catch (error) {
    console.error('Favorites DELETE error:', error);
    return NextResponse.json({ error: 'Erro ao remover favorito' }, { status: 500 });
  }
}
