'use client';

import { useCallback, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { toggleSyncScroll } from '@/store/slices/comparisonSlice';
import { useComparisonHistory } from '@/hooks/useComparisonHistory';
import { useStreamingComparison } from '@/hooks/useStreamingComparison';
import { ChatSidebar } from '@/components/comparison/ChatSidebar';
import { ChatArea } from '@/components/comparison/ChatArea';
import { ChatBottomBar } from '@/components/comparison/ChatBottomBar';
import { WelcomeScreen } from '@/components/comparison/WelcomeScreen';

/**
 * Thin orchestrator — wires hooks and dumb/smart components together.
 * Single-comparison mode: one prompt → three model responses.
 */
export function ComparisonContainer() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector((s) => s.comparison.isLoading);
  const hasComparison = useAppSelector(
    (s) => Object.keys(s.comparison.models).length > 0,
  );
  const syncScroll = useAppSelector((s) => s.comparison.syncScroll);

  const [promptDraft, setPromptDraft] = useState('');

  // ─── Comparison history (sidebar, open, delete, persistence) ──────────
  const {
    sidebarComparisons,
    comparisonId,
    handleNewComparison: rawNew,
    handleOpenComparison: rawOpen,
    handleDeleteComparison,
    persistAnonComparison,
    handleStreamComplete,
  } = useComparisonHistory();

  // ─── SSE streaming logic ──────────────────────────────────────────────
  const { handleSubmit: rawSubmit, handleRetry } = useStreamingComparison({
    onPersistAnonComparison: persistAnonComparison,
    onStreamComplete: handleStreamComplete,
  });

  // ─── Stable UI callbacks ──────────────────────────────────────────────
  const handleNewComparison = useCallback(() => {
    rawNew();
    setPromptDraft('');
  }, [rawNew]);

  const handleOpenComparison = useCallback(
    (id: string) => {
      rawOpen(id);
      setPromptDraft('');
    },
    [rawOpen],
  );

  const handleSubmit = useCallback(
    (prompt: string) => {
      setPromptDraft('');
      rawSubmit(prompt);
    },
    [rawSubmit],
  );

  const handleEditPrompt = useCallback((text: string) => {
    setPromptDraft(text);
  }, []);

  const handleToggleSyncScroll = useCallback(() => {
    dispatch(toggleSyncScroll());
  }, [dispatch]);

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="grid h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[260px_1fr]">
      <ChatSidebar
        comparisons={sidebarComparisons}
        activeComparisonId={comparisonId}
        onNewComparison={handleNewComparison}
        onOpenComparison={handleOpenComparison}
        onDeleteComparison={handleDeleteComparison}
      />

      <section className="relative flex flex-col overflow-hidden">
        {hasComparison ? (
          <ChatArea onRetry={handleRetry} onEditPrompt={handleEditPrompt} />
        ) : (
          <WelcomeScreen />
        )}

        <ChatBottomBar
          isLoading={isLoading}
          isAuthenticated={isAuthenticated}
          syncScroll={syncScroll}
          promptDraft={promptDraft}
          onPromptChange={setPromptDraft}
          onSubmit={handleSubmit}
          onToggleSyncScroll={handleToggleSyncScroll}
        />
      </section>
    </div>
  );
}
