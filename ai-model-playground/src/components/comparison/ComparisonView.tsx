import { memo, useState, useRef, useCallback } from 'react';
import { ModelPanel } from '@/components/comparison/ModelPanel';
import type { ModelStreamState } from '@/store/slices/comparisonSlice';
import { allModelsDone } from '@/store/slices/comparisonSlice';

interface ComparisonViewProps {
  models: Record<string, ModelStreamState>;
  currentPrompt?: string;
  syncScroll?: boolean;
  /** (modelId) => void — stable callback from parent */
  onRetry?: (modelId: string) => void;
  /** (modelId) => void — stable callback from parent */
  onRegenerate?: (modelId: string) => void;
  onEditPrompt?: (text: string) => void;
}

/** Presentational component — user message bubble + model response columns */
export const ComparisonView = memo(function ComparisonView({
  models,
  currentPrompt,
  syncScroll = true,
  onRetry,
  onRegenerate,
  onEditPrompt,
}: ComparisonViewProps) {
  const modelEntries = Object.values(models);
  const [promptCopied, setPromptCopied] = useState(false);
  const scrollRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const isSyncingRef = useRef(false);

  const registerScrollRef = useCallback((modelId: string, el: HTMLDivElement | null) => {
    if (el) {
      scrollRefsMap.current.set(modelId, el);
    } else {
      scrollRefsMap.current.delete(modelId);
    }
  }, []);

  const handleSyncScroll = useCallback((sourceModelId: string) => {
    // Only sync when toggle is on AND all models are done/error (not streaming)
    if (!syncScroll || isSyncingRef.current || !allModelsDone(models)) return;
    const sourceEl = scrollRefsMap.current.get(sourceModelId);
    if (!sourceEl) return;

    isSyncingRef.current = true;

    const { scrollTop, scrollHeight, clientHeight } = sourceEl;
    const scrollRatio = scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;

    scrollRefsMap.current.forEach((targetEl, id) => {
      if (id === sourceModelId) return;
      const targetMax = targetEl.scrollHeight - targetEl.clientHeight;
      if (targetMax > 0) {
        targetEl.scrollTop = scrollRatio * targetMax;
      }
    });

    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  }, [syncScroll, models]);

  const handleCopyPrompt = async () => {
    if (!currentPrompt) return;
    try {
      await navigator.clipboard.writeText(currentPrompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  // Retry / regenerate: already (modelId) => void — no turnId wrapping needed
  const handleRetry = onRetry ?? (() => {});
  const handleRegenerate = onRegenerate ?? (() => {});

  if (modelEntries.length === 0) {
    return null;
  }

  // Derive a stable list of modelIds so the grid doesn't change identity
  const modelIds = modelEntries.map((m) => m.modelId);

  return (
    <div className="space-y-6">
      {/* User message bubble — right-aligned like ChatGPT */}
      {currentPrompt && (
        <div className="flex justify-end">
          <div className="group relative max-w-[80%]">
            <div className="rounded-2xl rounded-tr-sm bg-primary-600 px-4 py-3 text-white shadow-sm">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{currentPrompt}</p>
            </div>
            {/* Action buttons below the bubble */}
            <div className="mt-1.5 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={handleCopyPrompt}
                title="Copy message"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
                  <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
                </svg>
                {promptCopied ? 'Copied' : 'Copy'}
              </button>
              {onEditPrompt && (
                <button
                  type="button"
                  onClick={() => onEditPrompt(currentPrompt)}
                  title="Edit message"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M2.695 14.764a1.816 1.816 0 0 1 0 2.541 1.163 1.163 0 0 1-1.447.208l-.454-.227a1.452 1.452 0 0 1-.622-1.608l.364-1.643a.25.25 0 0 1 .063-.107L2.695 14.764ZM5.394 7.965l6.94-6.94a2.5 2.5 0 0 1 3.535 3.536l-6.94 6.94a1.5 1.5 0 0 1-.625.399l-2.42.807a.5.5 0 0 1-.632-.632l.808-2.42a1.5 1.5 0 0 1 .399-.625l-.065-.065Z" />
                  </svg>
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Three model response columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {modelIds.map((modelId) => (
          <StableModelPanel
            key={modelId}
            model={models[modelId]}
            onRetry={handleRetry}
            onRegenerate={handleRegenerate}
            registerScrollRef={registerScrollRef}
            handleSyncScroll={handleSyncScroll}
          />
        ))}
      </div>
    </div>
  );
});

// ─── Stable wrapper that prevents new function refs from breaking ModelPanel memo ──

interface StableModelPanelProps {
  model: ModelStreamState;
  onRetry: (modelId: string) => void;
  onRegenerate: (modelId: string) => void;
  registerScrollRef: (modelId: string, el: HTMLDivElement | null) => void;
  handleSyncScroll: (modelId: string) => void;
}

const StableModelPanel = memo(function StableModelPanel({
  model,
  onRetry,
  onRegenerate,
  registerScrollRef,
  handleSyncScroll,
}: StableModelPanelProps) {
  const scrollRefCb = useCallback(
    (el: HTMLDivElement | null) => registerScrollRef(model.modelId, el),
    [registerScrollRef, model.modelId]
  );
  const onScrollCb = useCallback(
    () => handleSyncScroll(model.modelId),
    [handleSyncScroll, model.modelId]
  );

  return (
    <ModelPanel
      modelId={model.modelId}
      provider={model.provider}
      status={model.status}
      responseText={model.responseText}
      errorMessage={model.errorMessage}
      errorCategory={model.errorCategory}
      metrics={model.metrics}
      finishReason={model.finishReason}
      toolCalls={model.toolCalls}
      onRetry={onRetry}
      onRegenerate={onRegenerate}
      scrollRef={scrollRefCb}
      onScroll={onScrollCb}
    />
  );
});
