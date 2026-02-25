'use client';

import { useRef, useEffect, useCallback, memo } from 'react';
import { MarkdownRenderer } from '@/components/comparison/MarkdownRenderer';
import { ToolCallBlock } from '@/components/comparison/ToolCallBlock';

// ─── Scroll behaviour ─────────────────────────────────────────────────────────
//
// Auto-scroll during streaming must NOT propagate to neighboring panels via the
// sync-scroll handler.  We guard against it with `isAutoScrollingRef`.
//
// CSS rules that matter:
//   scroll-behavior: auto   → no CSS smooth-scroll (avoids double-animation lag)
//   overscroll-behavior-y: contain → prevents the page from scrolling when the
//                                    panel reaches its edge
// These are applied as inline styles below.
// ─────────────────────────────────────────────────────────────────────────────

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

export const StreamingResponse = memo(function StreamingResponse({
  text,
  isStreaming,
  provider,
  toolCalls,
  finishReason,
  scrollRef,
  onScroll,
}: StreamingResponseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // True while we are programmatically setting scrollTop during streaming
  // auto-scroll — prevents the synthetic scroll event from triggering the
  // ratio-based sync-scroll logic and causing panels to fight each other.
  const isAutoScrollingRef = useRef(false);

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      scrollRef?.(el);
    },
    [scrollRef]
  );

  useEffect(() => {
    if (isStreaming && containerRef.current) {
      // Mark the upcoming scroll as automatic so the onScroll guard
      // suppresses it from propagating to the sync-scroll handler.
      isAutoScrollingRef.current = true;
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      // Reset the flag after the browser's next paint so any residual scroll
      // event that still fires during this frame gets swallowed.
      requestAnimationFrame(() => {
        isAutoScrollingRef.current = false;
      });
    }
  }, [text, isStreaming]);

  const handleScroll = useCallback(() => {
    // Only forward the event to the sync handler when the user actually
    // scrolled — not when we programmatically moved the scrollbar during
    // streaming auto-scroll.
    if (!isAutoScrollingRef.current) {
      onScroll?.();
    }
  }, [onScroll]);

  const showFinishIndicator =
    !isStreaming &&
    finishReason &&
    finishReason !== 'stop' &&
    finishReason !== 'unknown';

  return (
    <div
      ref={setRef}
      onScroll={handleScroll}
      className="min-h-50 max-h-125 overflow-y-auto overscroll-y-contain"
      // scroll-behavior: auto prevents CSS smooth-scroll which would cause
      // double-animation jitter when syncing panels programmatically.
      style={{ scrollBehavior: 'auto' }}
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

      {/* Main response content.
          During streaming: render plain text to avoid the synchronous
          tokenize/parse cost of the markdown renderer on every frame.
          After completion: switch to full MarkdownRenderer. */}
      {text ? (
        isStreaming ? (
          <pre className="m-0 whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#E6EDF3]">
            {text}
          </pre>
        ) : (
          <MarkdownRenderer
            content={text}
            provider={provider}
            isStreaming={false}
          />
        )
      ) : (
        !isStreaming ? (
          <div className="flex min-h-32 items-center justify-center">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="mx-auto mb-2 h-8 w-8 text-[#30363D]">
                <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52a1.595 1.595 0 0 1 1.348 1.58v7.4a1.595 1.595 0 0 1-1.348 1.58 49.144 49.144 0 0 1-7.152.52c-2.43 0-4.817-.178-7.152-.52A1.595 1.595 0 0 1 3.5 12.33v-7.4a1.595 1.595 0 0 1 1.348-1.58ZM6.75 7.5a.75.75 0 0 0 0 1.5h6.75a.75.75 0 0 0 0-1.5H6.75Zm0 3a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H6.75Z" clipRule="evenodd" />
                <path d="M2.25 15.75a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Zm12.75 0a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Zm-6 0a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" />
              </svg>
              <p className="text-sm font-medium text-[#8B949E]">Empty response</p>
              <p className="mt-1 text-xs text-[#8B949E]/60">
                Model completed but returned no content. Try regenerating.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-32 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-[#8B949E]">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary-500" />
              Generating response…
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
});

/** Shows a small badge explaining why the response ended. */
function FinishReasonBadge({ reason }: { reason: string }) {
  const config: Record<string, { label: string; className: string }> = {
    'length': {
      label: 'Response truncated (token limit reached)',
      className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    },
    'content-filter': {
      label: 'Content filtered by safety system',
      className: 'bg-[#F85149]/10 text-[#F85149] border-[#F85149]/30',
    },
    'tool-calls': {
      label: 'Model invoked tool calls',
      className: 'bg-primary-500/10 text-primary-400 border-primary-500/30',
    },
    'error': {
      label: 'Response ended due to an error',
      className: 'bg-[#F85149]/10 text-[#F85149] border-[#F85149]/30',
    },
  };

  const { label, className } = config[reason] ?? {
    label: `Finish reason: ${reason}`,
    className: 'bg-[#1C2128] text-[#8B949E] border-[#30363D]',
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
