import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyRefreshToken, generateAccessToken } from '@/lib/auth/jwt';
import { CookieName, HttpStatus } from '@/types/enums';
import { withErrorHandler } from '@/lib/utils/api-error-handler';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const refreshToken = request.cookies.get(CookieName.REFRESH_TOKEN)?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { error: 'No refresh token' },
      { status: HttpStatus.UNAUTHORIZED }
    );
  }

  const payload = verifyRefreshToken(refreshToken);

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      userId: payload.user_id,
      tokenHash: refreshToken,
      expiresAt: { gt: new Date() },
    },
  });

  if (!storedToken) {
    return NextResponse.json(
      { error: 'Invalid refresh token' },
      { status: HttpStatus.UNAUTHORIZED }
    );
  }

  const newAccessToken = generateAccessToken(payload.user_id, payload.email);

  const response = NextResponse.json({ access: newAccessToken });

  response.cookies.set(CookieName.ACCESS_TOKEN, newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60,
    path: '/',
  });

  return response;
}, 'TokenRefresh');
