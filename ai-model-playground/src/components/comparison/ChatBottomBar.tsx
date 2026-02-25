'use client';

import { memo } from 'react';
import { PromptInput } from '@/components/comparison/PromptInput';

interface ChatBottomBarProps {
  isLoading: boolean;
  isAuthenticated: boolean;
  syncScroll: boolean;
  promptDraft: string;
  onPromptChange: (value: string) => void;
  onSubmit: (prompt: string) => void;
  onToggleSyncScroll: () => void;
}

/** Dumb component — sticky bottom bar with input + controls */
export const ChatBottomBar = memo(function ChatBottomBar({
  isLoading,
  isAuthenticated,
  syncScroll,
  promptDraft,
  onPromptChange,
  onSubmit,
  onToggleSyncScroll,
}: ChatBottomBarProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/80">
      <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isAuthenticated && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                💡 Sign in to save comparisons
              </p>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={onToggleSyncScroll}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Sync scroll
          </label>
        </div>

        <PromptInput
          onSubmit={onSubmit}
          isLoading={isLoading}
          isAuthenticated={isAuthenticated}
          value={promptDraft}
          onChange={onPromptChange}
        />
      </div>
    </div>
  );
});
