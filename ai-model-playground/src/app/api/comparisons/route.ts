import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt';
import { ComparisonSchema } from '@/lib/auth/validation';
import { comparisonService } from '@/lib/services/comparison.service';
import { checkRateLimit } from '@/lib/utils/rate-limit';
import { DEFAULT_MODELS } from '@/types/models';
import { z } from 'zod';
import { HttpStatus } from '@/types/enums';
import type { PrismaComparisonWithResponses } from '@/types/comparison';

export async function POST(request: NextRequest) {
  console.log('[API POST /comparisons] Request received');
  try {
    const userId = getUserIdFromRequest(request);
    console.log('[API POST /comparisons] userId:', userId);

    // Rate limiting
    const identifier = userId || request.headers.get('x-forwarded-for') || 'anonymous';
    const { allowed, remaining, limit } = checkRateLimit(identifier, !!userId);

    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: HttpStatus.TOO_MANY_REQUESTS,
          headers: {
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const body = await request.json();
    console.log('[API POST /comparisons] Request body:', JSON.stringify(body));
    const { prompt, models, stream, comparisonId } = ComparisonSchema.parse(body);
    console.log('[API POST /comparisons] Parsed -', { prompt: prompt.substring(0, 50), models, stream, comparisonId });

    const selectedModels = models || DEFAULT_MODELS;
    console.log('[API POST /comparisons] selectedModels:', selectedModels);

    // Regenerate a single model within an existing comparison
    if (stream && comparisonId && selectedModels.length === 1) {
      console.log('[API POST /comparisons] Using REGENERATE mode for', comparisonId, selectedModels[0]);
      const readableStream = comparisonService.regenerateModelStreaming(
        comparisonId,
        prompt,
        selectedModels[0],
        { userId }
      );

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-RateLimit-Remaining': String(remaining),
        },
      });
    }

    // Update existing comparison with new prompt (regenerate all models)
    if (stream && comparisonId) {
      console.log('[API POST /comparisons] Using UPDATE mode for', comparisonId);
      const readableStream = comparisonService.updateComparisonStreaming(
        comparisonId,
        prompt,
        selectedModels,
        { userId }
      );

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-RateLimit-Remaining': String(remaining),
        },
      });
    }

    // Streaming response
    if (stream) {
      console.log('[API POST /comparisons] Using STREAMING mode');
      const readableStream = comparisonService.createStreamingResponse(
        prompt,
        userId,
        selectedModels
      );

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-RateLimit-Remaining': String(remaining),
        },
      });
    }

    console.log('[API POST /comparisons] Using NON-STREAMING mode');
    // Non-streaming response
    const result = await comparisonService.executeComparison(
      prompt,
      userId,
      selectedModels
    );

    // Fetch full comparison from DB
    const comparison = await prisma.comparison.findUnique({
      where: { id: result.comparisonId },
      include: { responses: true },
    });

    return NextResponse.json(
      {
        comparison_id: comparison?.id,
        user_id: comparison?.userId,
        prompt: comparison?.prompt,
        saved: comparison?.saved,
        created_at: comparison?.createdAt,
        responses: result.responses.map((modelResponse) => ({
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
            estimated_cost: modelResponse.estimatedCost,
          },
        })),
      },
      {
        status: HttpStatus.CREATED,
        headers: {
          'X-RateLimit-Remaining': String(remaining),
        },
      }
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => e.message).join('. ');
      return NextResponse.json(
        { error: messages || 'Invalid input' },
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    const { handleApiError } = await import('@/lib/utils/api-error-handler');
    return handleApiError(error, 'Comparison');
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: HttpStatus.UNAUTHORIZED }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const [comparisons, total]: [PrismaComparisonWithResponses[], number] = await Promise.all([
      prisma.comparison.findMany({
        where: { userId },
        include: { responses: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.comparison.count({
        where: { userId },
      }),
    ]);

    return NextResponse.json({
      comparisons: comparisons.map((comparisonRecord) => ({
        comparison_id: comparisonRecord.id,
        user_id: comparisonRecord.userId,
        prompt: comparisonRecord.prompt,
        saved: comparisonRecord.saved,
        created_at: comparisonRecord.createdAt,
        responses: comparisonRecord.responses.map((modelResponse) => ({
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
            estimated_cost: modelResponse.estimatedCost
              ? Number(modelResponse.estimatedCost)
              : 0,
          },
        })),
      })),
      total,
      limit,
      offset,
    });
  } catch (error: unknown) {
    const { handleApiError } = await import('@/lib/utils/api-error-handler');
    return handleApiError(error, 'ListComparisons');
  }
}
