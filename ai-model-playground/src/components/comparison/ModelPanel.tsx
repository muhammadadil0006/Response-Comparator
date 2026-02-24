'use client';

import { memo, useState } from 'react';
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { StreamingResponse } from '@/components/comparison/StreamingResponse';
import { MetricsDisplay } from '@/components/comparison/MetricsDisplay';
import {
  MODEL_DISPLAY_NAMES,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_COLORS,
} from '@/lib/utils/constants';
import { ModelStatus } from '@/types/enums';
import type { ModelMetrics } from '@/types/comparison';

interface ModelPanelProps {
  modelId: string;
  provider: string;
  status: ModelStatus;
  responseText: string;
  errorMessage?: string;
  metrics: ModelMetrics | null;
  onRetry?: (modelId: string) => void;
  onEditResponse?: (text: string) => void;
}

export const ModelPanel = memo(function ModelPanel({
  modelId,
  provider,
  status,
  responseText,
  errorMessage,
  metrics,
  onRetry,
  onEditResponse,
}: ModelPanelProps) {
  const [copied, setCopied] = useState(false);
  const modelName = MODEL_DISPLAY_NAMES[modelId] || modelId;
  const providerName = PROVIDER_DISPLAY_NAMES[provider] || provider;
  const providerColor = PROVIDER_COLORS[provider] || '#6b7280';

  const handleCopy = async () => {
    if (!responseText?.trim()) return;

    try {
      await navigator.clipboard.writeText(responseText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: providerColor }}
            />
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {modelName}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {providerName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(status === ModelStatus.STREAMING || status === ModelStatus.COMPLETED) && (
              <>
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy message"
                  className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                >
                  {copied ? '✓' : '⧉'}
                </button>
                {onEditResponse && responseText.trim() && (
                  <button
                    type="button"
                    onClick={() => onEditResponse(responseText)}
                    title="Edit message"
                    className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                  >
                    ✎
                  </button>
                )}
              </>
            )}
            <StatusBadge status={status} />
          </div>
        </div>
      </CardHeader>

      <CardBody className="flex-1 overflow-hidden">
        {status === ModelStatus.IDLE && (
          <div className="flex h-full min-h-50 items-center justify-center text-sm text-gray-400">
            Waiting for prompt...
          </div>
        )}

        {(status === ModelStatus.STREAMING || status === ModelStatus.COMPLETED) && (
          <StreamingResponse
            text={responseText}
            isStreaming={status === ModelStatus.STREAMING}
          />
        )}

        {status === ModelStatus.ERROR && (
          <div className="flex min-h-50 items-center justify-center">
            <div className="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </p>
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errorMessage || 'An unexpected error occurred'}
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(modelId)}
                  className="mt-3 inline-flex items-center gap-1 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                >
                  ↻ Retry
                </button>
              )}
            </div>
          </div>
        )}
      </CardBody>

      <CardFooter className="shrink-0">
        <MetricsDisplay metrics={metrics} status={status} />
      </CardFooter>
    </Card>
  );
});

function StatusBadge({ status }: { status: ModelStatus }) {
  const config: Record<ModelStatus, { label: string; className: string }> = {
    [ModelStatus.IDLE]: {
      label: 'Idle',
      className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    },
    [ModelStatus.PENDING]: {
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    [ModelStatus.STREAMING]: {
      label: 'Streaming',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    [ModelStatus.COMPLETED]: {
      label: 'Done',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    [ModelStatus.ERROR]: {
      label: 'Error',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
  };

  const { label, className } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {status === ModelStatus.STREAMING && <Spinner size="sm" />}
      {label}
    </span>
  );
}
