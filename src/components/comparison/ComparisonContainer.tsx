'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { KebabMenu, type KebabMenuItem } from '@/components/ui/KebabMenu';
import {
  setPrompt,
  startComparison,
  updateComparisonId,
  modelStarted,
  flushChunks,
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
  /**
   * Force the view into read-only mode regardless of ownership.
   * Used by the /share/[id] route. When the owner opens a share link
   * they are automatically redirected to /compare/[id] instead.
   */
  forceReadOnly?: boolean;
}

export function ComparisonContainer({ initialComparisonId, forceReadOnly = false }: ComparisonContainerProps = {}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const { isLoading, models, currentPrompt, comparisonId: currentComparisonId, syncScroll } = useAppSelector((state) => state.comparison);
  const lastPromptRef = useRef<string>('');
  // Per-model abort controllers so individual regenerations never cancel each other.
  // Key = modelId for single-model retries, '__all__' for full submissions.
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const initializedRef = useRef(false);
  const snapshotRestoredRef = useRef(false);
  // ── Per-model streaming RAF flush ───────────────────────────────────────────
  // Each model gets its own independent requestAnimationFrame handle so they
  // never block or cancel each other.
  //   • modelId → rAF handle (null when no frame is pending for that model)
  //   • At most one pending frame per model → ~60 Redux dispatches/sec per
  //     model instead of one per token (which can be 100s/sec)
  const pendingRafsRef = useRef<Map<string, number>>(new Map());
  // Stable ref to modelAccumulator so rAF callbacks always read the latest
  // text without needing to be recreated.
  const modelAccumulatorRef = useRef<Record<string, { provider: string; responseText: string; status: import('@/types/enums').ModelStatus; errorMessage?: string; metrics?: import('@/types/comparison').SSEDataPayload['metrics'] }>>({})

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
  // IDs that have been deleted optimistically – filtered from chatHistory
  // immediately so the item disappears from the sidebar before the RTK
  // invalidation refetch clears it from authenticatedHistory.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
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

  // Read-only when:
  //   a) Opened via /share/[id] (forceReadOnly) AND the user is not the owner, OR
  //   b) Loaded from /compare/[id] and the server says they don't own it.
  const isReadOnly =
    (forceReadOnly && !!initialComparison && initialComparison.is_owner === false) ||
    (!forceReadOnly && !!initialComparisonId && !!initialComparison && initialComparison.is_owner === false);

  // On the /share/[id] route: if the viewer IS the owner, silently redirect
  // them to their real, editable chat at /compare/[id].
  useEffect(() => {
    if (!forceReadOnly || !initialComparison) return;
    if (initialComparison.is_owner === true) {
      router.replace(`/compare/${initialComparison.comparison_id}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceReadOnly, initialComparison]);

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
    let base: Comparison[];
    if (!isAuthenticated) {
      base = localHistory;
    } else {
      const combined = [...localHistory, ...(authenticatedHistory?.comparisons || [])];
      const seen = new Set<string>();
      const deduplicated: Comparison[] = [];

      for (const chat of combined) {
        if (seen.has(chat.comparison_id)) continue;
        seen.add(chat.comparison_id);
        deduplicated.push(chat);
      }

      base = deduplicated.slice(0, 20);
    }
    // Optimistically hide items that are in the process of being deleted
    // (before the RTK invalidation refetch has a chance to remove them)
    return deletedIds.size > 0
      ? base.filter((c) => !deletedIds.has(c.comparison_id))
      : base;
  }, [authenticatedHistory?.comparisons, isAuthenticated, localHistory, deletedIds]);

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

      // Build the local accumulator for this invocation's models.
      // For retries: merge into the EXISTING shared ref so other models'
      // in-flight RAF callbacks continue to find their text — only reset
      // the retried model's entry.
      // For full submissions: replace entirely (new prompt = fresh state).
      const freshEntries = selectedModels.reduce<
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

      let modelAccumulator: typeof freshEntries;
      if (options?.isRetry) {
        // Merge: keep all existing model data, only reset the retried model.
        modelAccumulatorRef.current = { ...modelAccumulatorRef.current, ...freshEntries };
        modelAccumulator = modelAccumulatorRef.current;
      } else {
        // Full submission — replace everything.
        modelAccumulator = freshEntries;
        modelAccumulatorRef.current = modelAccumulator;
      }

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

      // For a full new-prompt submission: abort ALL in-flight streams (full + any
      // per-model retries) so nothing from the old prompt leaks into the new one.
      // For a single-model retry: abort ONLY that model's previous stream so other
      // models (whether streaming or already done) are completely unaffected.
      const abortKey = options?.isRetry ? selectedModels[0] : '__all__';
      if (options?.isRetry) {
        // Only cancel the specific model being retried.
        abortControllersRef.current.get(selectedModels[0])?.abort('superseded');
        abortControllersRef.current.delete(selectedModels[0]);
      } else {
        // New prompt — cancel everything.
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
                      // Build fresh entries for only the models in this stream.
                      const resolvedEntries = resolvedModels.reduce<typeof modelAccumulator>(
                        (acc, mId) => {
                          acc[mId] = {
                            provider: getProviderForModel(mId),
                            responseText: '',
                            status: ModelStatus.IDLE,
                          };
                          return acc;
                        },
                        {}
                      );
                      if (options?.isRetry) {
                        // Merge — keep other models' accumulated text intact
                        // so their in-flight RAF callbacks are unaffected.
                        modelAccumulatorRef.current = { ...modelAccumulatorRef.current, ...resolvedEntries };
                      } else {
                        modelAccumulatorRef.current = resolvedEntries;
                      }
                      modelAccumulator = modelAccumulatorRef.current;
                      // Use updateComparisonId to set the real ID without
                      // wiping the models record. The initial startComparison
                      // call (before fetch) already set up all model entries.
                      dispatch(
                        updateComparisonId({
                          comparisonId: data.comparisonId,
                        })
                      );
                      // Ensure all resolved model entries exist and are in
                      // STREAMING state before chunks arrive.  This applies
                      // to both new generations AND retries so the streaming
                      // animation starts at the same point in both cases.
                      resolvedModels.forEach((mId: string) => {
                        dispatch(
                          modelStarted({
                            modelId: mId,
                            provider: getProviderForModel(mId),
                          })
                        );
                      });
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
                  case SSEEventType.MODEL_CHUNK: {
                    const chunkModelId = data.modelId!;
                    modelAccumulator[chunkModelId] = {
                      ...(modelAccumulator[chunkModelId] || {
                        provider: getProviderForModel(chunkModelId),
                        responseText: '',
                        status: ModelStatus.IDLE,
                      }),
                      responseText:
                        (modelAccumulator[chunkModelId]?.responseText || '') + data.chunk!,
                      status: ModelStatus.STREAMING,
                    };
                    // Schedule one RAF per model independently.
                    // If this model already has a frame pending, the new chunk
                    // is already in modelAccumulator and will be picked up when
                    // that frame fires — no extra dispatch needed.
                    if (!pendingRafsRef.current.has(chunkModelId)) {
                      const rafId = requestAnimationFrame(() => {
                        pendingRafsRef.current.delete(chunkModelId);
                        const text = modelAccumulatorRef.current[chunkModelId]?.responseText ?? '';
                        dispatch(flushChunks([{ modelId: chunkModelId, text }]));
                      });
                      pendingRafsRef.current.set(chunkModelId, rafId);
                    }
                    break;
                  }
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
                  case SSEEventType.MODEL_COMPLETED: {
                    const completedModelId = data.modelId!;
                    modelAccumulator[completedModelId] = {
                      ...(modelAccumulator[completedModelId] || {
                        provider: getProviderForModel(completedModelId),
                        responseText: '',
                        status: ModelStatus.IDLE,
                      }),
                      status: ModelStatus.COMPLETED,
                      metrics: data.metrics,
                    };
                    // Cancel only THIS model's RAF and flush its final text.
                    // Other models' RAFs are completely unaffected.
                    const completedRaf = pendingRafsRef.current.get(completedModelId);
                    if (completedRaf !== undefined) {
                      cancelAnimationFrame(completedRaf);
                      pendingRafsRef.current.delete(completedModelId);
                    }
                    dispatch(flushChunks([{ modelId: completedModelId, text: modelAccumulator[completedModelId]?.responseText || '' }]));
                    dispatch(
                      modelCompleted({
                        modelId: completedModelId,
                        metrics: data.metrics ?? null,
                        finishReason: data.finishReason,
                      })
                    );
                    break;
                  }
                  case SSEEventType.MODEL_ERROR: {
                    const errorModelId = data.modelId!;
                    modelAccumulator[errorModelId] = {
                      ...(modelAccumulator[errorModelId] || {
                        provider: getProviderForModel(errorModelId),
                        responseText: '',
                        status: ModelStatus.IDLE,
                      }),
                      status: ModelStatus.ERROR,
                      errorMessage: extractErrorMessage(data.error, 'Unexpected error'),
                    };
                    // Cancel only this model's RAF — others keep running.
                    const errorRaf = pendingRafsRef.current.get(errorModelId);
                    if (errorRaf !== undefined) {
                      cancelAnimationFrame(errorRaf);
                      pendingRafsRef.current.delete(errorModelId);
                    }
                    dispatch(flushChunks([{ modelId: errorModelId, text: modelAccumulator[errorModelId]?.responseText || '' }]));
                    dispatch(
                      modelError({
                        modelId: errorModelId,
                        error: extractErrorMessage(data.error, 'Unexpected error'),
                        category: data.category,
                      })
                    );
                    break;
                  }
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
        // Remove this stream's controller from the map now that it's done.
        abortControllersRef.current.delete(abortKey);

        if (wasSuperseded) return; // new submission took over — skip cleanup

        // Always mark the comparison as completed so isLoading is reset
        // correctly — this is safe for both full generations and retries since
        // each stream has its own AbortController now.
        dispatch(comparisonCompleted());

        // Update the URL to reflect the saved comparison (skip local/anon drafts
        // and skip retries — the URL is already correct for a retry).
        if (
          !options?.isRetry &&
          completedComparisonId &&
          !completedComparisonId.startsWith('local-') &&
          !completedComparisonId.startsWith('anon-')
        ) {
          router.replace(`/compare/${completedComparisonId}`);
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
    if (!prompt) return;
    // Regenerate only the clicked model — other panels stay untouched.
    const safeComparisonId =
      currentComparisonId && currentComparisonId !== 'pending'
        ? currentComparisonId
        : undefined;
    handleSubmit(prompt, [modelId], { isRetry: true, comparisonId: safeComparisonId });
  }, [handleSubmit, currentPrompt, currentComparisonId]);

  const handleEditPrompt = useCallback((text: string) => {
    setPromptDraft(text);
  }, []);

  const handleDeleteChat = useCallback(async (comparisonId: string) => {
    // ── 1. Optimistic removal ─────────────────────────────────────────────────
    // Mark as deleted immediately so the sidebar hides it before the server
    // call and RTK refetch have a chance to settle.
    setDeletedIds((prev) => new Set(prev).add(comparisonId));
    setLocalHistory((previous) => {
      const updated = previous.filter((c) => c.comparison_id !== comparisonId);
      persistLocalHistory(updated);
      return updated;
    });

    // ── 2. Server delete ──────────────────────────────────────────────────────
    if (isAuthenticated) {
      try {
        await deleteComparison(comparisonId).unwrap();
        // RTK invalidation triggers a refetch of authenticatedHistory;
        // once that arrives the ID is naturally absent, so unmark it.
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(comparisonId);
          return next;
        });
      } catch {
        // Server delete failed — restore the item by removing from deletedIds
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(comparisonId);
          return next;
        });
      }
    }

    // ── 3. Clear active state + navigate away if this was the open chat ───────
    // Check both the Redux comparisonId and the URL-level initialComparisonId so
    // that delete works whether the user is on /compare/<id> or just in the sidebar.
    const isActivelySeen =
      currentComparisonId === comparisonId ||
      initialComparisonId === comparisonId;

    if (isActivelySeen) {
      dispatch(resetComparison());
      setPromptDraft('');
      lastPromptRef.current = '';
      // Navigate to /compare (no ID) to clear the URL so the deleted
      // comparison is never attempted to be fetched again.
      router.push('/compare');
    }
  }, [isAuthenticated, deleteComparison, currentComparisonId, initialComparisonId, dispatch, router]);

  const persistLocalHistory = (history: Comparison[]) => {
    if (isAuthenticated) return;
    try {
      localStorage.setItem(ANONYMOUS_CHAT_HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Ignore
    }
  };

  // ── Share helpers ────────────────────────────────────────────────────────────
  const [activeCopiedId, setActiveCopiedId] = useState<string | null>(null);

  const handleShareChat = useCallback((comparisonId: string) => {
    if (comparisonId.startsWith('anon-') || comparisonId === 'pending') {
      alert('Sign in to save and share this comparison.');
      return;
    }
    try {
      // Always use the /share/<id> route so recipients always get the
      // read-only view. Owners who open this link are redirected to
      // /compare/<id> automatically by the share page.
      const url = `${window.location.origin}/share/${comparisonId}`;
      navigator.clipboard.writeText(url);
      setActiveCopiedId(comparisonId);
      setTimeout(() => setActiveCopiedId(null), 1500);
    } catch {
      // ignore
    }
  }, []);

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
                  {/* Kebab menu — only visible on hover via group-hover */}
                  <div className="mr-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <KebabMenu
                      align="right"
                      triggerClassName="flex h-6 w-6 items-center justify-center rounded-md text-[#8B949E]/50 transition-colors hover:bg-[#1C2128] hover:text-[#F0F6FC]"
                      items={[
                        {
                          label: 'Open',
                          icon: (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                              <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                              <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
                            </svg>
                          ),
                          onClick: () => openChat(chat),
                        },
                        {
                          label: activeCopiedId === chat.comparison_id ? 'Copied!' : 'Copy link',
                          icon: (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                              <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                              <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                            </svg>
                          ),
                          onClick: () => handleShareChat(chat.comparison_id),
                        },
                        {
                          label: 'Delete',
                          icon: (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                            </svg>
                          ),
                          onClick: () => handleDeleteChat(chat.comparison_id),
                          variant: 'danger',
                        },
                      ] satisfies KebabMenuItem[]}
                    />
                  </div>
                </div>
              );
            })
          )}
        </nav>
      </aside>

      {/* ── Main area ───────────────────────────────────────── */}
      <section className="relative flex flex-col overflow-hidden">
        {/* ── Read-only banner (shared view) ─────────────────── */}
        {isReadOnly && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-300/30 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
              </svg>
              <span>
                <span className="font-semibold">Read-only</span>
                {" — this is a shared copy of someone\u2019s conversation. "}
                Messaging is disabled.
              </span>
            </div>
            <ReadOnlyCopyButton shareId={initialComparisonId!} />
          </div>
        )}

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
          <div className={`flex-1 overflow-y-auto px-4 py-4 sm:px-6 ${isReadOnly ? 'pb-4' : 'pb-48'}`}>
            <ComparisonView
              models={models}
              currentPrompt={currentPrompt}
              syncScroll={syncScroll}
              onRetry={isReadOnly ? undefined : handleRetry}
              onRegenerate={isReadOnly ? undefined : handleRetry}
              onEditPrompt={isReadOnly ? undefined : handleEditPrompt}
            />
          </div>
        )}

        {/* Sticky bottom bar — hidden in read-only shared view */}
        {!isReadOnly && (
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
        )}
      </section>
    </div>
  );
}

// ── ReadOnlyCopyButton ──────────────────────────────────────────────────────────────

/**
 * Small copy-button that lives inside the read-only banner.
 * Copies the canonical /share/<id> URL regardless of the current
 * URL so the recipient always gets the shareable link.
 */
function ReadOnlyCopyButton({ shareId }: { shareId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const url = `${window.location.origin}/share/${shareId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded px-2 py-0.5 font-medium transition-colors hover:bg-amber-800/40"
    >
      {copied ? '✓ Copied!' : 'Copy link'}
    </button>
  );
}
