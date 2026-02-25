import { ModelId, Provider } from '@/types/enums';

export interface ModelConfig {
  id: ModelId;
  name: string;
  provider: Provider;
  maxTokens: number;
  pricing: {
    promptPerToken: number;
    completionPerToken: number;
  };
}

export const MODEL_CONFIGS: Record<ModelId, ModelConfig> = {
  [ModelId.GPT_4O]: {
    id: ModelId.GPT_4O,
    name: 'GPT-4o',
    provider: Provider.OPENAI,
    maxTokens: 4096,
    pricing: {
      promptPerToken: 0.0000025,      // $2.50 per 1M input tokens
      completionPerToken: 0.00001,     // $10.00 per 1M output tokens
    },
  },
  [ModelId.CLAUDE_SONNET]: {
    id: ModelId.CLAUDE_SONNET,
    name: 'Claude Sonnet 4.5',
    provider: Provider.ANTHROPIC,
    maxTokens: 4096,
    pricing: {
      promptPerToken: 0.000003,        // $3.00 per 1M input tokens
      completionPerToken: 0.000015,    // $15.00 per 1M output tokens
    },
  },
  [ModelId.GROK]: {
    id: ModelId.GROK,
    name: 'Grok 3 Mini',
    provider: Provider.XAI,
    maxTokens: 4096,
    pricing: {
      promptPerToken: 0.000002,        // $2.00 per 1M input tokens
      completionPerToken: 0.00001,     // $10.00 per 1M output tokens
    },
  },
};

export const DEFAULT_MODELS: ModelId[] = [
  ModelId.GPT_4O,
  ModelId.CLAUDE_SONNET,
  ModelId.GROK,
];
