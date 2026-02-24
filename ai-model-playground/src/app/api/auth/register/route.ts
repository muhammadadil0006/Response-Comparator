import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth/jwt';
import { RegisterSchema } from '@/lib/auth/validation';
import { CookieName, HttpStatus } from '@/types/enums';
import { withErrorHandler } from '@/lib/utils/api-error-handler';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { email, password, first_name, last_name } = RegisterSchema.parse(body);

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return NextResponse.json(
      { error: 'Email already registered' },
      { status: HttpStatus.CONFLICT }
    );
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: first_name,
      lastName: last_name,
    },
  });

  const access = generateAccessToken(user.id, user.email);
  const refresh = generateRefreshToken(user.id, user.email);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refresh,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const response = NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        is_active: user.isActive,
      },
      access,
      refresh,
    },
    { status: HttpStatus.CREATED }
  );

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
}, 'Register');
