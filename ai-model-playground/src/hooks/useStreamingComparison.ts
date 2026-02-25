'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import {
  startComparison,
  confirmComparison,
  modelStarted,
  appendChunks,
  modelCompleted,
  modelError,
  addToolCall,
  resetModelForRetry,
  comparisonCompleted,
} from '@/store/slices/comparisonSlice';
import { DEFAULT_MODELS } from '@/types/models';
import { ModelStatus, MODEL_ID_TO_PROVIDER, ResponseStatus, SSEEventType } from '@/types/enums';
import { API_BASE_URL, API_ENDPOINTS } from '@/config/api-endpoints';
import { extractErrorMessage } from '@/lib/utils/errors';
import type { SSEDataPayload, ModelResponseData } from '@/types/comparison';

// ─── Types (exported for consumers) ──────────────────────────────────────────

export interface StoredComparison {
  id: string;
  prompt: string;
  responses: ModelResponseData[];
  createdAt: string;
}

interface UseStreamingComparisonParams {
  onPersistAnonComparison: (
    prompt: string,
    responses: ModelResponseData[],
    comparisonId: string,
  ) => void;
  onStreamComplete: () => void;
}

/** If no SSE data arrives for this many ms, assume the backend stream died */
const STREAM_INACTIVITY_TIMEOUT_MS = 30_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProviderForModel(modelId: string): string {
  return (
    MODEL_ID_TO_PROVIDER[modelId as keyof typeof MODEL_ID_TO_PROVIDER] ||
    modelId.split('/')[0] ||
    'unknown'
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStreamingComparison({
  onPersistAnonComparison,
  onStreamComplete,
}: UseStreamingComparisonParams) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  // ─── Stream + abort management ──────────────────────────────────────
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeStreamCountRef = useRef(0);

  // Keep comparisonId in a ref so handleSubmit can read it without re-creating
  const comparisonId = useAppSelector((s) => s.comparison.comparisonId);
  const comparisonIdRef = useRef(comparisonId);
  useEffect(() => { comparisonIdRef.current = comparisonId; }, [comparisonId]);

  // ─── rAF chunk batching ─────────────────────────────────────────────
  const chunkBufferRef = useRef<Array<{ modelId: string; chunk: string }>>([]);
  const rafIdRef = useRef<number | null>(null);

  const flushChunks = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const buf = chunkBufferRef.current;
    if (buf.length === 0) return;
    chunkBufferRef.current = [];

    // Coalesce chunks by modelId → single dispatch
    const merged: Array<{ modelId: string; chunk: string }> = [];
    for (const { modelId, chunk } of buf) {
      const existing = merged.find((c) => c.modelId === modelId);
      if (existing) { existing.chunk += chunk; } else { merged.push({ modelId, chunk }); }
    }
    dispatch(appendChunks({ chunks: merged }));
  }, [dispatch]);

  const bufferChunk = useCallback(
    (modelId: string, chunk: string) => {
      chunkBufferRef.current.push({ modelId, chunk });
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(flushChunks);
      }
    },
    [flushChunks]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // ─── Main submit handler ────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (
      prompt: string,
      modelIds: string[] = DEFAULT_MODELS,
      retryModelId?: string,
    ) => {
      const isRetry = !!retryModelId;
      let selectedModels = isRetry ? [retryModelId] : [...modelIds];

      let completedComparisonId = '';
      const pendingId = `pending-${Date.now()}`;

      let modelAccumulator = selectedModels.reduce<
        Record<string, {
          provider: string;
          responseText: string;
          status: ModelStatus;
          errorMessage?: string;
          metrics?: SSEDataPayload['metrics'];
        }>
      >((acc, modelId) => {
        acc[modelId] = {
          provider: getProviderForModel(modelId),
          responseText: '',
          status: ModelStatus.IDLE,
        };
        return acc;
      }, {});

      // ─── Abort management ───────────────────────────────────────────
      if (!isRetry) {
        // New prompt → abort everything, clear buffers
        if (abortControllerRef.current) abortControllerRef.current.abort();
        activeStreamCountRef.current = 0;
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        chunkBufferRef.current = [];
        dispatch(startComparison({ pendingId, prompt, models: selectedModels }));
      } else {
        // Retry single model — don't abort other streams
        dispatch(resetModelForRetry({ modelId: retryModelId }));
      }

      const abortController = new AbortController();
      if (!isRetry) {
        abortControllerRef.current = abortController;
      }
      activeStreamCountRef.current++;

      let didTimeout = false;
      let earlyExit = false;

      try {
        const body: Record<string, unknown> = {
          prompt,
          models: selectedModels,
          stream: true,
        };

        // For retry, include the existing comparisonId so the backend uses
        // regenerateModelStreaming instead of creating a new comparison.
        if (isRetry && comparisonIdRef.current) {
          body.comparisonId = comparisonIdRef.current;
        }

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.COMPARISONS}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          let errorPayload: unknown = null;
          try { errorPayload = await response.json(); } catch {
            try { errorPayload = await response.text(); } catch { errorPayload = null; }
          }
          throw new Error(
            extractErrorMessage(errorPayload, response.statusText || 'Failed to execute comparison')
          );
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEventType = '';

        // ── Inactivity timeout ─────────────────────────────────────────
        let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
        const resetInactivityTimer = () => {
          if (inactivityTimer) clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(() => {
            console.warn('[Stream] Inactivity timeout — no data for', STREAM_INACTIVITY_TIMEOUT_MS, 'ms');
            didTimeout = true;
            abortController.abort();
          }, STREAM_INACTIVITY_TIMEOUT_MS);
        };
        const clearInactivityTimer = () => {
          if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; }
        };

        resetInactivityTimer();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            resetInactivityTimer();
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEventType = line.slice(7).trim();
                continue;
              }

              if (line.startsWith('data: ')) {
                try {
                  const data: SSEDataPayload = JSON.parse(line.slice(6));

                  switch (currentEventType) {
                    case SSEEventType.COMPARISON_STARTED: {
                      if (data.comparisonId) {
                        completedComparisonId = data.comparisonId;
                        const resolvedModels = data.models || selectedModels;
                        selectedModels = resolvedModels;

                        modelAccumulator = resolvedModels.reduce<typeof modelAccumulator>(
                          (acc, mId) => {
                            acc[mId] = { provider: getProviderForModel(mId), responseText: '', status: ModelStatus.IDLE };
                            return acc;
                          }, {},
                        );

                        if (!isRetry) {
                          flushChunks();
                          dispatch(confirmComparison({
                            comparisonId: data.comparisonId,
                            models: resolvedModels,
                          }));
                          resolvedModels.forEach((mId: string) => {
                            dispatch(modelStarted({ modelId: mId, provider: getProviderForModel(mId) }));
                          });
                        }
                      }
                      break;
                    }
                    case SSEEventType.MODEL_STARTED:
                      dispatch(modelStarted({
                        modelId: data.modelId!,
                        provider: data.provider || getProviderForModel(data.modelId!),
                      }));
                      break;

                    case SSEEventType.MODEL_CHUNK:
                      if (modelAccumulator[data.modelId!]) {
                        modelAccumulator[data.modelId!].responseText += data.chunk!;
                        modelAccumulator[data.modelId!].status = ModelStatus.STREAMING;
                      }
                      bufferChunk(data.modelId!, data.chunk!);
                      break;

                    case SSEEventType.MODEL_TOOL_CALL:
                      if (data.toolCall) {
                        dispatch(addToolCall({ modelId: data.modelId!, toolCall: data.toolCall }));
                      }
                      break;

                    case SSEEventType.MODEL_COMPLETED:
                      flushChunks();
                      if (modelAccumulator[data.modelId!]) {
                        modelAccumulator[data.modelId!].status = ModelStatus.COMPLETED;
                        modelAccumulator[data.modelId!].metrics = data.metrics;
                      }
                      dispatch(modelCompleted({
                        modelId: data.modelId!,
                        metrics: data.metrics ?? null,
                        finishReason: data.finishReason,
                      }));
                      break;

                    case SSEEventType.MODEL_ERROR: {
                      flushChunks();
                      const errMsg = extractErrorMessage(data.error, 'Unexpected error');
                      if (modelAccumulator[data.modelId!]) {
                        modelAccumulator[data.modelId!].status = ModelStatus.ERROR;
                        modelAccumulator[data.modelId!].errorMessage = errMsg;
                      }
                      dispatch(modelError({ modelId: data.modelId!, error: errMsg, category: data.category }));
                      break;
                    }
                    case SSEEventType.ERROR:
                      flushChunks();
                      selectedModels.forEach((modelId) => {
                        const msg = extractErrorMessage(data, 'Failed to complete comparison');
                        if (modelAccumulator[modelId]) {
                          modelAccumulator[modelId].status = ModelStatus.ERROR;
                          modelAccumulator[modelId].errorMessage = msg;
                        }
                        dispatch(modelError({ modelId, error: msg }));
                      });
                      break;
                  }
                } catch { /* skip malformed JSON */ }
                currentEventType = '';
              }
            }
          }
        } finally {
          clearInactivityTimer();
        }
      } catch (error: unknown) {
        if ((error as Error).name === 'AbortError') {
          if (didTimeout) {
            flushChunks();
            selectedModels.forEach((modelId) => {
              const acc = modelAccumulator[modelId];
              if (acc && acc.status !== ModelStatus.COMPLETED && acc.status !== ModelStatus.ERROR) {
                acc.status = ModelStatus.ERROR;
                acc.errorMessage = 'Stream timed out — no data received for 30s';
                dispatch(modelError({ modelId, error: 'Stream timed out — no data received for 30s', category: 'timeout' }));
              }
            });
          } else {
            earlyExit = true;
            return;
          }
        } else {
          console.error('Comparison error:', error);
          flushChunks();
          const errMsg = extractErrorMessage(error, 'Failed to connect to server');
          selectedModels.forEach((modelId) => {
            if (modelAccumulator[modelId]) {
              modelAccumulator[modelId].status = ModelStatus.ERROR;
              modelAccumulator[modelId].errorMessage = errMsg;
            }
            dispatch(modelError({ modelId, error: errMsg }));
          });
        }
      } finally {
        activeStreamCountRef.current = Math.max(0, activeStreamCountRef.current - 1);
        if (earlyExit) return;

        // Mark comparison complete only when ALL streams are done
        if (activeStreamCountRef.current <= 0) {
          activeStreamCountRef.current = 0;
          dispatch(comparisonCompleted());
        }

        // Persist for anon users
        if (!isAuthenticated) {
          const responses: ModelResponseData[] = Object.keys(modelAccumulator).map((modelId) => {
            const m = modelAccumulator[modelId];
            return {
              model_id: modelId,
              provider: m.provider,
              response_text: m.responseText || '',
              status: m.status === ModelStatus.ERROR ? ResponseStatus.ERROR
                : m.status === ModelStatus.COMPLETED ? ResponseStatus.COMPLETED
                : ResponseStatus.PENDING,
              error_message: m.errorMessage,
              metrics: {
                response_time_ms: m.metrics?.response_time_ms || 0,
                prompt_tokens: m.metrics?.prompt_tokens || 0,
                completion_tokens: m.metrics?.completion_tokens || 0,
                total_tokens: m.metrics?.total_tokens || 0,
                estimated_cost: m.metrics?.estimated_cost || 0,
              },
            };
          });
          // For retry, use the ORIGINAL comparisonId so the merge logic in
          // persistAnonComparison updates the existing entry instead of creating a new one.
          const compId = isRetry
            ? (comparisonIdRef.current || completedComparisonId || pendingId)
            : (completedComparisonId || pendingId);
          onPersistAnonComparison(prompt, responses, compId);
        }

        if (activeStreamCountRef.current <= 0) {
          onStreamComplete();
        }
      }
    },
    [dispatch, isAuthenticated, onPersistAnonComparison, onStreamComplete, bufferChunk, flushChunks]
  );

  // ─── Retry: re-run a single model ────────────────────────────────────
  const handleRetry = useCallback(
    (modelId: string) => {
      // Read prompt from store via selector-less ref
      const prompt = promptRef.current;
      if (!prompt) return;
      handleSubmit(prompt, [modelId], modelId);
    },
    [handleSubmit]
  );

  // Keep prompt in a ref for handleRetry without adding to deps
  const prompt = useAppSelector((s) => s.comparison.prompt);
  const promptRef = useRef(prompt);
  useEffect(() => { promptRef.current = prompt; }, [prompt]);

  return { handleSubmit, handleRetry };
}
