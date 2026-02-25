'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import {
  setPrompt,
  startComparison,
  updateComparisonId,
  modelStarted,
  appendChunk,
  modelCompleted,
  modelError,
  addToolCall,
  resetModelForRetry,
  comparisonCompleted,
  resetComparison,
  setComparisonFromHistory,
  toggleSyncScroll,
  restoreFromSnapshot,
} from '@/store/slices/comparisonSlice';
import { PromptInput } from '@/components/comparison/PromptInput';
import { ComparisonView } from '@/components/comparison/ComparisonView';
import { DEFAULT_MODELS } from '@/types/models';
import { ModelStatus, MODEL_ID_TO_PROVIDER, ResponseStatus, SSEEventType } from '@/types/enums';
import { API_BASE_URL, API_ENDPOINTS } from '@/config/api-endpoints';
import { extractErrorMessage } from '@/lib/utils/errors';
import {
  useListComparisonsQuery,
  useDeleteComparisonMutation,
  useGetComparisonQuery,
} from '@/store/api/comparisonApi';
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

interface ComparisonContainerProps {
  /** When set, preloads this comparison ID from the URL (e.g. /compare/[id]) */
  initialComparisonId?: string;
}

export function ComparisonContainer({ initialComparisonId }: ComparisonContainerProps = {}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const { isLoading, models, currentPrompt, comparisonId: currentComparisonId, syncScroll } = useAppSelector((state) => state.comparison);
  const lastPromptRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);
  const snapshotRestoredRef = useRef(false);

  // ── Persist in-flight state to localStorage on every models change ───────────
  // This is more reliable than beforeunload (which can be skipped by browsers).
  useEffect(() => {
    const hasInFlight = Object.values(models).some(
      (m) =>
        m.status === ModelStatus.STREAMING ||
        m.status === ModelStatus.PENDING ||
        m.status === ModelStatus.INTERRUPTED
    );
    if (Object.keys(models).length === 0) {
      // New chat or reset — clear any stale snapshot
      localStorage.removeItem('comparison_snapshot');
      return;
    }
    if (hasInFlight) {
      try {
        localStorage.setItem(
          'comparison_snapshot',
          JSON.stringify({ comparisonId: currentComparisonId, currentPrompt, models })
        );
      } catch {
        // quota exceeded — ignore
      }
    } else {
      // All models completed/errored — clear the snapshot
      localStorage.removeItem('comparison_snapshot');
    }
  }, [models, currentPrompt, currentComparisonId]);

  // ── Restore snapshot on mount (runs before history query can overwrite) ──────
  useEffect(() => {
    if (snapshotRestoredRef.current) return;
    snapshotRestoredRef.current = true;
    try {
      const saved = localStorage.getItem('comparison_snapshot');
      if (!saved) return;
      const snapshot = JSON.parse(saved) as {
        comparisonId: string | null;
        currentPrompt: string;
        models: Record<string, import('@/store/slices/comparisonSlice').ModelStreamState>;
      };
      if (!snapshot.models || Object.keys(snapshot.models).length === 0) return;
      dispatch(restoreFromSnapshot(snapshot));
      if (snapshot.currentPrompt) lastPromptRef.current = snapshot.currentPrompt;
      // Prevent the URL-based history query from overwriting restored state
      initializedRef.current = true;
    } catch {
      // Ignore corrupted snapshot
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [promptDraft, setPromptDraft] = useState('');
  const [localHistory, setLocalHistory] = useState<Comparison[]>([]);
  const [deleteComparison] = useDeleteComparisonMutation();
  const {
    data: authenticatedHistory,
    refetch: refetchHistory,
    isUninitialized: historyQueryUninitialized,
  } = useListComparisonsQuery(
    { limit: 20, offset: 0 },
    { skip: !isAuthenticated }
  );

  // Fetch the comparison from the URL param (e.g. /compare/[id])
  const { data: initialComparison } = useGetComparisonQuery(
    initialComparisonId ?? '',
    { skip: !initialComparisonId }
  );

  // Hydrate Redux state once when the comparison data arrives
  useEffect(() => {
    if (!initialComparison || initializedRef.current) return;
    initializedRef.current = true;
    dispatch(
      setComparisonFromHistory({
        comparisonId: initialComparison.comparison_id,
        prompt: initialComparison.prompt,
        responses: initialComparison.responses,
      })
    );
    lastPromptRef.current = initialComparison.prompt;
  }, [initialComparison, dispatch]);

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
    router.push('/compare');
  }, [dispatch, router]);

  const openChat = useCallback(
    (chat: Comparison) => {
      dispatch(
        setComparisonFromHistory({
          comparisonId: chat.comparison_id,
          prompt: chat.prompt,
          responses: chat.responses,
        })
      );
      setPromptDraft('');
      lastPromptRef.current = chat.prompt;
      // Sync the URL so the link is shareable/bookmarkable
      router.push(`/compare/${chat.comparison_id}`);
    },
    [dispatch, router]
  );

  const handleSubmit = useCallback(
    async (
      prompt: string,
      modelIds: string[] = DEFAULT_MODELS,
      options?: { isRetry?: boolean; comparisonId?: string }
    ) => {
      // Determine if we should update an existing comparison
      const existingComparisonId = options?.comparisonId || currentComparisonId;
      const isUpdate = !options?.isRetry && !!existingComparisonId && existingComparisonId !== 'pending';

      lastPromptRef.current = prompt;
      setPromptDraft('');
      dispatch(setPrompt(prompt));
      let selectedModels = modelIds;
      let completedComparisonId = existingComparisonId || `local-${Date.now()}`;
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
            comparisonId: existingComparisonId || 'pending',
            models: selectedModels,
          })
        );
      }

      // Abort any in-flight request before starting a new one.
      // For single-model retries, keep the original stream alive so other
      // panels continue rendering; only abort on full new-prompt submissions.
      if (!options?.isRetry) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort('superseded');
        }
      }
      const abortController = new AbortController();
      if (!options?.isRetry) {
        abortControllerRef.current = abortController;
      }

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
                      // Use updateComparisonId to set the real ID without
                      // wiping the models record. The initial startComparison
                      // call (before fetch) already set up all model entries.
                      dispatch(
                        updateComparisonId({
                          comparisonId: data.comparisonId,
                        })
                      );
                      // Ensure model entries exist for any newly-resolved IDs
                      // (defensive — handles ID mismatch between pre-fetch
                      // and backend-resolved model IDs)
                      if (!options?.isRetry) {
                        resolvedModels.forEach((mId: string) => {
                          dispatch(
                            modelStarted({
                              modelId: mId,
                              provider: getProviderForModel(mId),
                            })
                          );
                        });
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
                  case SSEEventType.MODEL_TOOL_CALL:
                    if (data.toolCall) {
                      dispatch(
                        addToolCall({
                          modelId: data.modelId!,
                          toolCall: data.toolCall,
                        })
                      );
                    }
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
                        finishReason: data.finishReason,
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
                        category: data.category,
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
        // If this request was superseded by a new submission, silently discard —
        // the new comparison's startComparison already reset the Redux state.
        if (error instanceof DOMException && error.name === 'AbortError') {
          wasSuperseded = true;
        } else {
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
        }
      } finally {
        if (wasSuperseded) return; // new submission took over — skip cleanup

        // For single-model retries the original multi-model stream owns isLoading;
        // calling comparisonCompleted() here would prematurely unset it while
        // the other panels are still streaming.
        if (!options?.isRetry) {
          dispatch(comparisonCompleted());

          // Update the URL to reflect the saved comparison (skip local/anon drafts)
          if (
            completedComparisonId &&
            !completedComparisonId.startsWith('local-') &&
            !completedComparisonId.startsWith('anon-')
          ) {
            router.replace(`/compare/${completedComparisonId}`);
          }
        }

        // Build the completed comparison object for local history
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
          // Single model regenerate: update just that model in history
          const retryModelId = selectedModels[0];
          const retryModel = modelAccumulator[retryModelId];
          if (retryModel) {
            setLocalHistory((previous) => {
              const updated = previous.map((chat) => {
                if (chat.comparison_id !== completedComparisonId) return chat;
                return {
                  ...chat,
                  responses: chat.responses.map((r) =>
                    r.model_id === retryModelId
                      ? {
                          ...r,
                          response_text: retryModel.responseText || '',
                          status:
                            retryModel.status === ModelStatus.ERROR
                              ? ResponseStatus.ERROR
                              : retryModel.status === ModelStatus.COMPLETED
                                ? ResponseStatus.COMPLETED
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
          // New or update: upsert in history
          setLocalHistory((previous) => {
            const existingIndex = previous.findIndex(
              (c) => c.comparison_id === completedComparison.comparison_id
            );
            let updatedHistory: Comparison[];
            if (existingIndex >= 0) {
              // Update existing entry
              updatedHistory = [...previous];
              updatedHistory[existingIndex] = completedComparison;
            } else {
              // Prepend new entry
              updatedHistory = [completedComparison, ...previous].slice(0, MAX_ANONYMOUS_CHATS);
            }
            persistLocalHistory(updatedHistory);
            return updatedHistory;
          });
        }

        // Refetch server-side history if authenticated and the query has
        // already been started (avoids "Cannot refetch an uninitialized query").
        if (isAuthenticated && !historyQueryUninitialized) {
          refetchHistory();
        }
      }
    },
    [dispatch, isAuthenticated, currentComparisonId, refetchHistory, router]
  );

  const handleRetry = useCallback((modelId: string) => {
    const prompt = lastPromptRef.current || currentPrompt;
    if (prompt) {
      // Never pass 'pending' — it's a placeholder set before the server assigns a real UUID
      const safeComparisonId =
        currentComparisonId && currentComparisonId !== 'pending'
          ? currentComparisonId
          : undefined;
      handleSubmit(prompt, [modelId], { isRetry: true, comparisonId: safeComparisonId });
    }
  }, [handleSubmit, currentPrompt, currentComparisonId]);

  const handleEditPrompt = useCallback((text: string) => {
    setPromptDraft(text);
  }, []);

  const handleDeleteChat = useCallback(async (comparisonId: string) => {
    // Remove from local history
    setLocalHistory((previous) => {
      const updated = previous.filter((c) => c.comparison_id !== comparisonId);
      persistLocalHistory(updated);
      return updated;
    });

    // Delete from server if authenticated
    if (isAuthenticated) {
      try {
        await deleteComparison(comparisonId).unwrap();
      } catch {
        // Ignore — already removed locally
      }
    }

    // If the deleted chat is the active one, reset
    if (currentComparisonId === comparisonId) {
      dispatch(resetComparison());
      setPromptDraft('');
      lastPromptRef.current = '';
    }
  }, [isAuthenticated, deleteComparison, currentComparisonId, dispatch]);

  const persistLocalHistory = (history: Comparison[]) => {
    if (isAuthenticated) return;
    try {
      localStorage.setItem(ANONYMOUS_CHAT_HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Ignore
    }
  };

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-1 lg:grid-cols-[260px_1fr]">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col border-r border-[#30363D] bg-[#0B0F17]">
        <button
          type="button"
          onClick={handleNewChat}
          className="m-3 rounded-lg border border-[#30363D] bg-[#161B22] px-3 py-2.5 text-left text-sm font-medium text-[#F0F6FC] transition-all duration-200 hover:bg-[#1C2128] hover:border-[#8B949E]/40"
        >
          + New chat
        </button>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {chatHistory.length === 0 ? (
            <p className="px-3 py-4 text-xs text-[#8B949E]/60">
              No chats yet
            </p>
          ) : (
            chatHistory.map((chat) => {
              const isActive = currentComparisonId === chat.comparison_id;
              return (
                <div
                  key={chat.comparison_id}
                  className={`group relative flex items-center rounded-lg transition-all duration-150 ${
                    isActive
                      ? 'bg-primary-500/10 border-l-2 border-primary-500'
                      : 'hover:bg-[#1C2128]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openChat(chat)}
                    className="min-w-0 flex-1 px-3 py-2.5 text-left text-sm"
                  >
                    <p className={`truncate font-medium ${
                      isActive
                        ? 'text-primary-400'
                        : 'text-[#8B949E] group-hover:text-[#F0F6FC]'
                    }`}>{chat.prompt}</p>
                    <p className="mt-0.5 text-[11px] text-[#8B949E]/50">
                      {new Date(chat.created_at).toLocaleString()}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.comparison_id); }}
                    title="Delete chat"
                    className="mr-2 shrink-0 rounded-md p-1 text-[#8B949E]/40 opacity-0 transition-all hover:bg-[#F85149]/10 hover:text-[#F85149] group-hover:opacity-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </nav>
      </aside>

      {/* ── Main area ───────────────────────────────────────── */}
      <section className="relative flex flex-col overflow-hidden">
        {Object.keys(models).length === 0 ? (
          /* Welcome screen */
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center animate-fade-in-up">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary-500 to-[#10A37F] text-white text-xl font-bold shadow-glow">
                AI
              </div>
              <h2 className="text-2xl font-semibold text-[#F0F6FC]">
                Ready when you are
              </h2>
              <p className="mt-2 text-sm text-[#8B949E]">
                Ask anything to compare responses across AI models
              </p>
              {/* Model indicators */}
              <div className="mt-6 flex items-center justify-center gap-4">
                {[{ color: '#10A37F', label: 'GPT-4o' }, { color: '#D97757', label: 'Claude 3' }, { color: '#E5E7EB', label: 'Grok' }].map((m) => (
                  <div key={m.label} className="flex items-center gap-1.5 text-xs text-[#8B949E]">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color, boxShadow: `0 0 6px ${m.color}80` }} />
                    {m.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Chat content */
          <div className="flex-1 overflow-y-auto px-4 py-4 pb-48 sm:px-6">
            <ComparisonView
              models={models}
              currentPrompt={currentPrompt}
              syncScroll={syncScroll}
              onRetry={handleRetry}
              onRegenerate={handleRetry}
              onEditPrompt={handleEditPrompt}
            />
          </div>
        )}

        {/* Sticky bottom bar */}
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-[#30363D] bg-[#0B0F17]/90 backdrop-blur-md">
          <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {!isAuthenticated && (
                  <p className="text-xs text-[#8B949E]">
                    💡 Sign in to save comparisons
                  </p>
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[#8B949E] hover:text-[#F0F6FC] transition-colors">
                <input
                  type="checkbox"
                  checked={syncScroll}
                  onChange={() => dispatch(toggleSyncScroll())}
                  className="rounded border-[#30363D] accent-primary-500 focus:ring-primary-500"
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
        </div>
      </section>
    </div>
  );
}
