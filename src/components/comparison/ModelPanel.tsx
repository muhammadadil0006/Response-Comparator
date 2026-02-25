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
          <div className="flex items-center gap-2.5">
            <div
              className="h-3 w-3 rounded-full ring-2 ring-offset-1 ring-offset-[#161B22] transition-all duration-300"
              style={{ backgroundColor: providerColor, boxShadow: `0 0 6px ${providerColor}60` }}
            />
            <div>
              <h3 className="text-sm font-semibold text-[#F0F6FC]">
                {modelName}
              </h3>
              <p className="text-xs text-[#8B949E]">
                {providerName}
              </p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>

      <CardBody className="flex-1 overflow-hidden">
        {status === ModelStatus.IDLE && (
          <div className="flex h-full min-h-50 items-center justify-center text-sm text-[#8B949E]/60">
            Waiting for prompt…
          </div>
        )}

        {status === ModelStatus.PENDING && (
          <div className="flex h-full min-h-50 flex-col gap-3 p-2">
            {/* Skeleton shimmer rows */}
            {[70, 90, 55, 80].map((w, i) => (
              <div
                key={i}
                className="skeleton h-3 rounded-full"
                style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }}
              />
            ))}
            <div className="skeleton h-3 rounded-full w-40" style={{ animationDelay: '480ms' }} />
            <div className="mt-2 flex items-center gap-2 text-xs text-[#8B949E]">
              <span className="animate-spin-slow inline-block">⟳</span>
              <span>Generating response…</span>
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

        {status === ModelStatus.INTERRUPTED && (
          responseText ? (
            <>
              <div className="mx-2 mt-2 mb-1 flex items-center gap-1.5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-yellow-400">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-yellow-400">Interrupted — partial response shown below</span>
              </div>
              <StreamingResponse
                text={responseText}
                isStreaming={false}
                provider={provider}
                toolCalls={toolCalls}
                scrollRef={scrollRef}
                onScroll={onScroll}
              />
            </>
          ) : (
            <div className="flex h-full min-h-50 items-center justify-center">
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-5 text-center max-w-xs">
                <div className="text-2xl mb-1">⚡</div>
                <p className="text-sm font-medium text-yellow-400">Response Interrupted</p>
                <p className="mt-1 text-xs text-[#8B949E]">
                  The response was generating when the page was refreshed.
                </p>
              </div>
            </div>
          )
        )}

      </CardBody>

      <CardFooter className="shrink-0 space-y-2">
        {(status === ModelStatus.COMPLETED || status === ModelStatus.STREAMING || status === ModelStatus.INTERRUPTED) && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              title="Copy response"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#8B949E] transition-colors hover:bg-[#1C2128] hover:text-[#F0F6FC]"
              disabled={!responseText?.trim()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
                <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
              </svg>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {onRegenerate && (status === ModelStatus.COMPLETED || status === ModelStatus.INTERRUPTED) && (
              <button
                type="button"
                onClick={() => onRegenerate(modelId)}
                title="Regenerate response"
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:bg-[#1C2128] hover:text-[#F0F6FC] ${
                  status === ModelStatus.INTERRUPTED ? 'text-yellow-400' : 'text-[#8B949E]'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.312.311a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm-10.624-2.85a5.5 5.5 0 0 1 9.201-2.465l.312.31H11.768a.75.75 0 0 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V3.534a.75.75 0 0 0-1.5 0v2.033l-.312-.311A7 7 0 0 0 2.64 8.395a.75.75 0 0 0 1.448.39Z" clipRule="evenodd" />
                </svg>
                {status === ModelStatus.INTERRUPTED ? 'Regenerate ↺' : 'Regenerate'}
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
      className: 'bg-[#1C2128] text-[#8B949E] border border-[#30363D]',
    },
    [ModelStatus.PENDING]: {
      label: 'Pending',
      className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
    },
    [ModelStatus.STREAMING]: {
      label: 'Streaming',
      className: 'bg-primary-500/10 text-primary-400 border border-primary-500/30 animate-glow-pulse',
    },
    [ModelStatus.COMPLETED]: {
      label: 'Done',
      className: 'bg-[#10A37F]/10 text-[#10A37F] border border-[#10A37F]/30',
    },
    [ModelStatus.ERROR]: {
      label: 'Error',
      className: 'bg-[#F85149]/10 text-[#F85149] border border-[#F85149]/30',
    },
    [ModelStatus.INTERRUPTED]: {
      label: 'Interrupted',
      className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
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
      bgClass: 'bg-yellow-500/10 border border-yellow-500/20',
      textClass: 'text-yellow-400',
      hint: 'This model cannot perform this type of task. Try a different prompt.',
    },
    'rate-limit': {
      title: 'Rate Limited',
      icon: '⏳',
      bgClass: 'bg-orange-500/10 border border-orange-500/20',
      textClass: 'text-orange-400',
      hint: 'Too many requests. The system will automatically retry.',
    },
    'content-filter': {
      title: 'Content Filtered',
      icon: '🛡️',
      bgClass: 'bg-purple-500/10 border border-purple-500/20',
      textClass: 'text-purple-400',
      hint: 'The safety system blocked this request. Try rephrasing.',
    },
    'auth': {
      title: 'Authentication Error',
      icon: '🔒',
      bgClass: 'bg-[#F85149]/10 border border-[#F85149]/20',
      textClass: 'text-[#F85149]',
    },
    'not-found': {
      title: 'Model Not Found',
      icon: '❓',
      bgClass: 'bg-[#1C2128] border border-[#30363D]',
      textClass: 'text-[#8B949E]',
    },
    'timeout': {
      title: 'Request Timed Out',
      icon: '⏰',
      bgClass: 'bg-yellow-500/10 border border-yellow-500/20',
      textClass: 'text-yellow-400',
      hint: 'The model took too long to respond. Try again.',
    },
    'server': {
      title: 'Server Error',
      icon: '🔧',
      bgClass: 'bg-[#F85149]/10 border border-[#F85149]/20',
      textClass: 'text-[#F85149]',
      hint: 'An issue with the AI service. Try again later.',
    },
  };

  const config = categoryConfig[errorCategory || ''] || {
    title: 'Error',
    icon: '⚠️',
    bgClass: 'bg-[#F85149]/10 border border-[#F85149]/20',
    textClass: 'text-[#F85149]',
  };

  return (
    <div className={`rounded-xl ${config.bgClass} p-4 text-center max-w-xs`}>
      <div className="text-2xl mb-1">{config.icon}</div>
      <p className={`text-sm font-medium ${config.textClass}`}>
        {config.title}
      </p>
      <p className="mt-1 text-xs text-[#8B949E]">
        {errorMessage || 'An unexpected error occurred'}
      </p>
      {config.hint && (
        <p className="mt-1.5 text-[11px] text-[#8B949E]/70 italic">
          {config.hint}
        </p>
      )}
      {onRetry && errorCategory !== 'capability' && errorCategory !== 'auth' && (
        <button
          type="button"
          onClick={() => onRetry(modelId)}
          className="mt-3 inline-flex items-center gap-1 rounded-md bg-[#1C2128] border border-[#30363D] px-3 py-1.5 text-xs font-medium text-[#F0F6FC] transition-colors hover:bg-[#30363D]"
        >
          ↻ Retry
        </button>
      )}
    </div>
  );
}
