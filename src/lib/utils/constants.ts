import { ModelId, Provider } from '@/types/enums';

export const MODELS = [ModelId.GPT_4O, ModelId.CLAUDE_SONNET, ModelId.GROK] as const;

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  [ModelId.GPT_4O]: 'GPT-4o',
  [ModelId.CLAUDE_SONNET]: 'Claude Opus 4.6',
  [ModelId.GROK]: 'Grok 4',
};

export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  [Provider.OPENAI]: 'OpenAI',
  [Provider.ANTHROPIC]: 'Anthropic',
  [Provider.XAI]: 'xAI',
};

export const PROVIDER_COLORS: Record<string, string> = {
  [Provider.OPENAI]: '#10a37f',
  [Provider.ANTHROPIC]: '#d4a574',
  [Provider.XAI]: '#1da1f2',
};

export const MAX_PROMPT_LENGTH = 10000;
export const API_TIMEOUT_MS = 30000;
