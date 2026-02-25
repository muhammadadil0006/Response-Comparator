'use client';

import { useRef, useEffect, useCallback } from 'react';
import { MarkdownRenderer } from '@/components/comparison/MarkdownRenderer';
import { ToolCallBlock } from '@/components/comparison/ToolCallBlock';

interface ToolCallData {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface StreamingResponseProps {
  text: string;
  isStreaming: boolean;
  provider?: string;
  toolCalls?: ToolCallData[];
  finishReason?: string;
  scrollRef?: (el: HTMLDivElement | null) => void;
  onScroll?: () => void;
}

export function StreamingResponse({
  text,
  isStreaming,
  provider,
  toolCalls,
  finishReason,
  scrollRef,
  onScroll,
}: StreamingResponseProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      scrollRef?.(el);
    },
    [scrollRef]
  );

  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, isStreaming]);

  const showFinishIndicator =
    !isStreaming &&
    finishReason &&
    finishReason !== 'stop' &&
    finishReason !== 'unknown';

  return (
    <div
      ref={setRef}
      onScroll={onScroll}
      className="min-h-50 max-h-125 overflow-y-auto"
    >
      {/* Tool call blocks (if model invoked tools) */}
      {toolCalls && toolCalls.length > 0 && (
        <div className="mb-2">
          {toolCalls.map((tc) => (
            <ToolCallBlock
              key={tc.id}
              id={tc.id}
              name={tc.name}
              args={tc.args}
              provider={provider}
            />
          ))}
        </div>
      )}

      {/* Main response content — rendered as rich markdown */}
      {text ? (
        <MarkdownRenderer
          content={text}
          provider={provider}
          isStreaming={isStreaming}
        />
      ) : (
        !isStreaming ? (
          <div className="flex min-h-32 items-center justify-center">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600">
                <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52a1.595 1.595 0 0 1 1.348 1.58v7.4a1.595 1.595 0 0 1-1.348 1.58 49.144 49.144 0 0 1-7.152.52c-2.43 0-4.817-.178-7.152-.52A1.595 1.595 0 0 1 3.5 12.33v-7.4a1.595 1.595 0 0 1 1.348-1.58ZM6.75 7.5a.75.75 0 0 0 0 1.5h6.75a.75.75 0 0 0 0-1.5H6.75Zm0 3a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H6.75Z" clipRule="evenodd" />
                <path d="M2.25 15.75a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Zm12.75 0a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Zm-6 0a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" />
              </svg>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Empty response</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Model completed but returned no content. Try regenerating.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-32 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary-500" />
              Generating response...
            </div>
          </div>
        )
      )}

      {/* Finish reason indicator for non-normal completions */}
      {showFinishIndicator && (
        <FinishReasonBadge reason={finishReason} />
      )}
    </div>
  );
}

/** Shows a small badge explaining why the response ended. */
function FinishReasonBadge({ reason }: { reason: string }) {
  const config: Record<string, { label: string; className: string }> = {
    'length': {
      label: 'Response truncated (token limit reached)',
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    },
    'content-filter': {
      label: 'Content filtered by safety system',
      className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    },
    'tool-calls': {
      label: 'Model invoked tool calls',
      className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    },
    'error': {
      label: 'Response ended due to an error',
      className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    },
  };

  const { label, className } = config[reason] ?? {
    label: `Finish reason: ${reason}`,
    className: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  };

  return (
    <div className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${className}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
      </svg>
      {label}
    </div>
  );
}
