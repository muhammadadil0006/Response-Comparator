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
      <div className="rounded-xl border border-[#F85149]/20 bg-[#F85149]/10 p-6 text-center">
        <p className="text-[#F85149]">
          {extractErrorMessage(error, 'Failed to load comparison history.')}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[#1C2128] border border-[#30363D] px-4 py-2 text-sm font-medium text-[#F0F6FC] transition-colors hover:bg-[#30363D]"
        >
          ↻ Retry
        </button>
      </div>
    );
  }

  if (!data?.comparisons.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#30363D] p-12 text-center">
        <p className="text-[#8B949E]">
          No saved comparisons yet. Try comparing some AI models!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#8B949E]">
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
