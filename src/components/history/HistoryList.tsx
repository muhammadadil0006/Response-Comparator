'use client';

import { useListComparisonsQuery } from '@/store/api/comparisonApi';
import { Spinner } from '@/components/ui/Spinner';
import { ComparisonCard } from '@/components/history/ComparisonCard';
import { extractErrorMessage } from '@/lib/utils/errors';
import type { Comparison } from '@/types/comparison';

export function HistoryList() {
  const { data, isLoading, error, refetch } = useListComparisonsQuery({
    limit: 50,
    offset: 0,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
        <p className="text-red-700 dark:text-red-300">
          {extractErrorMessage(error, 'Failed to load comparison history.')}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 inline-flex items-center gap-1 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
        >
          ↻ Retry
        </button>
      </div>
    );
  }

  if (!data?.comparisons.length) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center dark:border-gray-600">
        <p className="text-gray-500 dark:text-gray-400">
          No saved comparisons yet. Try comparing some AI models!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {data.total} comparison{data.total !== 1 ? 's' : ''} saved
        </p>
      </div>
      <div className="space-y-3">
        {data.comparisons.map((comparison: Comparison) => (
          <ComparisonCard
            key={comparison.comparison_id}
            comparison={comparison}
          />
        ))}
      </div>
    </div>
  );
}
