import jwt from 'jsonwebtoken';
import type { JWTPayload } from '@/types/auth';
import type { NextRequest } from 'next/server';
import { TokenType, CookieName } from '@/types/enums';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET!;

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export function generateAccessToken(userId: string, email: string): string {
  return jwt.sign(
    { user_id: userId, email, type: TokenType.ACCESS } as JWTPayload,
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

export function generateRefreshToken(userId: string, email: string): string {
  return jwt.sign(
    { user_id: userId, email, type: TokenType.REFRESH } as JWTPayload,
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

export function generateTokens(user: { id: string; email: string }) {
  return {
    accessToken: generateAccessToken(user.id, user.email),
    refreshToken: generateRefreshToken(user.id, user.email),
  };
}

export function verifyAccessToken(token: string): JWTPayload {
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as JWTPayload;
    if (payload.type !== TokenType.ACCESS) {
      throw new Error('Invalid token type');
    }
    return payload;
  } catch {
    throw new Error('Invalid access token');
  }
}

export function verifyRefreshToken(token: string): JWTPayload {
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET) as JWTPayload;
    if (payload.type !== TokenType.REFRESH) {
      throw new Error('Invalid token type');
    }
    return payload;
  } catch {
    throw new Error('Invalid refresh token');
  }
}

export function isAuthenticated(request: NextRequest): boolean {
  const token = request.cookies.get(CookieName.ACCESS_TOKEN)?.value;
  if (!token) return false;

  try {
    verifyAccessToken(token);
    return true;
  } catch {
    return false;
  }
}

export function getUserIdFromRequest(request: NextRequest): string | null {
  const token =
    request.cookies.get(CookieName.ACCESS_TOKEN)?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) return null;

  try {
    const payload = verifyAccessToken(token);
    return payload.user_id;
  } catch {
    return null;
  }
}
