import { NextRequest, NextResponse } from 'next/server';
import { sql, isOfflineMode, inMemoryData, ensureViewerProfilesTable } from '@/lib/db';
import type { ViewerProfileRow } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isValidAvatarId, serializeViewerProfile } from '@/lib/viewerProfileUtils';
import { normalizeViewerAvatarUrl } from '@/lib/viewerProfileAvatar';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: idParam } = await context.params;
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const patchName = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : undefined;
    const patchAvatar =
      typeof body.avatarId === 'string' && isValidAvatarId(body.avatarId) ? body.avatarId : undefined;

    let patchAvatarUrl: string | null | undefined;
    if (body.avatarUrl === null || body.avatarUrl === '') {
      patchAvatarUrl = null;
    } else if (typeof body.avatarUrl === 'string' && body.avatarUrl.trim()) {
      try {
        patchAvatarUrl = await normalizeViewerAvatarUrl(body.avatarUrl);
      } catch {
        return NextResponse.json({ error: 'Imagem inválida ou demasiado grande' }, { status: 400 });
      }
    }

    if (patchName !== undefined && !patchName) {
      return NextResponse.json({ error: 'Nome não pode ser vazio' }, { status: 400 });
    }

    if (
      patchName === undefined &&
      patchAvatar === undefined &&
      patchAvatarUrl === undefined
    ) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }

    if (!isOfflineMode) {
      await ensureViewerProfilesTable();
    }

    if (isOfflineMode) {
      const idx = inMemoryData.viewerProfiles.findIndex((p) => p.id === id && p.user_id === user.userId);
      if (idx === -1) {
        return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
      }
      const cur = inMemoryData.viewerProfiles[idx];
      const now = new Date();
      const updated: ViewerProfileRow = {
        ...cur,
        name: patchName ?? cur.name,
        avatar_id: patchAvatar ?? cur.avatar_id,
        avatar_url: patchAvatarUrl !== undefined ? patchAvatarUrl : cur.avatar_url ?? null,
        updated_at: now,
      };
      inMemoryData.viewerProfiles[idx] = updated;
      return NextResponse.json({ profile: serializeViewerProfile(updated) });
    }

    const own = await sql<{ id: number }>`
      SELECT id FROM viewer_profiles WHERE id = ${id} AND user_id = ${user.userId} LIMIT 1
    `;
    if (own.rows.length === 0) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
    }

    const cur = await sql<ViewerProfileRow>`
      SELECT * FROM viewer_profiles WHERE id = ${id} AND user_id = ${user.userId} LIMIT 1
    `;
    const row = cur.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
    }

    const nextName = patchName ?? row.name;
    const nextAvatarId = patchAvatar ?? row.avatar_id;
    const nextAvatarUrl = patchAvatarUrl !== undefined ? patchAvatarUrl : row.avatar_url ?? null;

    const res = await sql<ViewerProfileRow>`
      UPDATE viewer_profiles
      SET
        name = ${nextName},
        avatar_id = ${nextAvatarId},
        avatar_url = ${nextAvatarUrl},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND user_id = ${user.userId}
      RETURNING *
    `;
    return NextResponse.json({ profile: serializeViewerProfile(res.rows[0]) });
  } catch (error) {
    console.error('PATCH /api/profiles/[id]:', error);
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: idParam } = await context.params;
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    if (!isOfflineMode) {
      await ensureViewerProfilesTable();
    }

    if (isOfflineMode) {
      const mine = inMemoryData.viewerProfiles.filter((p) => p.user_id === user.userId);
      if (mine.length <= 1) {
        return NextResponse.json({ error: 'É necessário manter pelo menos um perfil' }, { status: 400 });
      }
      const idx = inMemoryData.viewerProfiles.findIndex((p) => p.id === id && p.user_id === user.userId);
      if (idx === -1) {
        return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
      }
      inMemoryData.viewerProfiles.splice(idx, 1);
      return NextResponse.json({ success: true });
    }

    const cnt = await sql<{ c: string }>`
      SELECT COUNT(*)::text AS c FROM viewer_profiles WHERE user_id = ${user.userId}
    `;
    if (Number(cnt.rows[0]?.c || 0) <= 1) {
      return NextResponse.json({ error: 'É necessário manter pelo menos um perfil' }, { status: 400 });
    }

    const del = await sql`
      DELETE FROM viewer_profiles WHERE id = ${id} AND user_id = ${user.userId}
    `;
    if ((del.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/profiles/[id]:', error);
    return NextResponse.json({ error: 'Erro ao eliminar perfil' }, { status: 500 });
  }
}
