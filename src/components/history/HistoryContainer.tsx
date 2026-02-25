'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { HistoryList } from '@/components/history/HistoryList';

export function HistoryContainer() {
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Comparison History
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Your saved AI model comparisons
          </p>
        </div>
        <HistoryList />
      </div>
    </ProtectedRoute>
  );
}
