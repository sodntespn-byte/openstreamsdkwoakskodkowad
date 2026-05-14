import type { NextResponse } from 'next/server';

const COOKIE = 'auth_token';
const MAX_AGE = 60 * 60 * 24 * 3; // 3 dias — alinhado com JWT curto

const isProd = process.env.NODE_ENV === 'production';

export function setAuthTokenCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export function clearAuthTokenCookie(response: NextResponse): void {
  response.cookies.set(COOKIE, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}
