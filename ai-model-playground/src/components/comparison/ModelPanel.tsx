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

interface ToolCallData {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface ModelPanelProps {
  modelId: string;
  provider: string;
  status: ModelStatus;
  responseText: string;
  errorMessage?: string;
  errorCategory?: string;
  metrics: ModelMetrics | null;
  finishReason?: string;
  toolCalls?: ToolCallData[];
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
  errorCategory,
  metrics,
  finishReason,
  toolCalls,
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
    <Card className="flex flex-col h-full overflow-hidden" style={{ borderTopColor: providerColor, borderTopWidth: '3px' }}>
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

        {status === ModelStatus.PENDING && (
          <div className="flex h-full min-h-50 items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-sm text-gray-400">
              <Spinner size="md" />
              <span>Preparing response...</span>
            </div>
          </div>
        )}

        {(status === ModelStatus.STREAMING || status === ModelStatus.COMPLETED) && (
          <StreamingResponse
            text={responseText}
            isStreaming={status === ModelStatus.STREAMING}
            provider={provider}
            toolCalls={toolCalls}
            finishReason={finishReason}
            scrollRef={scrollRef}
            onScroll={onScroll}
          />
        )}

        {status === ModelStatus.ERROR && (
          <div className="flex min-h-50 items-center justify-center">
            <ErrorDisplay
              errorMessage={errorMessage}
              errorCategory={errorCategory}
              modelId={modelId}
              onRetry={onRetry}
            />
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

/** Category-aware error display for model panels */
function ErrorDisplay({
  errorMessage,
  errorCategory,
  modelId,
  onRetry,
}: {
  errorMessage?: string;
  errorCategory?: string;
  modelId: string;
  onRetry?: (modelId: string) => void;
}) {
  const categoryConfig: Record<string, { title: string; icon: string; bgClass: string; textClass: string; hint?: string }> = {
    'capability': {
      title: 'Unsupported Request',
      icon: '🚫',
      bgClass: 'bg-amber-50 dark:bg-amber-900/20',
      textClass: 'text-amber-800 dark:text-amber-200',
      hint: 'This model cannot perform this type of task. Try a different prompt.',
    },
    'rate-limit': {
      title: 'Rate Limited',
      icon: '⏳',
      bgClass: 'bg-orange-50 dark:bg-orange-900/20',
      textClass: 'text-orange-800 dark:text-orange-200',
      hint: 'Too many requests. The system will automatically retry.',
    },
    'content-filter': {
      title: 'Content Filtered',
      icon: '🛡️',
      bgClass: 'bg-purple-50 dark:bg-purple-900/20',
      textClass: 'text-purple-800 dark:text-purple-200',
      hint: 'The safety system blocked this request. Try rephrasing.',
    },
    'auth': {
      title: 'Authentication Error',
      icon: '🔒',
      bgClass: 'bg-red-50 dark:bg-red-900/20',
      textClass: 'text-red-800 dark:text-red-200',
    },
    'not-found': {
      title: 'Model Not Found',
      icon: '❓',
      bgClass: 'bg-gray-50 dark:bg-gray-800',
      textClass: 'text-gray-800 dark:text-gray-200',
    },
    'timeout': {
      title: 'Request Timed Out',
      icon: '⏰',
      bgClass: 'bg-yellow-50 dark:bg-yellow-900/20',
      textClass: 'text-yellow-800 dark:text-yellow-200',
      hint: 'The model took too long to respond. Try again.',
    },
    'server': {
      title: 'Server Error',
      icon: '🔧',
      bgClass: 'bg-red-50 dark:bg-red-900/20',
      textClass: 'text-red-800 dark:text-red-200',
      hint: 'An issue with the AI service. Try again later.',
    },
  };

  const config = categoryConfig[errorCategory || ''] || {
    title: 'Error',
    icon: '⚠️',
    bgClass: 'bg-red-50 dark:bg-red-900/20',
    textClass: 'text-red-800 dark:text-red-200',
  };

  return (
    <div className={`rounded-lg ${config.bgClass} p-4 text-center max-w-xs`}>
      <div className="text-2xl mb-1">{config.icon}</div>
      <p className={`text-sm font-medium ${config.textClass}`}>
        {config.title}
      </p>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        {errorMessage || 'An unexpected error occurred'}
      </p>
      {config.hint && (
        <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-500 italic">
          {config.hint}
        </p>
      )}
      {onRetry && errorCategory !== 'capability' && errorCategory !== 'auth' && (
        <button
          type="button"
          onClick={() => onRetry(modelId)}
          className="mt-3 inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          ↻ Retry
        </button>
      )}
    </div>
  );
}
