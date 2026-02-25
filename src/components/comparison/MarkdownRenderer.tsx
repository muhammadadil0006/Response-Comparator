'use client';

import React, { useMemo, memo } from 'react';
import { CodeBlock } from '@/components/comparison/CodeBlock';

interface MarkdownRendererProps {
  /** Raw markdown/text from the model */
  content: string;
  /** Provider name for styling (openai, anthropic, xai) */
  provider?: string;
  /** Whether content is still streaming (renders cursor) */
  isStreaming?: boolean;
}

// ─── Token types for the parser ────────────────────────────────────────────────

type Token =
  | { type: 'heading'; level: number; text: string }
  | { type: 'code-block'; language: string; code: string }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'hr' }
  | { type: 'table'; headers: string[]; alignments: ('left' | 'center' | 'right' | null)[]; rows: string[][] }
  | { type: 'ordered-list'; items: string[]; start: number }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'task-list'; items: { checked: boolean; text: string }[] }
  | { type: 'paragraph'; text: string }
  | { type: 'empty-line' };

// ─── Main component ────────────────────────────────────────────────────────────

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  provider,
  isStreaming = false,
}: MarkdownRendererProps) {
  const tokens = useMemo(() => tokenize(content), [content]);

  return (
    <div className="markdown-body prose prose-sm max-w-none dark:prose-invert">
      {tokens.map((token, i) => (
        <TokenRenderer key={i} token={token} provider={provider} />
      ))}
      {isStreaming && (
        <span className="inline-block h-4 w-1 animate-pulse bg-primary-500 ml-0.5 align-text-bottom" />
      )}
    </div>
  );
});

// ─── Token renderer ────────────────────────────────────────────────────────────

function TokenRenderer({ token, provider }: { token: Token; provider?: string }) {
  switch (token.type) {
    case 'heading': {
      const Tag = (`h${token.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6');
      const sizes: Record<number, string> = {
        1: 'text-xl font-bold mt-5 mb-3',
        2: 'text-lg font-bold mt-4 mb-2',
        3: 'text-base font-semibold mt-3 mb-2',
        4: 'text-sm font-semibold mt-2 mb-1',
        5: 'text-sm font-medium mt-2 mb-1',
        6: 'text-xs font-medium mt-2 mb-1',
      };
      return (
        <Tag className={`${sizes[token.level] || sizes[3]} text-gray-900 dark:text-gray-100`}>
          <InlineRenderer text={token.text} />
        </Tag>
      );
    }

    case 'code-block':
      return <CodeBlock language={token.language} code={token.code} provider={provider} />;

    case 'blockquote':
      return (
        <blockquote className="my-3 border-l-4 border-gray-300 pl-4 italic text-gray-600 dark:border-gray-600 dark:text-gray-400">
          {token.lines.map((line, i) => (
            <p key={i} className="my-1 text-sm">
              <InlineRenderer text={line} />
            </p>
          ))}
        </blockquote>
      );

    case 'hr':
      return <hr className="my-4 border-gray-200 dark:border-gray-700" />;

    case 'table':
      return <TableRenderer token={token} />;

    case 'ordered-list':
      return (
        <ol className="my-2 list-decimal space-y-1 pl-6 text-sm" start={token.start}>
          {token.items.map((item, i) => (
            <li key={i} className="text-gray-800 dark:text-gray-200 leading-relaxed">
              <InlineRenderer text={item} />
            </li>
          ))}
        </ol>
      );

    case 'unordered-list':
      return (
        <ul className="my-2 list-disc space-y-1 pl-6 text-sm">
          {token.items.map((item, i) => (
            <li key={i} className="text-gray-800 dark:text-gray-200 leading-relaxed">
              <InlineRenderer text={item} />
            </li>
          ))}
        </ul>
      );

    case 'task-list':
      return (
        <ul className="my-2 space-y-1 pl-1 text-sm list-none">
          {token.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-gray-800 dark:text-gray-200">
              <input
                type="checkbox"
                checked={item.checked}
                readOnly
                className="mt-1 rounded border-gray-300 text-primary-600"
              />
              <span className={item.checked ? 'line-through opacity-60' : ''}>
                <InlineRenderer text={item.text} />
              </span>
            </li>
          ))}
        </ul>
      );

    case 'paragraph':
      if (!token.text.trim()) return null;
      return (
        <p className="my-2 text-sm leading-relaxed text-gray-800 dark:text-gray-200">
          <InlineRenderer text={token.text} />
        </p>
      );

    case 'empty-line':
      return null;

    default:
      return null;
  }
}

// ─── Table renderer ────────────────────────────────────────────────────────────

function TableRenderer({ token }: { token: Extract<Token, { type: 'table' }> }) {
  const alignClass = (align: 'left' | 'center' | 'right' | null) => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            {token.headers.map((header, i) => (
              <th
                key={i}
                className={`px-4 py-2 font-semibold text-gray-700 dark:text-gray-300 ${alignClass(token.alignments[i])}`}
              >
                <InlineRenderer text={header.trim()} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {token.rows.map((row, ri) => (
            <tr
              key={ri}
              className={ri % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/50'}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`border-t border-gray-100 px-4 py-2 text-gray-700 dark:border-gray-800 dark:text-gray-300 ${alignClass(token.alignments[ci])}`}
                >
                  <InlineRenderer text={cell.trim()} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Inline markdown renderer ──────────────────────────────────────────────────

function InlineRenderer({ text }: { text: string }) {
  const elements = useMemo(() => parseInline(text), [text]);
  return <>{elements}</>;
}

/** Parse inline markdown into React nodes. */
function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold + italic: ***text*** or ___text___
    let match = remaining.match(/^(\*\*\*|___)(.+?)\1/);
    if (match) {
      nodes.push(
        <strong key={key++} className="font-bold">
          <em>{parseInline(match[2])}</em>
        </strong>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Bold: **text** or __text__
    match = remaining.match(/^(\*\*|__)(.+?)\1/);
    if (match) {
      nodes.push(
        <strong key={key++} className="font-semibold">{parseInline(match[2])}</strong>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Italic: *text* or _text_ (but not inside words for _)
    match = remaining.match(/^(\*|_)(.+?)\1/);
    if (match) {
      nodes.push(<em key={key++}>{parseInline(match[2])}</em>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Strikethrough: ~~text~~
    match = remaining.match(/^~~(.+?)~~/);
    if (match) {
      nodes.push(<del key={key++} className="line-through">{parseInline(match[1])}</del>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Inline code: `code`
    match = remaining.match(/^`([^`]+)`/);
    if (match) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-gray-100 px-1.5 py-0.5 text-[13px] font-mono text-pink-600 dark:bg-gray-800 dark:text-pink-400"
        >
          {match[1]}
        </code>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Link: [text](url)
    match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      nodes.push(
        <a
          key={key++}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 underline decoration-primary-300 hover:decoration-primary-500 dark:text-primary-400"
        >
          {match[1]}
        </a>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Image: ![alt](url)
    match = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (match) {
      nodes.push(
        <img
          key={key++}
          src={match[2]}
          alt={match[1]}
          className="my-2 max-w-full rounded-lg"
        />
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Bare URL
    match = remaining.match(/^(https?:\/\/[^\s<]+)/);
    if (match) {
      nodes.push(
        <a
          key={key++}
          href={match[1]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 underline hover:text-primary-700 dark:text-primary-400"
        >
          {match[1]}
        </a>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Plain text (consume up to the next special character)
    match = remaining.match(/^[^*_`~[\]!\\(https?:)]+/);
    if (match) {
      nodes.push(<React.Fragment key={key++}>{match[0]}</React.Fragment>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Fallback: consume one character
    nodes.push(<React.Fragment key={key++}>{remaining[0]}</React.Fragment>);
    remaining = remaining.slice(1);
  }

  return nodes;
}

// ─── Block-level tokenizer ─────────────────────────────────────────────────────

function tokenize(text: string): Token[] {
  const lines = text.split('\n');
  const tokens: Token[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ─── Fenced code block ───
    const codeMatch = line.match(/^(`{3,}|~{3,})(\w*)/);
    if (codeMatch) {
      const fence = codeMatch[1];
      const language = codeMatch[2] || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      tokens.push({ type: 'code-block', language, code: codeLines.join('\n') });
      continue;
    }

    // ─── Heading ───
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      tokens.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // ─── Horizontal rule ───
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      tokens.push({ type: 'hr' });
      i++;
      continue;
    }

    // ─── Table ───
    if (
      i + 1 < lines.length &&
      line.includes('|') &&
      /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[i + 1])
    ) {
      const headers = parseCells(line);
      const alignLine = lines[i + 1];
      const alignments = parseCells(alignLine).map((cell): 'left' | 'center' | 'right' | null => {
        const trimmed = cell.trim();
        if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
        if (trimmed.endsWith(':')) return 'right';
        if (trimmed.startsWith(':')) return 'left';
        return null;
      });
      i += 2; // skip header + alignment rows
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(parseCells(lines[i]));
        i++;
      }
      tokens.push({ type: 'table', headers, alignments, rows });
      continue;
    }

    // ─── Task list ───
    if (/^\s*[-*]\s+\[[ xX]\]/.test(line)) {
      const items: { checked: boolean; text: string }[] = [];
      while (i < lines.length && /^\s*[-*]\s+\[[ xX]\]/.test(lines[i])) {
        const taskMatch = lines[i].match(/^\s*[-*]\s+\[([ xX])\]\s*(.*)/);
        if (taskMatch) {
          items.push({
            checked: taskMatch[1].toLowerCase() === 'x',
            text: taskMatch[2],
          });
        }
        i++;
      }
      tokens.push({ type: 'task-list', items });
      continue;
    }

    // ─── Unordered list ───
    if (/^\s*[-*+]\s+/.test(line) && !/^\s*[-*+]\s+\[[ xX]\]/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      tokens.push({ type: 'unordered-list', items });
      continue;
    }

    // ─── Ordered list ───
    const olMatch = line.match(/^\s*(\d+)\.\s+/);
    if (olMatch) {
      const start = parseInt(olMatch[1], 10);
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      tokens.push({ type: 'ordered-list', items, start });
      continue;
    }

    // ─── Blockquote ───
    if (line.startsWith('>')) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        bqLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      tokens.push({ type: 'blockquote', lines: bqLines });
      continue;
    }

    // ─── Empty line ───
    if (line.trim() === '') {
      tokens.push({ type: 'empty-line' });
      i++;
      continue;
    }

    // ─── Paragraph (default) ───
    // Collect consecutive non-blank, non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^(`{3,}|~{3,})/) &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].match(/^(-{3,}|\*{3,}|_{3,})\s*$/) &&
      !lines[i].match(/^\s*[-*+]\s+/) &&
      !lines[i].match(/^\s*\d+\.\s+/) &&
      !lines[i].startsWith('>')
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      tokens.push({ type: 'paragraph', text: paraLines.join('\n') });
    }
  }

  return tokens;
}

/** Split a markdown table row into cells. */
function parseCells(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}
