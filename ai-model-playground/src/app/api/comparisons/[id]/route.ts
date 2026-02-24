import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt';
import { HttpStatus } from '@/types/enums';
import type { PrismaModelResponse } from '@/types/comparison';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromRequest(request);

    const comparison = await prisma.comparison.findUnique({
      where: { id },
      include: { responses: true },
    }) as { id: string; userId: string | null; prompt: string; saved: boolean; createdAt: Date; responses: PrismaModelResponse[] } | null;

    if (!comparison) {
      return NextResponse.json(
        { error: 'Comparison not found' },
        { status: HttpStatus.NOT_FOUND }
      );
    }

    // Check access: only owner can view saved comparisons
    if (comparison.saved && comparison.userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: HttpStatus.FORBIDDEN }
      );
    }

    return NextResponse.json({
      comparison_id: comparison.id,
      user_id: comparison.userId,
      prompt: comparison.prompt,
      saved: comparison.saved,
      created_at: comparison.createdAt,
      responses: comparison.responses.map((modelResponse) => ({
        model_id: modelResponse.modelId,
        provider: modelResponse.provider,
        response_text: modelResponse.responseText,
        status: modelResponse.status,
        error_message: modelResponse.errorMessage,
        metrics: {
          response_time_ms: modelResponse.responseTimeMs,
          prompt_tokens: modelResponse.promptTokens,
          completion_tokens: modelResponse.completionTokens,
          total_tokens: modelResponse.totalTokens,
          estimated_cost: modelResponse.estimatedCost ? Number(modelResponse.estimatedCost) : 0,
        },
      })),
    });
  } catch (error: unknown) {
    console.error('Get comparison error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: HttpStatus.INTERNAL_SERVER_ERROR }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: HttpStatus.UNAUTHORIZED }
      );
    }

    const comparison = await prisma.comparison.findUnique({
      where: { id },
    });

    if (!comparison) {
      return NextResponse.json(
        { error: 'Comparison not found' },
        { status: HttpStatus.NOT_FOUND }
      );
    }

    if (comparison.userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: HttpStatus.FORBIDDEN }
      );
    }

    await prisma.comparison.delete({
      where: { id },
    });

    return new NextResponse(null, { status: HttpStatus.NO_CONTENT });
  } catch (error: unknown) {
    console.error('Delete comparison error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: HttpStatus.INTERNAL_SERVER_ERROR }
    );
  }
}
