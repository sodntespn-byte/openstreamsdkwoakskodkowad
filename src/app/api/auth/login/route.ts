import { NextRequest, NextResponse } from 'next/server';
import { sql, isOfflineMode, inMemoryData, ensureDatabaseSchema } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { setAuthTokenCookie } from '@/lib/authCookies';
import { clientIpFromRequest, maskClientIp } from '@/lib/netPrivacy';
import {
  assertAuthFailuresBelowLimit,
  recordAuthFailure,
  resetAuthFailures,
} from '@/lib/rateLimit';

const GENERIC_AUTH_ERROR = 'Credenciais inválidas';

export async function POST(request: NextRequest) {
  const maskedIp = maskClientIp(clientIpFromRequest(request.headers));

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const emailNorm = String(email).trim().slice(0, 255);
    const rl = assertAuthFailuresBelowLimit(maskedIp, emailNorm);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde e tente novamente.', retryAfter: rl.retryAfterSec },
        { status: 429 }
      );
    }

    if (!isOfflineMode) {
      await ensureDatabaseSchema();
    }

    let user: {
      id: number;
      email: string;
      name: string;
      password_hash: string;
      is_admin: boolean;
      avatar_url?: string | null;
      theme?: string | null;
    } | null = null;

    if (isOfflineMode) {
      const foundUser = inMemoryData.users.find((u) => u.email === emailNorm);
      if (foundUser) {
        user = {
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.name,
          password_hash: foundUser.password_hash,
          is_admin: foundUser.is_admin,
          avatar_url: foundUser.avatar_url ?? null,
          theme: foundUser.theme ?? 'dark',
        };
      }
    } else {
      const result = await sql`
        SELECT id, email, name, password_hash, is_admin, avatar_url, theme
        FROM users
        WHERE email = ${emailNorm} AND status = 'active'
      `;

      if (result.rows.length > 0) {
        user = result.rows[0] as {
          id: number;
          email: string;
          name: string;
          password_hash: string;
          is_admin: boolean;
          avatar_url: string | null;
          theme: string | null;
        };
      }
    }

    if (!user) {
      recordAuthFailure(maskedIp, emailNorm);
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      recordAuthFailure(maskedIp, emailNorm);
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    resetAuthFailures(maskedIp, emailNorm);

    if (!isOfflineMode) {
      await sql`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ${user.id}`;
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.is_admin || false,
    });

    const response = NextResponse.json({
      message: 'Login realizado com sucesso',
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
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/login]', error);
    }
    return NextResponse.json({ error: 'Erro ao fazer login' }, { status: 500 });
  }
}
