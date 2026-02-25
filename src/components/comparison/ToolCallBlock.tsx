'use client';

import { useState } from 'react';

interface ToolCallBlockProps {
  id: string;
  name: string;
  args: Record<string, unknown>;
  provider?: string;
}

/** Renders a tool/function call block — shows the function name, args JSON, and allows copying. */
export function ToolCallBlock({ id, name, args, provider }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const argsJson = JSON.stringify(args, null, 2);

  const accent = getProviderAccent(provider);

  return (
    <div
      className="my-3 overflow-hidden rounded-lg border"
      style={{ borderColor: accent.border }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        style={{ background: accent.headerBg }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" style={{ color: accent.icon }}>
          <path fillRule="evenodd" d="M8.157 2.176a1.5 1.5 0 0 0-1.147 0l-4.084 1.69A1.5 1.5 0 0 0 2 5.25v5.5a1.5 1.5 0 0 0 .926 1.384l4.084 1.69a1.5 1.5 0 0 0 1.147 0l4.084-1.69A1.5 1.5 0 0 0 13.167 10.75v-5.5a1.5 1.5 0 0 0-.926-1.384l-4.084-1.69ZM4.75 9.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5ZM5 7.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
        </svg>
        <span className="font-mono font-medium" style={{ color: accent.text }}>
          {name}()
        </span>
        <span className="ml-auto text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          <div className="bg-gray-50 px-4 py-1 text-[10px] text-gray-400 dark:bg-gray-900">
            Call ID: {id}
          </div>
          <pre className="overflow-x-auto bg-gray-950 p-4 text-xs text-gray-300">
            {argsJson}
          </pre>
        </div>
      )}
    </div>
  );
}

function getProviderAccent(provider?: string) {
  switch (provider) {
    case 'openai':
      return { headerBg: '#f0fdf4', border: '#10a37f40', icon: '#10a37f', text: '#15803d' };
    case 'anthropic':
      return { headerBg: '#fef3e2', border: '#d4a57440', icon: '#d4a574', text: '#92400e' };
    case 'xai':
      return { headerBg: '#eff6ff', border: '#1da1f240', icon: '#1da1f2', text: '#1e40af' };
    default:
      return { headerBg: '#f9fafb', border: '#e5e7eb', icon: '#6b7280', text: '#374151' };
  }
}
