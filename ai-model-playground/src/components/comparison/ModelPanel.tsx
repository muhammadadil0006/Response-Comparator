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
  onRegenerate?: (modelId: string) => void;
  scrollRef?: (el: HTMLDivElement | null) => void;
  onScroll?: () => void;
}

export const ModelPanel = memo(function ModelPanel({
  modelId,
  provider,
  status,
  responseText,
  errorMessage,
  metrics,
  onRetry,
  onRegenerate,
  scrollRef,
  onScroll,
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
          <StatusBadge status={status} />
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
            scrollRef={scrollRef}
            onScroll={onScroll}
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

      <CardFooter className="shrink-0 space-y-2">
        {(status === ModelStatus.COMPLETED || status === ModelStatus.STREAMING) && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              title="Copy response"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
                <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
              </svg>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {onRegenerate && status === ModelStatus.COMPLETED && (
              <button
                type="button"
                onClick={() => onRegenerate(modelId)}
                title="Regenerate response"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.312.311a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm-10.624-2.85a5.5 5.5 0 0 1 9.201-2.465l.312.31H11.768a.75.75 0 0 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V3.534a.75.75 0 0 0-1.5 0v2.033l-.312-.311A7 7 0 0 0 2.64 8.395a.75.75 0 0 0 1.448.39Z" clipRule="evenodd" />
                </svg>
                Regenerate
              </button>
            )}
          </div>
        )}
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
