export interface StreamChunk {
  text: string;
  tokens: number;
}

export interface AIResponse {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  responseTimeMs: number;
}

export interface AIAdapter {
  readonly modelId: string;
  readonly provider: string;

  sendPrompt(prompt: string): Promise<AIResponse>;
  stream(prompt: string): AsyncIterable<StreamChunk>;
  calculateCost(promptTokens: number, completionTokens: number): number;
}

export abstract class BaseAIAdapter implements AIAdapter {
  abstract readonly modelId: string;
  abstract readonly provider: string;

  abstract sendPrompt(prompt: string): Promise<AIResponse>;
  abstract stream(prompt: string): AsyncIterable<StreamChunk>;
  abstract calculateCost(
    promptTokens: number,
    completionTokens: number
  ): number;

  protected measureTime(): () => number {
    const start = performance.now();
    return () => Math.round(performance.now() - start);
  }
}
