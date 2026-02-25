'use client';

import { memo } from 'react';

/** Dumb component — empty state when no comparison is active */
export const WelcomeScreen = memo(function WelcomeScreen() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary-500 to-primary-700 text-white text-xl font-bold shadow-lg">
          AI
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Ready when you are
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Ask anything to compare responses across AI models
        </p>
      </div>
    </div>
  );
});
