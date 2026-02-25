import { NextResponse } from 'next/server';
import { HttpStatus } from '@/types/enums';

/**
 * @deprecated — Conversations have been removed.
 * Returns 410 Gone so old clients get a clear signal.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Conversations have been removed. Use /api/comparisons instead.' },
    { status: HttpStatus.GONE }
  );
}
