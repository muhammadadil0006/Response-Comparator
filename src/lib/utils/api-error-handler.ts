import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpStatus } from '@/types/enums';
import { AppError } from '@/lib/utils/errors';

/**
 * Generic API error handler.
 *
 * Wraps any API route handler so that all thrown errors are converted into
 * appropriate JSON responses without duplicating error-handling logic.
 *
 * Usage:
 *   export const POST = withErrorHandler(async (request) => { ... });
 *   export const GET  = withErrorHandler(async (request, ctx) => { ... });
 */
export function withErrorHandler<
  TArgs extends unknown[],
>(
  handler: (...args: TArgs) => Promise<NextResponse | Response>,
  label?: string,
) {
  return async (...args: TArgs): Promise<NextResponse | Response> => {
    try {
      return await handler(...args);
    } catch (error: unknown) {
      return handleApiError(error, label);
    }
  };
}

/**
 * Convert an unknown error into a NextResponse with the correct status code
 * and a user-facing message.
 */
export function handleApiError(error: unknown, label?: string): NextResponse {
  const tag = label ? `[${label}]` : '[API]';
  console.error(`${tag} Error:`, error);

  // ── Zod validation ────────────────────────────────────────────────────
  if (error instanceof z.ZodError) {
    const messages = error.errors.map((e) => e.message).join('. ');
    return NextResponse.json(
      { error: messages || 'Invalid input' },
      { status: HttpStatus.BAD_REQUEST },
    );
  }

  // ── App-level errors (AppError subclasses) ────────────────────────────
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode },
    );
  }

  // ── Prisma: known request error (constraint, missing table, etc.) ─────
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaMsg = getPrismaErrorMessage(error);
    return NextResponse.json(
      { error: prismaMsg },
      { status: HttpStatus.INTERNAL_SERVER_ERROR },
    );
  }

  // ── Prisma: client initialisation (DB unreachable, bad URL, etc.) ─────
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json(
      { error: 'Unable to connect to the database. Please try again later.' },
      { status: HttpStatus.INTERNAL_SERVER_ERROR },
    );
  }

  // ── Prisma: validation error (wrong field type, etc.) ─────────────────
  if (error instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      { error: 'A data validation error occurred. Please check your input.' },
      { status: HttpStatus.BAD_REQUEST },
    );
  }

  // ── Generic Error ─────────────────────────────────────────────────────
  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: HttpStatus.INTERNAL_SERVER_ERROR },
    );
  }

  // ── Catch-all ─────────────────────────────────────────────────────────
  return NextResponse.json(
    { error: 'An unexpected error occurred. Please try again.' },
    { status: HttpStatus.INTERNAL_SERVER_ERROR },
  );
}

/**
 * Map common Prisma error codes to user-friendly messages.
 */
function getPrismaErrorMessage(error: Prisma.PrismaClientKnownRequestError): string {
  switch (error.code) {
    case 'P2000':
      return 'The provided value is too long for this field.';
    case 'P2002':
      return 'A record with this value already exists.';
    case 'P2003':
      return 'A related record was not found.';
    case 'P2021':
      return 'Database tables are not set up. Please run migrations.';
    case 'P2025':
      return 'The requested record was not found.';
    default:
      return 'Service temporarily unavailable. Please try again later.';
  }
}
