'use client';

import { useState, useCallback } from 'react';

interface CodeBlockProps {
  language?: string;
  code: string;
  provider?: string;
}

/** ChatGPT / Claude / Grok-style code block with language label + copy button. */
export function CodeBlock({ language, code, provider }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: textarea copy
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [code]);

  const displayLang = language?.replace(/^language-/, '') || 'text';

  // Provider-specific accent for the header bar
  const headerAccent = getHeaderAccent(provider);

  return (
    <div className="code-block group my-3 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header bar with language + copy */}
      <div
        className="flex items-center justify-between px-4 py-1.5 text-xs"
        style={{ background: headerAccent.bg, color: headerAccent.text }}
      >
        <span className="font-medium uppercase tracking-wide">{displayLang}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 transition-colors hover:bg-white/10"
        >
          {copied ? (
            <>
              <CheckIcon />
              Copied!
            </>
          ) : (
            <>
              <CopyIcon />
              Copy code
            </>
          )}
        </button>
      </div>

      {/* Code body */}
      <div className="overflow-x-auto bg-gray-950 p-4">
        <pre className="text-[13px] leading-relaxed">
          <code className={`language-${displayLang} text-gray-100`}>
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}

function getHeaderAccent(provider?: string) {
  switch (provider) {
    case 'openai':
      return { bg: '#2d2d2d', text: '#d1d5db' };
    case 'anthropic':
      return { bg: '#2a2520', text: '#d4a574' };
    case 'xai':
      return { bg: '#1a2332', text: '#93c5fd' };
    default:
      return { bg: '#2d2d2d', text: '#d1d5db' };
  }
}

function CopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
      <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
    </svg>
  );
}
