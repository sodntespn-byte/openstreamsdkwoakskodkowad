import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'superflix-secret-key-change-in-production';
const TOKEN_EXPIRY = (process.env.JWT_EXPIRES_IN || '3d') as SignOptions['expiresIn'];

const BCRYPT_ROUNDS = Math.min(
  14,
  Math.max(10, parseInt(process.env.BCRYPT_ROUNDS || '12', 10) || 12)
);

export interface JWTPayload {
  userId: number;
  email: string;
  isAdmin: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET as Secret, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET as Secret) as JWTPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookieToken = request.cookies.get('auth_token')?.value;
  if (cookieToken) return cookieToken;
  return null;
}

export async function getCurrentUser(request: NextRequest): Promise<JWTPayload | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export function requireAuth<T>(
  handler: (request: NextRequest, context: T, user: JWTPayload) => Promise<Response>
) {
  return async (request: NextRequest, context: T): Promise<Response> => {
    const user = await getCurrentUser(request);
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return handler(request, context, user);
  };
}

export function requireAdmin<T>(
  handler: (request: NextRequest, context: T, user: JWTPayload) => Promise<Response>
) {
  return async (request: NextRequest, context: T): Promise<Response> => {
    const user = await getCurrentUser(request);
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!user.isAdmin) {
      return Response.json({ error: 'Acesso de administrador necessário' }, { status: 403 });
    }
    return handler(request, context, user);
  };
}
