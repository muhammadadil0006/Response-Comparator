/**
 * Unified AI Gateway Adapter
 *
 * Uses Vercel AI Gateway via the AI SDK (@ai-sdk/gateway) to route all
 * model requests through a single API key and endpoint.
 *
 * Model strings use the gateway format: "provider/model-name"
 * (e.g., "openai/gpt-4o", "anthropic/claude-sonnet-4.5").
 */
import { generateText, streamText } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import {
  BaseAIAdapter,
  type AIResponse,
  type StreamEvent,
  type ToolCall,
  type FinishReason,
} from '@/lib/ai-providers/base';
import { MODEL_CONFIGS } from '@/types/models';
import { MODEL_ID_TO_PROVIDER } from '@/types/enums';
import type { ModelId } from '@/types/enums';

// Single gateway instance — reads AI_GATEWAY_API_KEY env var
const apiKey = process.env.AI_GATEWAY_API_KEY;
console.log('[GatewayAdapter] Initializing gateway, API key present:', !!apiKey, ', key prefix:', apiKey?.substring(0, 8));
const gateway = createGateway({
  apiKey,
});

/** Error categories for richer frontend handling */
export type GatewayErrorCategory =
  | 'rate-limit'
  | 'capability'
  | 'auth'
  | 'not-found'
  | 'timeout'
  | 'content-filter'
  | 'server'
  | 'unknown';

export class GatewayError extends Error {
  category: GatewayErrorCategory;
  retryAfterMs?: number;

  constructor(message: string, category: GatewayErrorCategory, retryAfterMs?: number) {
    super(message);
    this.name = 'GatewayError';
    this.category = category;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Known patterns that indicate a model capability limitation (not a bug) */
const CAPABILITY_PATTERNS = [
  /cannot (generate|create|produce|make) images?/i,
  /image generation.*(not|isn't|is not) (supported|available)/i,
  /does not support (image|audio|video|file)/i,
  /unsupported (modality|capability|feature|content type)/i,
  /can'?t (generate|create|produce) (image|audio|video|picture)/i,
  /text[- ]only model/i,
  /not capable of/i,
  /no (image|audio|video|vision) (generation|capability|support)/i,
  /modality.*not supported/i,
  /content type.*not supported/i,
];

/** Known patterns that indicate content was filtered for safety */
const CONTENT_FILTER_PATTERNS = [
  /content[_ ]filter/i,
  /safety (filter|system|policy)/i,
  /violat(es?|ing) .*(policy|guidelines|terms)/i,
  /blocked by/i,
  /harmful content/i,
  /inappropriate/i,
];

/**
 * Re-throw gateway errors with a human-readable message and category.
 * Handles model-not-found, auth errors, rate limiting, capability limits, etc.
 */
function wrapGatewayError(error: unknown, modelId: string): never {
  if (error instanceof Error) {
    const name = (error as { type?: string }).type ?? error.name ?? '';
    const status = (error as { statusCode?: number }).statusCode;
    const msg = error.message || '';

    // Check for capability-related errors first (can appear as 400/422)
    if (CAPABILITY_PATTERNS.some((pattern) => pattern.test(msg))) {
      throw new GatewayError(
        `This model cannot fulfill that request. "${modelId}" is a text-only model and doesn't support generating images, audio, or other media. Try rephrasing your prompt.`,
        'capability'
      );
    }

    // Check for content filter
    if (CONTENT_FILTER_PATTERNS.some((pattern) => pattern.test(msg))) {
      throw new GatewayError(
        `Content filtered: "${modelId}" declined the request due to safety policies. Try rephrasing your prompt.`,
        'content-filter'
      );
    }

    if (name === 'model_not_found' || status === 404) {
      throw new GatewayError(
        `Model "${modelId}" is not available on the Vercel AI Gateway. ` +
          'Check https://ai-gateway.vercel.sh/v1/models for supported models.',
        'not-found'
      );
    }
    if (status === 401 || status === 403) {
      throw new GatewayError(
        'AI Gateway authentication failed. Check your AI_GATEWAY_API_KEY.',
        'auth'
      );
    }
    if (status === 429) {
      // Try to parse Retry-After from the error
      const retryMatch = msg.match(/retry.after[:\s]*(\d+)/i);
      const retryAfterMs = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : 30_000;
      throw new GatewayError(
        `Rate limit reached for "${modelId}". Please wait a moment and try again.`,
        'rate-limit',
        retryAfterMs
      );
    }
    if (status === 400) {
      // Additional capability check for 400 errors
      throw new GatewayError(
        `Bad request to AI Gateway for model "${modelId}": ${msg}`,
        msg.toLowerCase().includes('unsupported') ? 'capability' : 'unknown'
      );
    }
    if (status === 408 || name === 'AbortError') {
      throw new GatewayError(
        `Request to model "${modelId}" timed out. Please try again.`,
        'timeout'
      );
    }
    if (status === 422) {
      // 422 often means the model can't process the request type
      const isCapability = CAPABILITY_PATTERNS.some((p) => p.test(msg)) ||
        msg.toLowerCase().includes('unsupported');
      throw new GatewayError(
        isCapability
          ? `Model "${modelId}" cannot process this type of request: ${msg}`
          : `Model "${modelId}" rejected the request: ${msg}`,
        isCapability ? 'capability' : 'unknown'
      );
    }
    if (status && status >= 500) {
      throw new GatewayError(
        `AI Gateway server error (${status}) for model "${modelId}". Please try again later.`,
        'server'
      );
    }

    // Catch-all for any other Error with a message
    throw new GatewayError(
      `AI Gateway error for model "${modelId}": ${msg}`,
      'unknown'
    );
  }

  // Non-Error thrown values
  throw new GatewayError(
    `Unexpected AI Gateway error for model "${modelId}": ${String(error)}`,
    'unknown'
  );
}

export class GatewayAdapter extends BaseAIAdapter {
  readonly modelId: string;
  readonly provider: string;

  constructor(modelId: string) {
    super();
    this.modelId = modelId;
    this.provider =
      MODEL_ID_TO_PROVIDER[modelId as ModelId] ?? modelId.split('/')[0] ?? 'unknown';
    console.log(`[GatewayAdapter] Created adapter for model="${this.modelId}" provider="${this.provider}"`);
  }

  async sendPrompt(prompt: string): Promise<AIResponse> {
    console.log(`[GatewayAdapter.sendPrompt] model="${this.modelId}" prompt length=${prompt.length}`);
    const elapsed = this.measureTime();

    try {
      console.log(`[GatewayAdapter.sendPrompt] Calling generateText for "${this.modelId}"...`);
      const result = await generateText({
        model: gateway(this.modelId),
        prompt,
        maxOutputTokens: 4096,
      });

      const responseTimeMs = elapsed();
      const finishReason = this.normalizeFinishReason(result.finishReason);

      // Extract tool calls if the model returned any
      const toolCalls: ToolCall[] = (result.toolCalls ?? []).map((tc) => ({
        id: tc.toolCallId,
        name: tc.toolName,
        args: ('input' in tc ? tc.input : {}) as Record<string, unknown>,
      }));

      console.log(
        `[GatewayAdapter.sendPrompt] SUCCESS model="${this.modelId}" ` +
        `time=${responseTimeMs}ms tokens=${result.usage.totalTokens ?? 0} ` +
        `finishReason=${finishReason} toolCalls=${toolCalls.length} textLen=${result.text.length}`
      );

      return {
        text: result.text,
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
        responseTimeMs,
        finishReason,
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      };
    } catch (error) {
      console.error(`[GatewayAdapter.sendPrompt] FAILED model="${this.modelId}"`, error);
      wrapGatewayError(error, this.modelId);
    }
  }

  async *stream(prompt: string): AsyncIterable<StreamEvent> {
    console.log(`[GatewayAdapter.stream] model="${this.modelId}" prompt length=${prompt.length}`);
    try {
      console.log(`[GatewayAdapter.stream] Calling streamText for "${this.modelId}"...`);
      const result = streamText({
        model: gateway(this.modelId),
        prompt,
        maxOutputTokens: 4096,
      });

      let chunkCount = 0;

      // Use textStream for reliable text delivery.
      // fullStream was not emitting text-delta events through the Vercel AI Gateway.
      for await (const textPart of result.textStream) {
        if (textPart) {
          chunkCount++;
          if (chunkCount <= 3 || chunkCount % 50 === 0) {
            console.log(
              `[GatewayAdapter.stream] model="${this.modelId}" ` +
              `text chunk #${chunkCount} len=${textPart.length}`
            );
          }
          yield { type: 'text-delta', text: textPart, tokens: 1 };
        }
      }

      console.log(
        `[GatewayAdapter.stream] model="${this.modelId}" textStream done, chunks=${chunkCount}`
      );

      // Fallback: if textStream yielded nothing, try aggregated result.text
      if (chunkCount === 0) {
        console.warn(
          `[GatewayAdapter.stream] model="${this.modelId}" 0 text chunks, trying result.text fallback...`
        );
        try {
          const fullText = await result.text;
          console.log(
            `[GatewayAdapter.stream] model="${this.modelId}" result.text length=${fullText?.length ?? 0}`
          );
          if (fullText) {
            chunkCount = 1;
            yield {
              type: 'text-delta',
              text: fullText,
              tokens: Math.ceil(fullText.length / 4),
            };
          }
        } catch (fallbackErr) {
          console.warn(
            `[GatewayAdapter.stream] model="${this.modelId}" result.text fallback failed:`,
            fallbackErr
          );
        }
      }

      // Get metadata from result promises (resolves after stream completes)
      let finishReason: FinishReason = 'unknown';
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      try {
        const rawFinishReason = await result.finishReason;
        finishReason = this.normalizeFinishReason(rawFinishReason);
      } catch {
        console.warn(`[GatewayAdapter.stream] model="${this.modelId}" failed to get finishReason`);
      }

      try {
        const rawUsage = await result.usage;
        const inputTokens = (rawUsage as Record<string, number>)?.inputTokens ?? 0;
        const outputTokens = (rawUsage as Record<string, number>)?.outputTokens ?? 0;
        const totalTokens = (rawUsage as Record<string, number>)?.totalTokens ?? (inputTokens + outputTokens);
        usage = { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens };
      } catch {
        console.warn(`[GatewayAdapter.stream] model="${this.modelId}" failed to get usage`);
      }

      // Emit tool calls (extracted from result promise, since we don't pass tools this is usually empty)
      try {
        const rawToolCalls = await (result as unknown as { toolCalls: Promise<unknown[]> }).toolCalls;
        if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
          for (const tc of rawToolCalls) {
            const toolCall = tc as Record<string, unknown>;
            yield {
              type: 'tool-call' as const,
              toolCall: {
                id: (toolCall.toolCallId as string) ?? `tc-${Date.now()}`,
                name: (toolCall.toolName as string) ?? 'unknown',
                args: ((toolCall.input ?? toolCall.args ?? {}) as Record<string, unknown>),
              },
            };
          }
        }
      } catch {
        // No tool calls or property doesn't exist — expected
      }

      console.log(
        `[GatewayAdapter.stream] DONE model="${this.modelId}" ` +
        `chunks=${chunkCount} finish=${finishReason} usage=${JSON.stringify(usage)}`
      );

      // Emit single finish event with best available data
      yield {
        type: 'finish',
        finishReason,
        usage,
      };
    } catch (error) {
      console.error(`[GatewayAdapter.stream] FAILED model="${this.modelId}"`, error);
      wrapGatewayError(error, this.modelId);
    }
  }

  calculateCost(promptTokens: number, completionTokens: number): number {
    const config = MODEL_CONFIGS[this.modelId as ModelId];
    if (!config) return 0;
    const promptCost = promptTokens * config.pricing.promptPerToken;
    const completionCost = completionTokens * config.pricing.completionPerToken;
    return Number((promptCost + completionCost).toFixed(6));
  }
}

