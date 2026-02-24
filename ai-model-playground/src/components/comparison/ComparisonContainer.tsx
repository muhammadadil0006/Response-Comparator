'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import {
  startComparison,
  modelStarted,
  appendChunk,
  modelCompleted,
  modelError,
  resetModelForRetry,
  comparisonCompleted,
  resetComparison,
  setComparisonFromHistory,
  toggleSyncScroll,
} from '@/store/slices/comparisonSlice';
import { PromptInput } from '@/components/comparison/PromptInput';
import { ComparisonView } from '@/components/comparison/ComparisonView';
import { DEFAULT_MODELS } from '@/types/models';
import { ModelStatus, MODEL_ID_TO_PROVIDER, ResponseStatus, SSEEventType } from '@/types/enums';
import { API_BASE_URL, API_ENDPOINTS } from '@/config/api-endpoints';
import { extractErrorMessage } from '@/lib/utils/errors';
import { useListComparisonsQuery } from '@/store/api/comparisonApi';
import type { Comparison, SSEDataPayload } from '@/types/comparison';

const ANONYMOUS_CHAT_HISTORY_KEY = 'anonymous_chat_history_v1';
const MAX_ANONYMOUS_CHATS = 20;

function getProviderForModel(modelId: string): string {
  return (
    MODEL_ID_TO_PROVIDER[modelId as keyof typeof MODEL_ID_TO_PROVIDER] ||
    modelId.split('/')[0] ||
    'unknown'
  );
}

export function ComparisonContainer() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const { isLoading, syncScroll, models, currentPrompt } = useAppSelector((state) => state.comparison);
  const lastPromptRef = useRef<string>('');
  const [promptDraft, setPromptDraft] = useState('');
  const [localHistory, setLocalHistory] = useState<Comparison[]>([]);
  const { data: authenticatedHistory } = useListComparisonsQuery(
    { limit: 20, offset: 0 },
    { skip: !isAuthenticated }
  );

  useEffect(() => {
    if (isAuthenticated) return;

    try {
      const raw = localStorage.getItem(ANONYMOUS_CHAT_HISTORY_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Comparison[];
      if (Array.isArray(parsed)) {
        setLocalHistory(parsed);
      }
    } catch {
      setLocalHistory([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLocalHistory((previous) => previous.filter((chat) => !chat.comparison_id.startsWith('anon-')));
  }, [isAuthenticated]);

  const chatHistory = useMemo(() => {
    if (!isAuthenticated) {
      return localHistory;
    }

    const combined = [...localHistory, ...(authenticatedHistory?.comparisons || [])];
    const seen = new Set<string>();
    const deduplicated: Comparison[] = [];

    for (const chat of combined) {
      if (seen.has(chat.comparison_id)) continue;
      seen.add(chat.comparison_id);
      deduplicated.push(chat);
    }

    return deduplicated.slice(0, 20);
  }, [authenticatedHistory?.comparisons, isAuthenticated, localHistory]);

  const handleNewChat = useCallback(() => {
    dispatch(resetComparison());
    setPromptDraft('');
    lastPromptRef.current = '';
  }, [dispatch]);

  const openChat = useCallback(
    (chat: Comparison) => {
      dispatch(
        setComparisonFromHistory({
          comparisonId: chat.comparison_id,
          prompt: chat.prompt,
          responses: chat.responses,
        })
      );
      setPromptDraft(chat.prompt);
      lastPromptRef.current = chat.prompt;
    },
    [dispatch]
  );

  const handleSubmit = useCallback(
    async (
      prompt: string,
      modelIds: string[] = DEFAULT_MODELS,
      options?: { isRetry?: boolean }
    ) => {
      lastPromptRef.current = prompt;
      setPromptDraft(prompt);
      let selectedModels = modelIds;
      let completedComparisonId = `local-${Date.now()}`;
      let modelAccumulator = selectedModels.reduce<
        Record<
          string,
          {
            provider: string;
            responseText: string;
            status: ModelStatus;
            errorMessage?: string;
            metrics?: SSEDataPayload['metrics'];
          }
        >
      >((accumulator, modelId) => {
        accumulator[modelId] = {
          provider: getProviderForModel(modelId),
          responseText: '',
          status: ModelStatus.IDLE,
        };
        return accumulator;
      }, {});

      if (options?.isRetry) {
        selectedModels.forEach((modelId) => {
          dispatch(resetModelForRetry({ modelId }));
        });
      } else {
        dispatch(
          startComparison({
            comparisonId: 'pending',
            models: selectedModels,
          })
        );
      }

      try {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.COMPARISONS}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            models: selectedModels,
            stream: true,
            save: isAuthenticated && !options?.isRetry,
          }),
        });

        if (!response.ok) {
          let errorPayload: unknown = null;

          try {
            errorPayload = await response.json();
          } catch {
            try {
              errorPayload = await response.text();
            } catch {
              errorPayload = null;
            }
          }

          const message = extractErrorMessage(
            errorPayload,
            response.statusText || 'Failed to execute comparison'
          );

          throw new Error(message);
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

            if (line.startsWith('data: ')) {
              try {
                const data: SSEDataPayload = JSON.parse(line.slice(6));

                switch (currentEventType) {
                  case SSEEventType.COMPARISON_STARTED:
                    // Update comparisonId and resolved model IDs
                    if (data.comparisonId) {
                      completedComparisonId = data.comparisonId;
                      // Backend sends resolved model IDs (e.g. "openai/gpt-4o")
                      const resolvedModels = data.models || selectedModels;
                      selectedModels = resolvedModels;
                      // Rebuild accumulator with resolved keys
                      modelAccumulator = resolvedModels.reduce<
                        typeof modelAccumulator
                      >((acc, mId) => {
                        acc[mId] = {
                          provider: getProviderForModel(mId),
                          responseText: '',
                          status: ModelStatus.IDLE,
                        };
                        return acc;
                      }, {});
                      if (!options?.isRetry) {
                        dispatch(
                          startComparison({
                            comparisonId: data.comparisonId,
                            models: resolvedModels,
                          })
                        );
                      }
                    }
                    break;
                  case SSEEventType.MODEL_STARTED:
                    modelAccumulator[data.modelId!] = {
                      ...(modelAccumulator[data.modelId!] || {
                        provider: getProviderForModel(data.modelId!),
                        responseText: '',
                        status: ModelStatus.IDLE,
                      }),
                      provider: data.provider || getProviderForModel(data.modelId!),
                      status: ModelStatus.STREAMING,
                    };
                    dispatch(
                      modelStarted({
                        modelId: data.modelId!,
                        provider: data.provider!,
                      })
                    );
                    break;
                  case SSEEventType.MODEL_CHUNK:
                    modelAccumulator[data.modelId!] = {
                      ...(modelAccumulator[data.modelId!] || {
                        provider: getProviderForModel(data.modelId!),
                        responseText: '',
                        status: ModelStatus.IDLE,
                      }),
                      responseText:
                        (modelAccumulator[data.modelId!]?.responseText || '') + data.chunk!,
                      status: ModelStatus.STREAMING,
                    };
                    dispatch(
                      appendChunk({
                        modelId: data.modelId!,
                        chunk: data.chunk!,
                      })
                    );
                    break;
                  case SSEEventType.MODEL_COMPLETED:
                    modelAccumulator[data.modelId!] = {
                      ...(modelAccumulator[data.modelId!] || {
                        provider: getProviderForModel(data.modelId!),
                        responseText: '',
                        status: ModelStatus.IDLE,
                      }),
                      status: ModelStatus.COMPLETED,
                      metrics: data.metrics,
                    };
                    dispatch(
                      modelCompleted({
                        modelId: data.modelId!,
                        metrics: data.metrics ?? null,
                      })
                    );
                    break;
                  case SSEEventType.MODEL_ERROR:
                    modelAccumulator[data.modelId!] = {
                      ...(modelAccumulator[data.modelId!] || {
                        provider: getProviderForModel(data.modelId!),
                        responseText: '',
                        status: ModelStatus.IDLE,
                      }),
                      status: ModelStatus.ERROR,
                      errorMessage: extractErrorMessage(data.error, 'Unexpected error'),
                    };
                    dispatch(
                      modelError({
                        modelId: data.modelId!,
                        error: extractErrorMessage(data.error, 'Unexpected error'),
                      })
                    );
                    break;
                  case SSEEventType.ERROR:
                    selectedModels.forEach((modelId) => {
                      modelAccumulator[modelId] = {
                        ...(modelAccumulator[modelId] || {
                          provider: getProviderForModel(modelId),
                          responseText: '',
                          status: ModelStatus.IDLE,
                        }),
                        status: ModelStatus.ERROR,
                        errorMessage: extractErrorMessage(data, 'Failed to complete comparison'),
                      };

                      dispatch(
                        modelError({
                          modelId,
                          error: extractErrorMessage(
                            data,
                            'Failed to complete comparison'
                          ),
                        })
                      );
                    });
                    break;
                }
              } catch {
                // Skip malformed JSON
              }
              currentEventType = '';
            }
          }
        }
      } catch (error: unknown) {
        console.error('Comparison error:', error);
        selectedModels.forEach((modelId) => {
          modelAccumulator[modelId] = {
            ...(modelAccumulator[modelId] || {
              provider: getProviderForModel(modelId),
              responseText: '',
              status: ModelStatus.IDLE,
            }),
            status: ModelStatus.ERROR,
            errorMessage: extractErrorMessage(error, 'Failed to connect to server'),
          };

          dispatch(
            modelError({
              modelId,
              error: extractErrorMessage(error, 'Failed to connect to server'),
            })
          );
        });
      } finally {
        dispatch(comparisonCompleted());

        if (!options?.isRetry) {
          const completedComparison: Comparison = {
            comparison_id: isAuthenticated ? completedComparisonId : `anon-${Date.now()}`,
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

          setLocalHistory((previous) => {
            const updatedHistory = [completedComparison, ...previous].slice(
              0,
              MAX_ANONYMOUS_CHATS
            );

            if (!isAuthenticated) {
              try {
                localStorage.setItem(
                  ANONYMOUS_CHAT_HISTORY_KEY,
                  JSON.stringify(updatedHistory)
                );
              } catch {
                // Ignore local storage write errors
              }
            }

            return updatedHistory;
          });
        }
      }
    },
    [dispatch, isAuthenticated]
  );

  const handleRetry = useCallback((modelId: string) => {
    const prompt = lastPromptRef.current || currentPrompt;
    if (prompt) {
      handleSubmit(prompt, [modelId], { isRetry: true });
    }
  }, [handleSubmit, currentPrompt]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3">
        <button
          type="button"
          onClick={handleNewChat}
          className="w-full rounded-md bg-gray-100 px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          + New chat
        </button>

        <div className="max-h-[72vh] space-y-1 overflow-y-auto">
          {chatHistory.length === 0 ? (
            <p className="px-2 py-3 text-xs text-gray-500 dark:text-gray-400">
              No chats yet
            </p>
          ) : (
            chatHistory.map((chat) => (
              <button
                key={chat.comparison_id}
                type="button"
                onClick={() => openChat(chat)}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <p className="truncate font-medium">{chat.prompt}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {new Date(chat.created_at).toLocaleString()}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-h-[70vh] flex-col gap-4">
        <ComparisonView
          models={models}
          currentPrompt={currentPrompt}
          onRetry={handleRetry}
          onEditResponse={setPromptDraft}
        />

        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!isAuthenticated && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  💡 Sign in to save your comparisons
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={syncScroll}
                onChange={() => dispatch(toggleSyncScroll())}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Sync scroll
            </label>
          </div>

          <PromptInput
            onSubmit={(prompt) => handleSubmit(prompt)}
            isLoading={isLoading}
            isAuthenticated={isAuthenticated}
            value={promptDraft}
            onChange={setPromptDraft}
          />
        </div>
      </section>
    </div>
  );
}
