import { prisma } from '@/lib/db/prisma';
import { getAdapter } from '@/lib/ai-providers';
import { GatewayError } from '@/lib/ai-providers/vercel-gateway';
import { extractErrorMessage } from '@/lib/utils/errors';
import { DEFAULT_MODELS } from '@/types/models';
import { SSEEventType } from '@/types/enums';

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2000;

/** Delay helper (exponential backoff with jitter) */
function delayMs(attempt: number, baseMs: number = BASE_DELAY_MS): Promise<void> {
  const ms = baseMs * Math.pow(2, attempt) + Math.random() * 500;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Categorize an error for the frontend */
function categorizeError(error: unknown): { message: string; category: string } {
  if (error instanceof GatewayError) {
    return { message: error.message, category: error.category };
  }
  return { message: extractErrorMessage(error, 'Unknown error'), category: 'unknown' };
}

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

/**
 * Ensure a comparison row exists; recreate if it was deleted.
 */
async function ensureComparison(
  comparisonId: string,
  prompt: string,
  ctx?: { userId?: string | null }
): Promise<{ id: string; existed: boolean }> {
  const existing = await prisma.comparison.findUnique({
    where: { id: comparisonId },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, existed: true };
  }

  // Comparison was deleted or never existed — recreate
  const created = await prisma.comparison.create({
    data: {
      id: comparisonId,
      userId: ctx?.userId ?? null,
      prompt,
      saved: true,
    },
  });
  return { id: created.id, existed: false };
}

/** Upsert a model response using the @@unique([comparisonId, modelId]) constraint. */
async function upsertModelResponse(data: {
  comparisonId: string;
  modelId: string;
  provider: string;
  responseText?: string;
  status: string;
  errorMessage?: string;
  responseTimeMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
}) {
  return prisma.modelResponse.upsert({
    where: {
      comparisonId_modelId: {
        comparisonId: data.comparisonId,
        modelId: data.modelId,
      },
    },
    create: {
      comparisonId: data.comparisonId,
      modelId: data.modelId,
      provider: data.provider,
      responseText: data.responseText ?? null,
      status: data.status,
      errorMessage: data.errorMessage ?? null,
      responseTimeMs: data.responseTimeMs ?? null,
      promptTokens: data.promptTokens ?? null,
      completionTokens: data.completionTokens ?? null,
      totalTokens: data.totalTokens ?? null,
      estimatedCost: data.estimatedCost ?? null,
    },
    update: {
      provider: data.provider,
      responseText: data.responseText ?? null,
      status: data.status,
      errorMessage: data.errorMessage ?? null,
      responseTimeMs: data.responseTimeMs ?? null,
      promptTokens: data.promptTokens ?? null,
      completionTokens: data.completionTokens ?? null,
      totalTokens: data.totalTokens ?? null,
      estimatedCost: data.estimatedCost ?? null,
    },
  });
}

export class ComparisonService {
  async executeComparison(
    prompt: string,
    userId: string | null,
    models: string[] = DEFAULT_MODELS
  ): Promise<ComparisonResult> {
    // Always create a comparison record in the DB
    const comparison = await prisma.comparison.create({
      data: {
        userId,
        prompt,
        saved: true,
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

          // Save response to DB (upsert for idempotency)
          await upsertModelResponse({
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

          await upsertModelResponse({
            comparisonId: comparison.id,
            modelId: adapter.modelId,
            provider: adapter.provider,
            status: 'error',
            errorMessage,
            responseTimeMs: 0,
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
    models: string[] = DEFAULT_MODELS
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
              saved: true,
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

              console.log(`[ComparisonService.stream] Starting model="${adapter.modelId}" provider="${adapter.provider}"`);
              sendEvent(SSEEventType.MODEL_STARTED, {
                modelId: adapter.modelId,
                provider: adapter.provider,
                comparisonId: comparison.id,
              });

              // Retry loop for rate-limited requests
              let lastError: unknown = null;
              for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                if (attempt > 0) {
                  const waitMs = lastError instanceof GatewayError && lastError.retryAfterMs
                    ? lastError.retryAfterMs
                    : BASE_DELAY_MS * Math.pow(2, attempt - 1);
                  console.log(`[ComparisonService.stream] Retrying model="${adapter.modelId}" attempt=${attempt} after ${waitMs}ms`);
                  sendEvent(SSEEventType.MODEL_CHUNK, {
                    modelId: adapter.modelId,
                    comparisonId: comparison.id,
                    chunk: '', // empty chunk signals retry in progress
                    retrying: true,
                    attempt,
                    waitMs,
                  });
                  await delayMs(attempt - 1, lastError instanceof GatewayError && lastError.retryAfterMs ? lastError.retryAfterMs / 2 : BASE_DELAY_MS);
                }

                try {
                  let fullText = '';
                  let tokenCount = 0;
                  let streamFinishReason: string = 'unknown';
                  let streamUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
                  const toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];

                  for await (const event of adapter.stream(prompt)) {
                    switch (event.type) {
                      case 'text-delta':
                        fullText += event.text;
                        tokenCount += event.tokens;
                        sendEvent(SSEEventType.MODEL_CHUNK, {
                          modelId: adapter.modelId,
                          comparisonId: comparison.id,
                          chunk: event.text,
                        });
                        break;

                      case 'tool-call':
                        toolCalls.push(event.toolCall);
                        sendEvent(SSEEventType.MODEL_TOOL_CALL, {
                          modelId: adapter.modelId,
                          comparisonId: comparison.id,
                          toolCall: event.toolCall,
                        });
                        break;

                      case 'finish':
                        streamFinishReason = event.finishReason;
                        streamUsage = event.usage;
                        break;
                    }
                  }

                  const responseTimeMs = Math.round(
                    performance.now() - startTime
                  );
                  // Prefer SDK-reported usage over heuristic counts
                  const promptTokens = streamUsage?.promptTokens ?? Math.ceil(prompt.length / 4);
                  const completionTokens = streamUsage?.completionTokens ?? tokenCount;
                  const totalTokens = streamUsage?.totalTokens ?? (promptTokens + completionTokens);
                  const estimatedCost = adapter.calculateCost(
                    promptTokens,
                    completionTokens
                  );

                  // Save completed response to DB (upsert for idempotency)
                  await upsertModelResponse({
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
                  });

                  sendEvent(SSEEventType.MODEL_COMPLETED, {
                    modelId: adapter.modelId,
                    comparisonId: comparison.id,
                    finishReason: streamFinishReason,
                    metrics: {
                      response_time_ms: responseTimeMs,
                      prompt_tokens: promptTokens,
                      completion_tokens: completionTokens,
                      total_tokens: totalTokens,
                      estimated_cost: estimatedCost,
                    },
                  });

                  // Success — break out of retry loop
                  lastError = null;
                  break;
                } catch (error: unknown) {
                  lastError = error;
                  // Only retry on rate-limit errors
                  if (error instanceof GatewayError && error.category === 'rate-limit' && attempt < MAX_RETRIES) {
                    continue;
                  }
                  // Non-retryable error or max retries exceeded
                  const { message: errorMessage, category } = categorizeError(error);
                  console.error('[ComparisonService][stream][model-error]', {
                    modelId: adapter.modelId,
                    provider: adapter.provider,
                    error: errorMessage,
                    category,
                    attempt,
                  });

                  // Save error response to DB (upsert for idempotency)
                  await upsertModelResponse({
                    comparisonId: comparison.id,
                    modelId: adapter.modelId,
                    provider: adapter.provider,
                    status: 'error',
                    errorMessage,
                    responseTimeMs: Math.round(
                      performance.now() - startTime
                    ),
                  });

                  sendEvent(SSEEventType.MODEL_ERROR, {
                    modelId: adapter.modelId,
                    comparisonId: comparison.id,
                    error: errorMessage,
                    category,
                  });
                  break; // Stop retrying
                }
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

  /**
   * Update an existing comparison with a new prompt.
   * Deletes ALL old model responses and regenerates them with the new prompt.
   */
  updateComparisonStreaming(
    comparisonId: string,
    prompt: string,
    models: string[] = DEFAULT_MODELS,
    ctx?: { userId?: string | null }
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
          // Verify comparison exists (recreate if deleted)
          const ensured = await ensureComparison(comparisonId, prompt, ctx);

          // Delete ALL old responses and update the prompt
          await prisma.modelResponse.deleteMany({
            where: { comparisonId },
          });
          await prisma.comparison.update({
            where: { id: comparisonId },
            data: { prompt },
          });

          const adapterEntries = models.map((modelId) => getAdapter(modelId));
          const resolvedModelIds = adapterEntries.map((a) => a.modelId);

          sendEvent(SSEEventType.COMPARISON_STARTED, {
            comparisonId,
            models: resolvedModelIds,
          });

          await Promise.allSettled(
            adapterEntries.map(async (adapter) => {
              const startTime = performance.now();

              sendEvent(SSEEventType.MODEL_STARTED, {
                modelId: adapter.modelId,
                provider: adapter.provider,
                comparisonId,
              });

              let lastError: unknown = null;
              for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                if (attempt > 0) {
                  const waitMs = lastError instanceof GatewayError && lastError.retryAfterMs
                    ? lastError.retryAfterMs
                    : BASE_DELAY_MS * Math.pow(2, attempt - 1);
                  console.log(`[ComparisonService.update] Retrying model="${adapter.modelId}" attempt=${attempt} after ${waitMs}ms`);
                  await delayMs(attempt - 1, lastError instanceof GatewayError && lastError.retryAfterMs ? lastError.retryAfterMs / 2 : BASE_DELAY_MS);
                }

                try {
                  let fullText = '';
                  let tokenCount = 0;
                  let streamFinishReason: string = 'unknown';
                  let streamUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
                  const toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];

                  for await (const event of adapter.stream(prompt)) {
                    switch (event.type) {
                      case 'text-delta':
                        fullText += event.text;
                        tokenCount += event.tokens;
                        sendEvent(SSEEventType.MODEL_CHUNK, {
                          modelId: adapter.modelId,
                          comparisonId,
                          chunk: event.text,
                        });
                        break;
                      case 'tool-call':
                        toolCalls.push(event.toolCall);
                        sendEvent(SSEEventType.MODEL_TOOL_CALL, {
                          modelId: adapter.modelId,
                          comparisonId,
                          toolCall: event.toolCall,
                        });
                        break;
                      case 'finish':
                        streamFinishReason = event.finishReason;
                        streamUsage = event.usage;
                        break;
                    }
                  }

                  const responseTimeMs = Math.round(performance.now() - startTime);
                  const promptTokens = streamUsage?.promptTokens ?? Math.ceil(prompt.length / 4);
                  const completionTokens = streamUsage?.completionTokens ?? tokenCount;
                  const totalTokens = streamUsage?.totalTokens ?? (promptTokens + completionTokens);
                  const estimatedCost = adapter.calculateCost(promptTokens, completionTokens);

                  await upsertModelResponse({
                    comparisonId,
                    modelId: adapter.modelId,
                    provider: adapter.provider,
                    responseText: fullText,
                    status: 'completed',
                    responseTimeMs,
                    promptTokens,
                    completionTokens,
                    totalTokens,
                    estimatedCost,
                  });

                  sendEvent(SSEEventType.MODEL_COMPLETED, {
                    modelId: adapter.modelId,
                    comparisonId,
                    finishReason: streamFinishReason,
                    metrics: {
                      response_time_ms: responseTimeMs,
                      prompt_tokens: promptTokens,
                      completion_tokens: completionTokens,
                      total_tokens: totalTokens,
                      estimated_cost: estimatedCost,
                    },
                  });
                  lastError = null;
                  break;
                } catch (error: unknown) {
                  lastError = error;
                  if (error instanceof GatewayError && error.category === 'rate-limit' && attempt < MAX_RETRIES) {
                    continue;
                  }
                  const { message: errorMessage, category } = categorizeError(error);
                  console.error('[ComparisonService][update][model-error]', {
                    modelId: adapter.modelId,
                    error: errorMessage,
                    category,
                    attempt,
                  });

                  await upsertModelResponse({
                    comparisonId,
                    modelId: adapter.modelId,
                    provider: adapter.provider,
                    status: 'error',
                    errorMessage,
                    responseTimeMs: Math.round(performance.now() - startTime),
                  });

                  sendEvent(SSEEventType.MODEL_ERROR, {
                    modelId: adapter.modelId,
                    comparisonId,
                    error: errorMessage,
                    category,
                  });
                  break;
                }
              }
            })
          );

          sendEvent(SSEEventType.COMPARISON_COMPLETED, { comparisonId });
          closeController();
        } catch (error: unknown) {
          console.error('[ComparisonService][update][fatal]', {
            error: extractErrorMessage(error, 'Unexpected error'),
          });
          sendEvent(SSEEventType.ERROR, {
            message: extractErrorMessage(error, 'Unexpected error'),
          });
          closeController();
        }
      },
    });
  }

  /**
   * Regenerate a single model's response within an existing comparison.
   * Deletes the old model_response row and streams a fresh one.
   */
  regenerateModelStreaming(
    comparisonId: string,
    prompt: string,
    modelId: string,
    ctx?: { userId?: string | null }
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
          // Verify comparison exists (recreate if deleted)
          const ensured = await ensureComparison(comparisonId, prompt, ctx);

          // Delete old response for THIS model only — other models are untouched
          await prisma.modelResponse.deleteMany({
            where: { comparisonId, modelId },
          });

          const adapter = getAdapter(modelId);

          sendEvent(SSEEventType.COMPARISON_STARTED, {
            comparisonId,
            models: [adapter.modelId],
          });

          const startTime = performance.now();

          sendEvent(SSEEventType.MODEL_STARTED, {
            modelId: adapter.modelId,
            provider: adapter.provider,
            comparisonId,
          });

          let lastError: unknown = null;
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (attempt > 0) {
              const waitMs = lastError instanceof GatewayError && lastError.retryAfterMs
                ? lastError.retryAfterMs
                : BASE_DELAY_MS * Math.pow(2, attempt - 1);
              console.log(`[ComparisonService.regenerate] Retrying model="${adapter.modelId}" attempt=${attempt} after ${waitMs}ms`);
              await delayMs(attempt - 1, lastError instanceof GatewayError && lastError.retryAfterMs ? lastError.retryAfterMs / 2 : BASE_DELAY_MS);
            }

            try {
              let fullText = '';
              let tokenCount = 0;
              let streamFinishReason: string = 'unknown';
              let streamUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
              const toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];

              for await (const event of adapter.stream(prompt)) {
                switch (event.type) {
                  case 'text-delta':
                    fullText += event.text;
                    tokenCount += event.tokens;
                    sendEvent(SSEEventType.MODEL_CHUNK, {
                      modelId: adapter.modelId,
                      comparisonId,
                      chunk: event.text,
                    });
                    break;
                  case 'tool-call':
                    toolCalls.push(event.toolCall);
                    sendEvent(SSEEventType.MODEL_TOOL_CALL, {
                      modelId: adapter.modelId,
                      comparisonId,
                      toolCall: event.toolCall,
                    });
                    break;
                  case 'finish':
                    streamFinishReason = event.finishReason;
                    streamUsage = event.usage;
                    break;
                }
              }

              const responseTimeMs = Math.round(performance.now() - startTime);
              const promptTokens = streamUsage?.promptTokens ?? Math.ceil(prompt.length / 4);
              const completionTokens = streamUsage?.completionTokens ?? tokenCount;
              const totalTokens = streamUsage?.totalTokens ?? (promptTokens + completionTokens);
              const estimatedCost = adapter.calculateCost(promptTokens, completionTokens);

              await upsertModelResponse({
                comparisonId,
                modelId: adapter.modelId,
                provider: adapter.provider,
                responseText: fullText,
                status: 'completed',
                responseTimeMs,
                promptTokens,
                completionTokens,
                totalTokens,
                estimatedCost,
              });

              sendEvent(SSEEventType.MODEL_COMPLETED, {
                modelId: adapter.modelId,
                comparisonId,
                finishReason: streamFinishReason,
                metrics: {
                  response_time_ms: responseTimeMs,
                  prompt_tokens: promptTokens,
                  completion_tokens: completionTokens,
                  total_tokens: totalTokens,
                  estimated_cost: estimatedCost,
                },
              });
              lastError = null;
              break;
            } catch (error: unknown) {
              lastError = error;
              if (error instanceof GatewayError && error.category === 'rate-limit' && attempt < MAX_RETRIES) {
                continue;
              }
              const { message: errorMessage, category } = categorizeError(error);
              console.error('[ComparisonService][regenerate][model-error]', {
                modelId: adapter.modelId,
                error: errorMessage,
                category,
                attempt,
              });

              await upsertModelResponse({
                comparisonId,
                modelId: adapter.modelId,
                provider: adapter.provider,
                status: 'error',
                errorMessage,
                responseTimeMs: Math.round(performance.now() - startTime),
              });

              sendEvent(SSEEventType.MODEL_ERROR, {
                modelId: adapter.modelId,
                comparisonId,
                error: errorMessage,
                category,
              });
              break;
            }
          }

          sendEvent(SSEEventType.COMPARISON_COMPLETED, { comparisonId });
          closeController();
        } catch (error: unknown) {
          console.error('[ComparisonService][regenerate][fatal]', {
            error: extractErrorMessage(error, 'Unexpected error'),
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
