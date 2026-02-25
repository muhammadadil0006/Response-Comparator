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
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-[#1C2128]"
        style={{ background: accent.headerBg }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" style={{ color: accent.icon }}>
          <path fillRule="evenodd" d="M8.157 2.176a1.5 1.5 0 0 0-1.147 0l-4.084 1.69A1.5 1.5 0 0 0 2 5.25v5.5a1.5 1.5 0 0 0 .926 1.384l4.084 1.69a1.5 1.5 0 0 0 1.147 0l4.084-1.69A1.5 1.5 0 0 0 13.167 10.75v-5.5a1.5 1.5 0 0 0-.926-1.384l-4.084-1.69ZM4.75 9.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5ZM5 7.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
        </svg>
        <span className="font-mono font-medium" style={{ color: accent.text }}>
          {name}()
        </span>
        <span className="ml-auto text-xs text-[#8B949E]">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-[#30363D]">
          <div className="bg-[#1C2128] px-4 py-1 text-[10px] text-[#8B949E]">
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
      return { headerBg: '#10A37F10', border: '#10A37F40', icon: '#10A37F', text: '#10A37F' };
    case 'anthropic':
      return { headerBg: '#D9775710', border: '#D9775740', icon: '#D97757', text: '#D97757' };
    case 'xai':
      return { headerBg: '#E5E7EB10', border: '#E5E7EB30', icon: '#E5E7EB', text: '#E5E7EB' };
    default:
      return { headerBg: '#1C2128', border: '#30363D', icon: '#8B949E', text: '#8B949E' };
  }
}
