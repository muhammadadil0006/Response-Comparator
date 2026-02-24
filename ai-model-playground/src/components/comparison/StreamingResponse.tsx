'use client';

import { useRef, useEffect } from 'react';

interface StreamingResponseProps {
  text: string;
  isStreaming: boolean;
}

export function StreamingResponse({ text, isStreaming }: StreamingResponseProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, isStreaming]);

  return (
    <div
      ref={containerRef}
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
