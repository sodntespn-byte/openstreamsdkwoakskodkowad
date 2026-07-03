import { NextRequest, NextResponse } from 'next/server';
import { sql, isOfflineMode, inMemoryData, ensureDatabaseSchema } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { setAuthTokenCookie } from '@/lib/authCookies';
import { clientIpFromRequest, maskClientIp } from '@/lib/netPrivacy';
import {
  assertAuthFailuresBelowLimit,
  recordAuthFailure,
  resetAuthFailures,
} from '@/lib/rateLimit';

interface UserRow {
  id: number;
  email: string;
  name: string;
  is_admin: boolean;
  avatar_url: string | null;
  theme: string | null;
}

export async function POST(request: NextRequest) {
  const maskedIp = maskClientIp(clientIpFromRequest(request.headers));

  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    const emailNorm = String(email).trim().slice(0, 255);
    const rl = assertAuthFailuresBelowLimit(maskedIp, `reg:${emailNorm}`);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Muitas tentativas de registo. Aguarde.', retryAfter: rl.retryAfterSec },
        { status: 429 }
      );
    }

    if (!isOfflineMode) {
      await ensureDatabaseSchema();
    }

    const passwordHash = await hashPassword(password);
    const userName = (typeof name === 'string' && name.trim().length >= 2
      ? name.trim()
      : emailNorm.split('@')[0]
    ).slice(0, 255);

    if (isOfflineMode) {
      const existingUser = inMemoryData.users.find((u) => u.email === emailNorm);
      if (existingUser) {
        recordAuthFailure(maskedIp, `reg:${emailNorm}`);
        return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 });
      }

      const newUser = {
        id: inMemoryData.users.length + 1,
        email: emailNorm,
        name: userName,
        password_hash: passwordHash,
        is_admin: false,
        status: 'active',
        last_login: null,
        created_at: new Date(),
        updated_at: new Date(),
        avatar_url: null as string | null,
        theme: 'dark',
      };
      inMemoryData.users.push(newUser);

      const token = generateToken({
        userId: newUser.id,
        email: newUser.email,
        isAdmin: false,
      });

      resetAuthFailures(maskedIp, `reg:${emailNorm}`);

      const response = NextResponse.json({
        message: 'Usuário criado com sucesso',
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          isAdmin: false,
          avatarUrl: newUser.avatar_url,
          theme: newUser.theme,
        },
      });

      setAuthTokenCookie(response, token);
      return response;
    }

    const existingUser = await sql`SELECT id FROM users WHERE email = ${emailNorm}`;

    if (existingUser.rows.length > 0) {
      recordAuthFailure(maskedIp, `reg:${emailNorm}`);
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO users (email, name, password_hash)
      VALUES (${emailNorm}, ${userName}, ${passwordHash})
      RETURNING id, email, name, is_admin, avatar_url, theme
    `;

    const user = result.rows[0] as UserRow;
    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.is_admin || false,
    });

    resetAuthFailures(maskedIp, `reg:${emailNorm}`);

    const response = NextResponse.json({
      message: 'Usuário criado com sucesso',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.is_admin || false,
        avatarUrl: user.avatar_url ?? null,
        theme: user.theme || 'dark',
      },
    });

    setAuthTokenCookie(response, token);
    return response;
  } catch (error) {
    recordAuthFailure(maskedIp, 'reg:error');
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/register]', error);
    }
    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 });
  }
}
