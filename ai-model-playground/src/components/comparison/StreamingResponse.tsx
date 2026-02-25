'use client';

import { useRef, useEffect, useCallback } from 'react';

interface StreamingResponseProps {
  text: string;
  isStreaming: boolean;
  scrollRef?: (el: HTMLDivElement | null) => void;
  onScroll?: () => void;
}

export function StreamingResponse({ text, isStreaming, scrollRef, onScroll }: StreamingResponseProps) {
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

  return (
    <div
      ref={setRef}
      onScroll={onScroll}
      className="min-h-50 max-h-125 overflow-y-auto"
    >
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
        {text || (
          <span className="text-gray-400 italic">
            Waiting for response...
          </span>
        )}
        {isStreaming && (
          <span className="inline-block h-4 w-1 animate-pulse bg-primary-500 ml-0.5" />
        )}
      </div>
    </div>
  );
}
