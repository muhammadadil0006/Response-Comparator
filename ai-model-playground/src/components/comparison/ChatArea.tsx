'use client';

import { memo } from 'react';
import { useAppSelector } from '@/store/hooks';
import { ComparisonView } from '@/components/comparison/ComparisonView';

interface ChatAreaProps {
  /** (modelId) => void */
  onRetry: (modelId: string) => void;
  onEditPrompt: (text: string) => void;
}

/**
 * Single-comparison view — subscribes to Redux for the active comparison.
 * Only re-renders when models record or prompt changes.
 */
export const ChatArea = memo(function ChatArea({
  onRetry,
  onEditPrompt,
}: ChatAreaProps) {
  const models = useAppSelector((s) => s.comparison.models);
  const prompt = useAppSelector((s) => s.comparison.prompt);
  const syncScroll = useAppSelector((s) => s.comparison.syncScroll);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 pb-48 sm:px-6">
      <ComparisonView
        models={models}
        currentPrompt={prompt}
        syncScroll={syncScroll}
        onRetry={onRetry}
        onRegenerate={onRetry}
        onEditPrompt={onEditPrompt}
      />
    </div>
  );
});
