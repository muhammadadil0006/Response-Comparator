// ─── Model & Provider Enums ───────────────────────────────────────────────────

export enum ModelId {
  GPT_4O = 'openai/gpt-4o',
  CLAUDE_SONNET = 'anthropic/claude-opus-4.6',
  GROK = 'xai/grok-4',
}

export enum Provider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  XAI = 'xai',
}

// ─── Status Enums ─────────────────────────────────────────────────────────────

export enum ModelStatus {
  IDLE = 'idle',
  PENDING = 'pending',
  STREAMING = 'streaming',
  COMPLETED = 'completed',
  ERROR = 'error',
  INTERRUPTED = 'interrupted',
}

export enum ResponseStatus {
  PENDING = 'pending',
  STREAMING = 'streaming',
  COMPLETED = 'completed',
  ERROR = 'error',
}

// ─── Auth Enums ───────────────────────────────────────────────────────────────

export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
}

export enum CookieName {
  ACCESS_TOKEN = 'access_token',
  REFRESH_TOKEN = 'refresh_token',
}

// ─── SSE Event Types ──────────────────────────────────────────────────────────

export enum SSEEventType {
  COMPARISON_STARTED = 'comparison_started',
  MODEL_STARTED = 'model_started',
  MODEL_CHUNK = 'model_chunk',
  MODEL_TOOL_CALL = 'model_tool_call',
  MODEL_COMPLETED = 'model_completed',
  MODEL_ERROR = 'model_error',
  COMPARISON_COMPLETED = 'comparison_completed',
  ERROR = 'error',
}

// ─── UI Enums ─────────────────────────────────────────────────────────────────

export enum ButtonVariant {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  DANGER = 'danger',
  GHOST = 'ghost',
}

export enum ComponentSize {
  SM = 'sm',
  MD = 'md',
  LG = 'lg',
}

// ─── HTTP Status Codes ────────────────────────────────────────────────────────

export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
}

// ─── Rate Limit Tiers ─────────────────────────────────────────────────────────

export enum RateLimitTier {
  ANONYMOUS = 'anonymous',
  AUTHENTICATED = 'authenticated',
}

// ─── Mapping Helpers ──────────────────────────────────────────────────────────

export const MODEL_ID_TO_PROVIDER: Record<ModelId, Provider> = {
  [ModelId.GPT_4O]: Provider.OPENAI,
  [ModelId.CLAUDE_SONNET]: Provider.ANTHROPIC,
  [ModelId.GROK]: Provider.XAI,
};
