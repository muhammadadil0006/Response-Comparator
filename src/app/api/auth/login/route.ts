import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth/jwt';
import { LoginSchema } from '@/lib/auth/validation';
import { CookieName, HttpStatus } from '@/types/enums';
import { withErrorHandler } from '@/lib/utils/api-error-handler';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { email, password } = LoginSchema.parse(body);

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: HttpStatus.UNAUTHORIZED }
    );
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: HttpStatus.UNAUTHORIZED }
    );
  }

  const access = generateAccessToken(user.id, user.email);
  const refresh = generateRefreshToken(user.id, user.email);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refresh,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      is_active: user.isActive,
    },
    access,
    refresh,
  });

  response.cookies.set(CookieName.ACCESS_TOKEN, access, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60,
    path: '/',
  });

  response.cookies.set(CookieName.REFRESH_TOKEN, refresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}, 'Login');
