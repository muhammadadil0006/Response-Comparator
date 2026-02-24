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
import { BaseAIAdapter, type AIResponse, type StreamChunk } from '@/lib/ai-providers/base';
import { MODEL_CONFIGS } from '@/types/models';
import { MODEL_ID_TO_PROVIDER } from '@/types/enums';
import type { ModelId } from '@/types/enums';

// Single gateway instance — reads AI_GATEWAY_API_KEY env var
const apiKey = process.env.AI_GATEWAY_API_KEY;
console.log('[GatewayAdapter] Initializing gateway, API key present:', !!apiKey, ', key prefix:', apiKey?.substring(0, 8));
const gateway = createGateway({
  apiKey,
});

/**
 * Re-throw gateway errors with a human-readable message.
 * Handles model-not-found, auth errors, rate limiting, etc.
 */
function wrapGatewayError(error: unknown, modelId: string): never {
  if (error instanceof Error) {
    const name = (error as { type?: string }).type ?? error.name ?? '';
    const status = (error as { statusCode?: number }).statusCode;

    if (name === 'model_not_found' || status === 404) {
      throw new Error(
        `Model "${modelId}" is not available on the Vercel AI Gateway. ` +
          'Check https://ai-gateway.vercel.sh/v1/models for supported models.'
      );
    }
    if (status === 401 || status === 403) {
      throw new Error(
        'AI Gateway authentication failed. Check your AI_GATEWAY_API_KEY.'
      );
    }
    if (status === 429) {
      throw new Error(
        'AI Gateway rate limit exceeded. Please try again shortly.'
      );
    }
    if (status === 400) {
      throw new Error(
        `Bad request to AI Gateway for model "${modelId}": ${error.message}`
      );
    }
    if (status === 408 || name === 'AbortError') {
      throw new Error(
        `Request to model "${modelId}" timed out. Please try again.`
      );
    }
    if (status === 422) {
      throw new Error(
        `Model "${modelId}" rejected the request: ${error.message}`
      );
    }
    if (status && status >= 500) {
      throw new Error(
        `AI Gateway server error (${status}) for model "${modelId}". Please try again later.`
      );
    }

    // Catch-all for any other Error with a message
    throw new Error(
      `AI Gateway error for model "${modelId}": ${error.message}`
    );
  }

  // Non-Error thrown values
  throw new Error(
    `Unexpected AI Gateway error for model "${modelId}": ${String(error)}`
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
        maxTokens: 4096,
      });

      const responseTimeMs = elapsed();
      console.log(`[GatewayAdapter.sendPrompt] SUCCESS model="${this.modelId}" time=${responseTimeMs}ms tokens=${result.usage.totalTokens} textLen=${result.text.length}`);

      return {
        text: result.text,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        responseTimeMs,
      };
    } catch (error) {
      console.error(`[GatewayAdapter.sendPrompt] FAILED model="${this.modelId}"`, error);
      wrapGatewayError(error, this.modelId);
    }
  }

  async *stream(prompt: string): AsyncIterable<StreamChunk> {
    console.log(`[GatewayAdapter.stream] model="${this.modelId}" prompt length=${prompt.length}`);
    try {
      console.log(`[GatewayAdapter.stream] Calling streamText for "${this.modelId}"...`);
      const result = streamText({
        model: gateway(this.modelId),
        prompt,
        maxTokens: 4096,
      });

      let chunkCount = 0;
      for await (const textPart of result.textStream) {
        if (textPart) {
          chunkCount++;
          if (chunkCount <= 3 || chunkCount % 50 === 0) {
            console.log(`[GatewayAdapter.stream] model="${this.modelId}" chunk #${chunkCount} len=${textPart.length}`);
          }
          yield { text: textPart, tokens: 1 };
        }
      }
      console.log(`[GatewayAdapter.stream] DONE model="${this.modelId}" total chunks=${chunkCount}`);
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

