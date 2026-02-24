import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt';
import { HttpStatus } from '@/types/enums';
import { withErrorHandler } from '@/lib/utils/api-error-handler';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const userId = getUserIdFromRequest(request);

  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: HttpStatus.UNAUTHORIZED }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: HttpStatus.NOT_FOUND }
    );
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    is_active: user.isActive,
  });
}, 'GetMe');
