import type { AIAdapter } from '@/lib/ai-providers/base';
import { GatewayAdapter } from '@/lib/ai-providers/vercel-gateway';
import { ModelId } from '@/types/enums';

/**
 * Maps legacy model IDs (pre-gateway migration) to the new
 * Vercel AI Gateway "provider/model" format.
 */
const LEGACY_MODEL_MAP: Record<string, string> = {
  'gpt-4o': ModelId.GPT_4O,
  'claude-3-sonnet': ModelId.CLAUDE_SONNET,
  'anthropic/claude-3-5-sonnet-latest': ModelId.CLAUDE_SONNET,
  'grok-2': ModelId.GROK,
  'xai/grok-2-latest': ModelId.GROK,
};

function resolveModelId(modelId: string): string {
  return LEGACY_MODEL_MAP[modelId] ?? modelId;
}

const adapters: Record<ModelId, () => AIAdapter> = {
  [ModelId.GPT_4O]: () => new GatewayAdapter(ModelId.GPT_4O),
  [ModelId.CLAUDE_SONNET]: () => new GatewayAdapter(ModelId.CLAUDE_SONNET),
  [ModelId.GROK]: () => new GatewayAdapter(ModelId.GROK),
};

export function getAdapter(modelId: string): AIAdapter {
  const resolved = resolveModelId(modelId);
  console.log(`[getAdapter] input="${modelId}" resolved="${resolved}"`);
  const factory = adapters[resolved as ModelId];
  if (!factory) {
    console.log(`[getAdapter] No factory found for "${resolved}", creating dynamic GatewayAdapter`);
    return new GatewayAdapter(resolved);
  }
  console.log(`[getAdapter] Using registered factory for "${resolved}"`);
  return factory();
}

export function getAvailableModels(): ModelId[] {
  return Object.keys(adapters) as ModelId[];
}

export {
  type AIAdapter,
  type AIResponse,
  type StreamChunk,
  type StreamEvent,
  type ToolCall,
  type ToolCallChunk,
  type FinishChunk,
  type FinishReason,
} from '@/lib/ai-providers/base';
