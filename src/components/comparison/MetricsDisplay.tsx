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
      <div className="grid grid-cols-2 gap-2 text-xs text-[#8B949E]/50">
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
        <span className="text-[#8B949E]">Time:</span>
        <span className="font-mono font-medium text-[#F0F6FC]/80">
          {formattedTime}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#8B949E]">Cost:</span>
        <span className="font-mono font-medium text-[#F0F6FC]/80">
          {formattedCost}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#8B949E]">Prompt tokens:</span>
        <span className="font-mono font-medium text-[#F0F6FC]/80">
          {metrics?.prompt_tokens?.toLocaleString() || '--'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#8B949E]">Completion tokens:</span>
        <span className="font-mono font-medium text-[#F0F6FC]/80">
          {metrics?.completion_tokens?.toLocaleString() || '--'}
        </span>
      </div>
      <div className="col-span-2 flex justify-between border-t border-[#30363D] pt-1">
        <span className="text-[#8B949E]">Total tokens:</span>
        <span className="font-mono font-medium text-[#F0F6FC]/80">
          {metrics?.total_tokens?.toLocaleString() || '--'}
        </span>
      </div>
    </div>
  );
});
