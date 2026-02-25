import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt';
import { CookieName, HttpStatus } from '@/types/enums';

/**
 * Logout is special: we ALWAYS clear cookies, even if token deletion fails.
 * Therefore we don't use the generic withErrorHandler wrapper here.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    const refreshToken = request.cookies.get(CookieName.REFRESH_TOKEN)?.value;

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { tokenHash: refreshToken } });
    }

    if (userId) {
      await prisma.refreshToken.deleteMany({ where: { userId } });
    }
  } catch (error: unknown) {
    // Log but don't propagate — cookies must still be cleared
    console.error('[Logout] Error revoking tokens:', error);
  }

  const response = new NextResponse(null, { status: HttpStatus.NO_CONTENT });

  response.cookies.set(CookieName.ACCESS_TOKEN, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  response.cookies.set(CookieName.REFRESH_TOKEN, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
