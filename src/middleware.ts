import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { STREAMING_FRAME_SRC } from '@/lib/streamingCsp';

const protectedPaths = ['/profile', '/admin'];
const authPaths = ['/login', '/register'];

/**
 * CSP para páginas HTML: Next.js exige `unsafe-inline` em script-src para hidratação.
 * `frame-src` inclui domínios do player (URLs directas + proxy + YouTube).
 * `frame-ancestors 'none'` anti-clickjacking no site principal.
 */
const PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://www.youtube-nocookie.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  `frame-src ${STREAMING_FRAME_SRC}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  response.headers.set('Content-Security-Policy', PAGE_CSP);
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  if (isProtectedPath && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (isAuthPath && token) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/profiles', request.url)));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|robots.txt).*)',
  ],
};
