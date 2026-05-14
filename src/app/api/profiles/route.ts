import { NextRequest, NextResponse } from 'next/server';
import { sql, isOfflineMode, inMemoryData, nextViewerProfileIdAlloc, ensureViewerProfilesTable, query } from '@/lib/db';
import type { ViewerProfileRow } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import {
  AVATAR_GRADIENT_IDS,
  MAX_VIEWER_PROFILES,
  isValidAvatarId,
  serializeViewerProfile,
} from '@/lib/viewerProfileUtils';

async function ensureDefaultProfilesOnline(userId: number) {
  await ensureViewerProfilesTable();
  let result = await sql<ViewerProfileRow>`
    SELECT * FROM viewer_profiles
    WHERE user_id = ${userId}
    ORDER BY sort_order ASC, id ASC
  `;
  if (result.rows.length > 0) return result.rows;

  const u = await sql<{ name: string | null; email: string }>`
    SELECT name, email FROM users WHERE id = ${userId} LIMIT 1
  `;
  const row = u.rows[0];
  const displayName = (row?.name?.trim() || row?.email?.split('@')[0] || 'Perfil 1').slice(0, 100);

  await sql`
    INSERT INTO viewer_profiles (user_id, name, avatar_id, sort_order)
    VALUES (${userId}, ${displayName}, 'gradient-1', 0)
  `;

  result = await sql<ViewerProfileRow>`
    SELECT * FROM viewer_profiles
    WHERE user_id = ${userId}
    ORDER BY sort_order ASC, id ASC
  `;
  return result.rows;
}

function ensureDefaultProfilesOffline(userId: number): ViewerProfileRow[] {
  let rows = inMemoryData.viewerProfiles.filter((p) => p.user_id === userId);
  if (rows.length > 0) return rows;

  const u = inMemoryData.users.find((x) => x.id === userId);
  const displayName = (u?.name?.trim() || u?.email?.split('@')[0] || 'Perfil 1').slice(0, 100);
  const now = new Date();
  const created: ViewerProfileRow = {
    id: nextViewerProfileIdAlloc(),
    user_id: userId,
    name: displayName,
    avatar_id: 'gradient-1',
    sort_order: 0,
    created_at: now,
    updated_at: now,
  };
  inMemoryData.viewerProfiles.push(created);
  return [created];
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const rows = isOfflineMode
      ? ensureDefaultProfilesOffline(user.userId)
      : await ensureDefaultProfilesOnline(user.userId);

    return NextResponse.json({
      profiles: rows.map((r) => serializeViewerProfile(r)),
    });
  } catch (error) {
    console.error('GET /api/profiles:', error);
    return NextResponse.json({ error: 'Erro ao listar perfis' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const avatarRaw = typeof body.avatarId === 'string' ? body.avatarId : 'gradient-1';
    const avatar_id = isValidAvatarId(avatarRaw) ? avatarRaw : 'gradient-1';

    if (isOfflineMode) {
      ensureDefaultProfilesOffline(user.userId);
      const count = inMemoryData.viewerProfiles.filter((p) => p.user_id === user.userId).length;
      if (count >= MAX_VIEWER_PROFILES) {
        return NextResponse.json({ error: `Máximo de ${MAX_VIEWER_PROFILES} perfis` }, { status: 400 });
      }
      const now = new Date();
      const created: ViewerProfileRow = {
        id: nextViewerProfileIdAlloc(),
        user_id: user.userId,
        name,
        avatar_id,
        sort_order: count,
        created_at: now,
        updated_at: now,
      };
      inMemoryData.viewerProfiles.push(created);
      return NextResponse.json({ profile: serializeViewerProfile(created) });
    }

    await ensureViewerProfilesTable();
    const cnt = await query<{ c: string }>(
      'SELECT COUNT(*)::text AS c FROM viewer_profiles WHERE user_id = $1',
      [user.userId]
    );
    if (Number(cnt.rows[0]?.c || 0) >= MAX_VIEWER_PROFILES) {
      return NextResponse.json({ error: `Máximo de ${MAX_VIEWER_PROFILES} perfis` }, { status: 400 });
    }

    const nextOrder = Number(cnt.rows[0]?.c || 0);
    const ins = await query<ViewerProfileRow>(
      `INSERT INTO viewer_profiles (user_id, name, avatar_id, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user.userId, name, avatar_id, nextOrder]
    );
    const row = ins.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Falha ao criar perfil' }, { status: 500 });
    }
    return NextResponse.json({ profile: serializeViewerProfile(row) });
  } catch (error) {
    console.error('POST /api/profiles:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Erro ao criar perfil', detail: process.env.NODE_ENV === 'development' ? msg : undefined },
      { status: 500 }
    );
  }
}
