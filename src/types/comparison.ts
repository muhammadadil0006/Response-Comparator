import { ResponseStatus, SSEEventType } from '@/types/enums';

export interface ModelMetrics {
  response_time_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
}

export interface ModelResponseData {
  model_id: string;
  provider: string;
  response_text: string;
  status: ResponseStatus;
  error_message?: string;
  finish_reason?: string;
  tool_calls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  metrics: ModelMetrics;
}

export interface Comparison {
  comparison_id: string;
  user_id: string | null;
  prompt: string;
  saved: boolean;
  created_at: string;
  responses: ModelResponseData[];
}

export interface ExecuteComparisonRequest {
  prompt: string;
  models?: string[];
  stream?: boolean;
  save?: boolean;
}

export interface ComparisonListResponse {
  comparisons: Comparison[];
  total: number;
  limit: number;
  offset: number;
}

export interface StreamEvent {
  event: SSEEventType;
  data: {
    modelId: string;
    comparisonId: string;
    chunk?: string;
    error?: string;
    metrics?: ModelMetrics;
  };
}

/** Shape of SSE data payloads received from the comparison stream */
export interface SSEDataPayload {
  comparisonId?: string;
  models?: string[];
  modelId?: string;
  provider?: string;
  chunk?: string;
  error?: string;
  /** Error category for richer UI handling */
  category?: 'rate-limit' | 'capability' | 'auth' | 'not-found' | 'timeout' | 'content-filter' | 'server' | 'unknown';
  finishReason?: string;
  toolCall?: { id: string; name: string; args: Record<string, unknown> };
  metrics?: ModelMetrics;
}

/** Shape of a Prisma ModelResponse row after include */
export interface PrismaModelResponse {
  id: string;
  comparisonId: string;
  modelId: string;
  provider: string;
  responseText: string | null;
  status: string;
  errorMessage: string | null;
  responseTimeMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCost: unknown;
  createdAt: Date;
}

/** Shape of a Prisma Comparison row with responses included */
export interface PrismaComparisonWithResponses {
  id: string;
  userId: string | null;
  prompt: string;
  saved: boolean;
  createdAt: Date;
  updatedAt: Date;
  responses: PrismaModelResponse[];
}
