import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildPageCsp } from '@/lib/pageCsp';

const protectedPaths = ['/profile', '/admin', '/sala'];
const authPaths = ['/login', '/register'];

function applySecurityHeaders(response: NextResponse, pathname: string): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  response.headers.set('Content-Security-Policy', buildPageCsp(pathname));
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  if (isProtectedPath && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
    return applySecurityHeaders(NextResponse.redirect(loginUrl), pathname);
  }

  if (isAuthPath && token) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/profiles', request.url)), pathname);
  }

  return applySecurityHeaders(NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|robots.txt).*)',
  ],
};
