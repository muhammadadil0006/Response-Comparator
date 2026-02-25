'use client';

import { useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppDispatch } from '@/store/store';
import {
  setPrompt,
  startComparison,
  updateComparisonId,
  modelStarted,
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
import type { Comparison, SSEDataPayload } from '@/types/comparison';

function getProviderForModel(modelId: string): string {
  return (
    MODEL_ID_TO_PROVIDER[modelId as keyof typeof MODEL_ID_TO_PROVIDER] ||
    modelId.split('/')[0] ||
    'unknown'
  );
}

type ModelAccumulatorEntry = {
  provider: string;
  responseText: string;
  status: ModelStatus;
  errorMessage?: string;
  metrics?: SSEDataPayload['metrics'];
};

interface UseComparisonStreamProps {
  dispatch: AppDispatch;
  isAuthenticated: boolean;
  currentComparisonId: string | null;
  currentPrompt: string;
  refetchHistory: () => void;
  historyQueryUninitialized: boolean;
  lastPromptRef: React.MutableRefObject<string>;
  setPromptDraft: (v: string) => void;
  setLocalHistory: React.Dispatch<React.SetStateAction<Comparison[]>>;
  persistLocalHistory: (history: Comparison[]) => void;
  /**
   * Called on every chunk with the model's cumulative text so far.
   * Use this to update local streaming state in the parent component.
   */
  onChunk?: (modelId: string, fullText: string) => void;
  /** Called when a model finishes (completed or error) to clear its live text. */
  onStreamEnd?: (modelId: string) => void;
}

export function useComparisonStream({
  dispatch,
  isAuthenticated,
  currentComparisonId,
  currentPrompt,
  refetchHistory,
  historyQueryUninitialized,
  lastPromptRef,
  setPromptDraft,
  setLocalHistory,
  persistLocalHistory,
  onChunk,
  onStreamEnd,
}: UseComparisonStreamProps) {
  const router = useRouter();
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const modelAccumulatorRef = useRef<Record<string, ModelAccumulatorEntry>>({});

  const handleSubmit = useCallback(
    async (
      prompt: string,
      modelIds: string[] = DEFAULT_MODELS,
      options?: { isRetry?: boolean; comparisonId?: string }
    ) => {
      const existingComparisonId = options?.comparisonId || currentComparisonId;
      const isUpdate = !options?.isRetry && !!existingComparisonId && existingComparisonId !== 'pending';

      lastPromptRef.current = prompt;
      setPromptDraft('');
      dispatch(setPrompt(prompt));

      let selectedModels = modelIds;
      let completedComparisonId = existingComparisonId || `local-${Date.now()}`;

      const freshEntries = selectedModels.reduce<Record<string, ModelAccumulatorEntry>>(
        (acc, modelId) => {
          acc[modelId] = { provider: getProviderForModel(modelId), responseText: '', status: ModelStatus.IDLE };
          return acc;
        },
        {}
      );

      let modelAccumulator: typeof freshEntries;
      if (options?.isRetry) {
        modelAccumulatorRef.current = { ...modelAccumulatorRef.current, ...freshEntries };
        modelAccumulator = modelAccumulatorRef.current;
      } else {
        modelAccumulator = freshEntries;
        modelAccumulatorRef.current = modelAccumulator;
      }

      if (options?.isRetry) {
        selectedModels.forEach((modelId) => dispatch(resetModelForRetry({ modelId })));
      } else {
        dispatch(startComparison({ comparisonId: existingComparisonId || 'pending', models: selectedModels }));
      }

      const abortKey = options?.isRetry ? selectedModels[0] : '__all__';
      if (options?.isRetry) {
        abortControllersRef.current.get(selectedModels[0])?.abort('superseded');
        abortControllersRef.current.delete(selectedModels[0]);
      } else {
        abortControllersRef.current.forEach((ctrl) => ctrl.abort('superseded'));
        abortControllersRef.current.clear();
      }
      const abortController = new AbortController();
      abortControllersRef.current.set(abortKey, abortController);

      let wasSuperseded = false;

      try {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.COMPARISONS}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify({
            prompt,
            models: selectedModels,
            stream: true,
            ...((options?.isRetry || isUpdate) && existingComparisonId
              ? { comparisonId: existingComparisonId }
              : {}),
          }),
        });

        if (!response.ok) {
          let errorPayload: unknown = null;
          try { errorPayload = await response.json(); } catch {
            try { errorPayload = await response.text(); } catch { /* ignore */ }
          }
          throw new Error(extractErrorMessage(errorPayload, response.statusText || 'Failed to execute comparison'));
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEventType = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim();
              continue;
            }
            if (!line.startsWith('data: ')) continue;

            try {
              const data: SSEDataPayload = JSON.parse(line.slice(6));

              switch (currentEventType) {
                case SSEEventType.COMPARISON_STARTED:
                  if (data.comparisonId) {
                    completedComparisonId = data.comparisonId;
                    const resolvedModels = data.models || selectedModels;
                    selectedModels = resolvedModels;
                    const resolvedEntries = resolvedModels.reduce<typeof modelAccumulator>(
                      (acc, mId) => {
                        acc[mId] = { provider: getProviderForModel(mId), responseText: '', status: ModelStatus.IDLE };
                        return acc;
                      },
                      {}
                    );
                    modelAccumulatorRef.current = options?.isRetry
                      ? { ...modelAccumulatorRef.current, ...resolvedEntries }
                      : resolvedEntries;
                    modelAccumulator = modelAccumulatorRef.current;
                    dispatch(updateComparisonId({ comparisonId: data.comparisonId }));
                    resolvedModels.forEach((mId: string) =>
                      dispatch(modelStarted({ modelId: mId, provider: getProviderForModel(mId) }))
                    );
                  }
                  break;

                case SSEEventType.MODEL_STARTED:
                  modelAccumulator[data.modelId!] = {
                    ...(modelAccumulator[data.modelId!] || { provider: getProviderForModel(data.modelId!), responseText: '', status: ModelStatus.IDLE }),
                    provider: data.provider || getProviderForModel(data.modelId!),
                    status: ModelStatus.STREAMING,
                  };
                  dispatch(modelStarted({ modelId: data.modelId!, provider: data.provider! }));
                  break;

                case SSEEventType.MODEL_CHUNK: {
                  const chunkModelId = data.modelId!;
                  const entry = modelAccumulator[chunkModelId] || { provider: getProviderForModel(chunkModelId), responseText: '', status: ModelStatus.IDLE };
                  const fullText = entry.responseText + data.chunk!;
                  modelAccumulator[chunkModelId] = {
                    ...entry,
                    responseText: fullText,
                    status: ModelStatus.STREAMING,
                  };
                  // Notify parent to update local streaming display (no Redux dispatch).
                  onChunk?.(chunkModelId, fullText);
                  break;
                }

                case SSEEventType.MODEL_TOOL_CALL:
                  if (data.toolCall) dispatch(addToolCall({ modelId: data.modelId!, toolCall: data.toolCall }));
                  break;

                case SSEEventType.MODEL_COMPLETED: {
                  const cid = data.modelId!;
                  const completedText = modelAccumulator[cid]?.responseText ?? '';
                  modelAccumulator[cid] = {
                    ...(modelAccumulator[cid] || { provider: getProviderForModel(cid), responseText: completedText, status: ModelStatus.IDLE }),
                    responseText: completedText,
                    status: ModelStatus.COMPLETED,
                    metrics: data.metrics,
                  };
                  onStreamEnd?.(cid);
                  dispatch(modelCompleted({ modelId: cid, responseText: completedText, metrics: data.metrics ?? null, finishReason: data.finishReason }));
                  break;
                }

                case SSEEventType.MODEL_ERROR: {
                  const eid = data.modelId!;
                  const partialText = modelAccumulator[eid]?.responseText ?? '';
                  modelAccumulator[eid] = {
                    ...(modelAccumulator[eid] || { provider: getProviderForModel(eid), responseText: partialText, status: ModelStatus.IDLE }),
                    status: ModelStatus.ERROR,
                    errorMessage: extractErrorMessage(data.error, 'Unexpected error'),
                  };
                  onStreamEnd?.(eid);
                  dispatch(modelError({ modelId: eid, responseText: partialText, error: extractErrorMessage(data.error, 'Unexpected error'), category: data.category }));
                  break;
                }

                case SSEEventType.ERROR:
                  selectedModels.forEach((modelId) => {
                    const partialOnErr = modelAccumulator[modelId]?.responseText || '';
                    modelAccumulator[modelId] = {
                      ...(modelAccumulator[modelId] || { provider: getProviderForModel(modelId), responseText: partialOnErr, status: ModelStatus.IDLE }),
                      status: ModelStatus.ERROR,
                      errorMessage: extractErrorMessage(data, 'Failed to complete comparison'),
                    };
                    onStreamEnd?.(modelId);
                    dispatch(modelError({ modelId, responseText: partialOnErr, error: extractErrorMessage(data, 'Failed to complete comparison') }));
                  });
                  break;
              }
            } catch { /* Skip malformed JSON */ }
            currentEventType = '';
          }
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          wasSuperseded = true;
        } else {
          console.error('Comparison error:', error);
          selectedModels.forEach((modelId) => {
            modelAccumulator[modelId] = {
              ...(modelAccumulator[modelId] || { provider: getProviderForModel(modelId), responseText: '', status: ModelStatus.IDLE }),
              status: ModelStatus.ERROR,
              errorMessage: extractErrorMessage(error, 'Failed to connect to server'),
            };
            dispatch(modelError({ modelId, error: extractErrorMessage(error, 'Failed to connect to server') }));
          });
        }
      } finally {
        abortControllersRef.current.delete(abortKey);
        if (wasSuperseded) return;

        dispatch(comparisonCompleted());

        if (!options?.isRetry && completedComparisonId && !completedComparisonId.startsWith('local-') && !completedComparisonId.startsWith('anon-')) {
          router.replace(`/compare/${completedComparisonId}`);
        }

        const completedComparison: Comparison = {
          comparison_id: completedComparisonId.startsWith('local-')
            ? (isAuthenticated ? completedComparisonId : `anon-${Date.now()}`)
            : completedComparisonId,
          user_id: null,
          prompt,
          saved: isAuthenticated,
          created_at: new Date().toISOString(),
          responses: selectedModels.map((modelId) => {
            const model = modelAccumulator[modelId];
            return {
              model_id: modelId,
              provider: model?.provider || getProviderForModel(modelId),
              response_text: model?.responseText || '',
              status:
                model?.status === ModelStatus.ERROR
                  ? ResponseStatus.ERROR
                  : model?.status === ModelStatus.COMPLETED
                    ? ResponseStatus.COMPLETED
                    : ResponseStatus.PENDING,
              error_message: model?.errorMessage,
              metrics: {
                response_time_ms: model?.metrics?.response_time_ms || 0,
                prompt_tokens: model?.metrics?.prompt_tokens || 0,
                completion_tokens: model?.metrics?.completion_tokens || 0,
                total_tokens: model?.metrics?.total_tokens || 0,
                estimated_cost: model?.metrics?.estimated_cost || 0,
              },
            };
          }),
        };

        if (options?.isRetry) {
          const retryModelId = selectedModels[0];
          const retryModel = modelAccumulator[retryModelId];
          if (retryModel) {
            setLocalHistory((prev) => {
              const updated = prev.map((chat) => {
                if (chat.comparison_id !== completedComparisonId) return chat;
                return {
                  ...chat,
                  responses: chat.responses.map((r) =>
                    r.model_id === retryModelId
                      ? {
                          ...r,
                          response_text: retryModel.responseText || '',
                          status:
                            retryModel.status === ModelStatus.ERROR ? ResponseStatus.ERROR
                            : retryModel.status === ModelStatus.COMPLETED ? ResponseStatus.COMPLETED
                            : ResponseStatus.PENDING,
                          error_message: retryModel.errorMessage,
                          metrics: {
                            response_time_ms: retryModel.metrics?.response_time_ms || 0,
                            prompt_tokens: retryModel.metrics?.prompt_tokens || 0,
                            completion_tokens: retryModel.metrics?.completion_tokens || 0,
                            total_tokens: retryModel.metrics?.total_tokens || 0,
                            estimated_cost: retryModel.metrics?.estimated_cost || 0,
                          },
                        }
                      : r
                  ),
                };
              });
              persistLocalHistory(updated);
              return updated;
            });
          }
        } else {
          setLocalHistory((prev) => {
            const idx = prev.findIndex((c) => c.comparison_id === completedComparison.comparison_id);
            let updated: Comparison[];
            if (idx >= 0) {
              updated = [...prev];
              updated[idx] = completedComparison;
            } else {
              updated = [completedComparison, ...prev].slice(0, 20);
            }
            persistLocalHistory(updated);
            return updated;
          });
        }

        if (isAuthenticated && !historyQueryUninitialized) refetchHistory();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, isAuthenticated, currentComparisonId, refetchHistory, currentPrompt]
  );

  const handleRetry = useCallback(
    (modelId: string) => {
      const prompt = lastPromptRef.current || currentPrompt;
      if (!prompt) return;
      const safeComparisonId =
        currentComparisonId && currentComparisonId !== 'pending' ? currentComparisonId : undefined;
      handleSubmit(prompt, [modelId], { isRetry: true, comparisonId: safeComparisonId });
    },
    [handleSubmit, currentPrompt, currentComparisonId, lastPromptRef]
  );

  return { handleSubmit, handleRetry };
}
