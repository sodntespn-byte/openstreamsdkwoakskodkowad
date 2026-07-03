import { NextRequest, NextResponse } from 'next/server';
import { sql, isOfflineMode, inMemoryData, ensureDatabaseSchema } from '@/lib/db';
import { getCurrentUser, verifyPassword } from '@/lib/auth';
import { stripImageDataUrlMetadata } from '@/lib/imageSanitize';

interface UserRow {
  id: number;
  email: string;
  name: string;
  is_admin: boolean;
  avatar_url: string | null;
  theme: string | null;
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getCurrentUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const nameIn = typeof body.name === 'string' ? body.name.trim() : undefined;
    let avatarRaw =
      typeof body.avatar_url === 'string' ? body.avatar_url.trim().slice(0, 500_000) : undefined;
    if (avatarRaw && avatarRaw.startsWith('data:image/')) {
      try {
        avatarRaw = await stripImageDataUrlMetadata(avatarRaw);
      } catch (stripErr) {
        if (!/^data:image\/jpe?g;base64,/i.test(avatarRaw)) {
          return NextResponse.json({ error: 'Imagem inválida ou demasiado grande' }, { status: 400 });
        }
        if (avatarRaw.length > 500_000) {
          return NextResponse.json({ error: 'Imagem demasiado grande' }, { status: 400 });
        }
        if (process.env.NODE_ENV === 'development') {
          console.warn('[auth/profile] stripImage fallback:', stripErr);
        }
      }
    }
    const avatar_url = avatarRaw;
    const theme =
      typeof body.theme === 'string' && ['dark', 'light', 'frutiger'].includes(body.theme)
        ? body.theme
        : undefined;
    const emailIn = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
    const currentPassword =
      typeof body.currentPassword === 'string' ? body.currentPassword : undefined;

    if (nameIn !== undefined && nameIn.length === 0) {
      return NextResponse.json({ error: 'Nome não pode estar vazio' }, { status: 400 });
    }

    if (emailIn !== undefined) {
      if (!emailIn.includes('@')) {
        return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
      }
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Informe a senha atual para alterar o email' },
          { status: 400 }
        );
      }
    }

    if (isOfflineMode) {
      const userIndex = inMemoryData.users.findIndex((u) => u.id === authUser.userId);
      if (userIndex < 0) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }
      const u = inMemoryData.users[userIndex];
      if (nameIn !== undefined) u.name = nameIn;
      if (avatar_url !== undefined) u.avatar_url = avatar_url || null;
      if (theme !== undefined) u.theme = theme;
      if (emailIn !== undefined) {
        const ok = await verifyPassword(currentPassword!, u.password_hash);
        if (!ok) {
          return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });
        }
        if (inMemoryData.users.some((x) => x.email === emailIn && x.id !== u.id)) {
          return NextResponse.json({ error: 'Email já em uso' }, { status: 400 });
        }
        u.email = emailIn;
      }
      u.updated_at = new Date();
      if (avatar_url !== undefined && u.avatar_url) {
        for (const p of inMemoryData.viewerProfiles) {
          if (p.user_id === u.id) p.avatar_url = u.avatar_url;
        }
      }

      return NextResponse.json({
        message: 'Perfil atualizado com sucesso',
        user: {
          id: u.id,
          email: u.email,
          name: u.name,
          isAdmin: u.is_admin || false,
          avatarUrl: u.avatar_url ?? null,
          theme: u.theme ?? 'dark',
        },
      });
    }

    if (!isOfflineMode) {
      await ensureDatabaseSchema();
    }

    const cur = await sql`
      SELECT name, email, password_hash, avatar_url, theme FROM users WHERE id = ${authUser.userId}
    `;
    if (cur.rows.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    const row = cur.rows[0] as {
      name: string;
      email: string;
      password_hash: string;
      avatar_url: string | null;
      theme: string | null;
    };

    let nextEmail = row.email;
    if (emailIn !== undefined) {
      const ok = await verifyPassword(currentPassword!, row.password_hash);
      if (!ok) {
        return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });
      }
      const taken = await sql`SELECT id FROM users WHERE email = ${emailIn} AND id <> ${authUser.userId}`;
      if (taken.rows.length > 0) {
        return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 });
      }
      nextEmail = emailIn;
    }

    const nextName = nameIn !== undefined ? nameIn : row.name;
    const nextAvatar = avatar_url !== undefined ? avatar_url || null : row.avatar_url;
    const nextTheme = theme !== undefined ? theme : row.theme || 'dark';

    const result = await sql`
      UPDATE users
      SET
        email = ${nextEmail},
        name = ${nextName},
        avatar_url = ${nextAvatar},
        theme = ${nextTheme},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${authUser.userId}
      RETURNING id, email, name, is_admin, avatar_url, theme
    `;

    if (avatar_url !== undefined && nextAvatar) {
      await ensureDatabaseSchema();
      await sql`
        UPDATE viewer_profiles
        SET avatar_url = ${nextAvatar}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${authUser.userId}
      `;
    }

    const user = result.rows[0] as UserRow;

    return NextResponse.json({
      message: 'Perfil atualizado com sucesso',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.is_admin || false,
        avatarUrl: user.avatar_url,
        theme: user.theme || 'dark',
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 });
  }
}
