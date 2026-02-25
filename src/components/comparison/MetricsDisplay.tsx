'use client';

import { memo } from 'react';
import { ModelStatus } from '@/types/enums';
import type { ModelMetrics } from '@/types/comparison';

interface MetricsDisplayProps {
  metrics: ModelMetrics | null;
  status: ModelStatus;
}

export const MetricsDisplay = memo(function MetricsDisplay({
  metrics,
  status,
}: MetricsDisplayProps) {
  if (status === ModelStatus.ERROR) {
    return null;
  }

  if (!metrics) {
    return (
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
        <div>Response time: --</div>
        <div>Cost: --</div>
        <div>Prompt tokens: --</div>
        <div>Completion tokens: --</div>
      </div>
    );
  }

  const formattedCost = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(metrics.estimated_cost);

  const formattedTime =
    metrics.response_time_ms >= 1000
      ? `${(metrics.response_time_ms / 1000).toFixed(2)}s`
      : `${metrics.response_time_ms}ms`;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      <div className="flex justify-between">
        <span className="text-gray-500 dark:text-gray-400">Time:</span>
        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
          {formattedTime}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500 dark:text-gray-400">Cost:</span>
        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
          {formattedCost}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500 dark:text-gray-400">Prompt:</span>
        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
          {metrics?.prompt_tokens?.toLocaleString() || '--'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500 dark:text-gray-400">Completion:</span>
        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
          {metrics?.completion_tokens?.toLocaleString() || '--'}
        </span>
      </div>
      <div className="col-span-2 flex justify-between border-t border-gray-100 pt-1 dark:border-gray-700">
        <span className="text-gray-500 dark:text-gray-400">Total tokens:</span>
        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
          {metrics?.total_tokens?.toLocaleString() || '--'}
        </span>
      </div>
    </div>
  );
});
