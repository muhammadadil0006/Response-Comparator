import { prisma } from '@/lib/db/prisma';
import { getAdapter } from '@/lib/ai-providers';
import { extractErrorMessage } from '@/lib/utils/errors';
import { DEFAULT_MODELS } from '@/types/models';
import { SSEEventType } from '@/types/enums';

export interface ComparisonResult {
  comparisonId: string;
  responses: Array<{
    modelId: string;
    provider: string;
    responseText: string;
    status: string;
    errorMessage?: string;
    responseTimeMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  }>;
}

export class ComparisonService {
  async executeComparison(
    prompt: string,
    userId: string | null,
    models: string[] = DEFAULT_MODELS,
    save: boolean = false
  ): Promise<ComparisonResult> {
    // Create comparison record
    const comparison = await prisma.comparison.create({
      data: {
        userId,
        prompt,
        saved: save && !!userId,
      },
    });

    // Execute all models in parallel
    const results = await Promise.allSettled(
      models.map(async (modelId) => {
        const adapter = getAdapter(modelId);

        try {
          const response = await adapter.sendPrompt(prompt);
          const cost = adapter.calculateCost(
            response.promptTokens,
            response.completionTokens
          );

          // Save response to DB
          await prisma.modelResponse.create({
            data: {
              comparisonId: comparison.id,
              modelId: adapter.modelId,
              provider: adapter.provider,
              responseText: response.text,
              status: 'completed',
              responseTimeMs: response.responseTimeMs,
              promptTokens: response.promptTokens,
              completionTokens: response.completionTokens,
              totalTokens: response.totalTokens,
              estimatedCost: cost,
            },
          });

          return {
            modelId: adapter.modelId,
            provider: adapter.provider,
            responseText: response.text,
            status: 'completed' as const,
            responseTimeMs: response.responseTimeMs,
            promptTokens: response.promptTokens,
            completionTokens: response.completionTokens,
            totalTokens: response.totalTokens,
            estimatedCost: cost,
          };
        } catch (error) {
          const errorMessage = extractErrorMessage(error, 'Unknown error');
          console.error('[ComparisonService][executeComparison][model]', {
            modelId: adapter.modelId,
            provider: adapter.provider,
            error: errorMessage,
            rawError: error,
          });

          await prisma.modelResponse.create({
            data: {
              comparisonId: comparison.id,
              modelId: adapter.modelId,
              provider: adapter.provider,
              status: 'error',
              errorMessage,
              responseTimeMs: 0,
            },
          });

          return {
            modelId: adapter.modelId,
            provider: adapter.provider,
            responseText: '',
            status: 'error' as const,
            errorMessage,
            responseTimeMs: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
          };
        }
      })
    );

    const responses = results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        modelId: 'unknown',
        provider: 'unknown',
        responseText: '',
        status: 'error' as const,
        errorMessage: extractErrorMessage(result.reason, 'Unexpected error'),
        responseTimeMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      };
    });

    return {
      comparisonId: comparison.id,
      responses,
    };
  }

  createStreamingResponse(
    prompt: string,
    userId: string | null,
    models: string[] = DEFAULT_MODELS,
    save: boolean = false
  ): ReadableStream {
    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controller) {
        let closed = false;

        const sendEvent = (event: string, data: unknown) => {
          if (closed) return;
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          } catch {
            closed = true;
          }
        };

        const closeController = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed
          }
        };

        try {
          // Create comparison record
          const comparison = await prisma.comparison.create({
            data: {
              userId,
              prompt,
              saved: save && !!userId,
            },
          });

          // Create adapters and resolve model IDs upfront
          const adapterEntries = models.map((modelId) => {
            const adapter = getAdapter(modelId);
            return adapter;
          });
          const resolvedModelIds = adapterEntries.map((a) => a.modelId);

          console.log('[ComparisonService.stream] Comparison created:', comparison.id, 'models:', models, 'resolved:', resolvedModelIds);
          sendEvent(SSEEventType.COMPARISON_STARTED, {
            comparisonId: comparison.id,
            models: resolvedModelIds,
          });

          // Execute models in parallel with streaming
          await Promise.allSettled(
            adapterEntries.map(async (adapter) => {
              const startTime = performance.now();
              let fullText = '';
              let tokenCount = 0;

              console.log(`[ComparisonService.stream] Starting model="${adapter.modelId}" provider="${adapter.provider}"`);
              sendEvent(SSEEventType.MODEL_STARTED, {
                modelId: adapter.modelId,
                provider: adapter.provider,
                comparisonId: comparison.id,
              });

              try {
                for await (const chunk of adapter.stream(prompt)) {
                  fullText += chunk.text;
                  tokenCount += chunk.tokens;

                  sendEvent(SSEEventType.MODEL_CHUNK, {
                    modelId: adapter.modelId,
                    comparisonId: comparison.id,
                    chunk: chunk.text,
                  });
                }

                const responseTimeMs = Math.round(
                  performance.now() - startTime
                );
                const promptTokens = Math.ceil(prompt.length / 4);
                const completionTokens = tokenCount;
                const totalTokens = promptTokens + completionTokens;
                const estimatedCost = adapter.calculateCost(
                  promptTokens,
                  completionTokens
                );

                // Save completed response to DB independently
                await prisma.modelResponse.create({
                  data: {
                    comparisonId: comparison.id,
                    modelId: adapter.modelId,
                    provider: adapter.provider,
                    responseText: fullText,
                    status: 'completed',
                    responseTimeMs,
                    promptTokens,
                    completionTokens,
                    totalTokens,
                    estimatedCost,
                  },
                });

                sendEvent(SSEEventType.MODEL_COMPLETED, {
                  modelId: adapter.modelId,
                  comparisonId: comparison.id,
                  metrics: {
                    response_time_ms: responseTimeMs,
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    total_tokens: totalTokens,
                    estimated_cost: estimatedCost,
                  },
                });
              } catch (error: unknown) {
                const errorMessage = extractErrorMessage(error, 'Unknown error');
                console.error('[ComparisonService][stream][model-error]', {
                  modelId: adapter.modelId,
                  provider: adapter.provider,
                  error: errorMessage,
                });

                // Save error response to DB independently
                await prisma.modelResponse.create({
                  data: {
                    comparisonId: comparison.id,
                    modelId: adapter.modelId,
                    provider: adapter.provider,
                    status: 'error',
                    errorMessage,
                    responseTimeMs: Math.round(
                      performance.now() - startTime
                    ),
                  },
                });

                sendEvent(SSEEventType.MODEL_ERROR, {
                  modelId: adapter.modelId,
                  comparisonId: comparison.id,
                  error: errorMessage,
                });
              }
            })
          );

          sendEvent(SSEEventType.COMPARISON_COMPLETED, {
            comparisonId: comparison.id,
          });

          closeController();
        } catch (error: unknown) {
          console.error('[ComparisonService][stream][fatal]', {
            error: extractErrorMessage(error, 'Unexpected error'),
            rawError: error,
          });
          sendEvent(SSEEventType.ERROR, {
            message: extractErrorMessage(error, 'Unexpected error'),
          });
          closeController();
        }
      },
    });
  }
}

export const comparisonService = new ComparisonService();
