import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    // Run a lightweight query to verify the DB connection is alive.
    // $queryRaw returns the DB server time — confirms round-trip success.
    const result = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW() as now`;

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      serverTime: result[0].now,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        status: 'error',
        database: 'unreachable',
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
