import { NextResponse } from 'next/server';
import { clearAuthTokenCookie } from '@/lib/authCookies';

export async function POST() {
  const response = NextResponse.json({
    message: 'Logout realizado com sucesso',
  });
  clearAuthTokenCookie(response);
  return response;
}

export async function GET() {
  return POST();
}
