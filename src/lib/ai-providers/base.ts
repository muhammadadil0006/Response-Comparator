// ─── Finish Reasons (normalized across providers) ─────────────────────────────

export type FinishReason =
  | 'stop'           // Normal completion (OpenAI: stop, Anthropic: end_turn)
  | 'length'         // Max tokens hit (OpenAI: length, Anthropic: max_tokens)
  | 'tool-calls'     // Model invoked a tool (OpenAI: tool_calls, Anthropic: tool_use)
  | 'content-filter' // Blocked by safety/content filter
  | 'error'          // An error occurred
  | 'unknown';       // Fallback

// ─── Tool Call (normalized) ───────────────────────────────────────────────────

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

// ─── Stream Chunks ────────────────────────────────────────────────────────────

export interface StreamChunk {
  type: 'text-delta';
  text: string;
  tokens: number;
}

export interface ToolCallChunk {
  type: 'tool-call';
  toolCall: ToolCall;
}

export interface FinishChunk {
  type: 'finish';
  finishReason: FinishReason;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** Union of all possible stream events from an adapter */
export type StreamEvent = StreamChunk | ToolCallChunk | FinishChunk;

// ─── Non-streaming response ───────────────────────────────────────────────────

export interface AIResponse {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  responseTimeMs: number;
  finishReason: FinishReason;
  toolCalls?: ToolCall[];
}

// ─── Adapter interface ────────────────────────────────────────────────────────

export interface AIAdapter {
  readonly modelId: string;
  readonly provider: string;

  sendPrompt(prompt: string): Promise<AIResponse>;
  /** Yields StreamEvent objects — text deltas, tool calls, and a final finish event. */
  stream(prompt: string): AsyncIterable<StreamEvent>;
  calculateCost(promptTokens: number, completionTokens: number): number;
}

export abstract class BaseAIAdapter implements AIAdapter {
  abstract readonly modelId: string;
  abstract readonly provider: string;

  abstract sendPrompt(prompt: string): Promise<AIResponse>;
  abstract stream(prompt: string): AsyncIterable<StreamEvent>;
  abstract calculateCost(
    promptTokens: number,
    completionTokens: number
  ): number;

  protected measureTime(): () => number {
    const start = performance.now();
    return () => Math.round(performance.now() - start);
  }

  /** Normalize AI SDK finish reasons to our union type. */
  protected normalizeFinishReason(reason: string | undefined | null): FinishReason {
    if (!reason) return 'unknown';
    switch (reason) {
      case 'stop':
      case 'end_turn':
        return 'stop';
      case 'length':
      case 'max_tokens':
        return 'length';
      case 'tool_calls':
      case 'tool-calls':
      case 'tool_use':
        return 'tool-calls';
      case 'content_filter':
      case 'content-filter':
      case 'safety':
        return 'content-filter';
      case 'error':
        return 'error';
      default:
        return 'unknown';
    }
  }
}
