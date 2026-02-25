'use client';

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import type { ComparisonSummary } from '@/hooks/useComparisonHistory';

interface ChatSidebarProps {
  comparisons: ComparisonSummary[];
  activeComparisonId: string | null;
  onNewComparison: () => void;
  onOpenComparison: (id: string) => void;
  onDeleteComparison: (id: string) => void;
}

export const ChatSidebar = memo(function ChatSidebar({
  comparisons,
  activeComparisonId,
  onNewComparison,
  onOpenComparison,
  onDeleteComparison,
}: ChatSidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <button
        type="button"
        onClick={onNewComparison}
        className="m-3 rounded-lg border border-gray-200 px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        + New comparison
      </button>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {comparisons.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400">
            No comparisons yet
          </p>
        ) : (
          comparisons.map((item) => (
            <SidebarItem
              key={item.id}
              comparison={item}
              isActive={activeComparisonId === item.id}
              onOpen={onOpenComparison}
              onDelete={onDeleteComparison}
            />
          ))
        )}
      </nav>
    </aside>
  );
});

// ─── Sidebar item with delete action ──────────────────────────────────────────

interface SidebarItemProps {
  comparison: ComparisonSummary;
  isActive: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const SidebarItem = memo(function SidebarItem({
  comparison,
  isActive,
  onOpen,
  onDelete,
}: SidebarItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      className={`group relative flex items-center rounded-lg transition-colors ${
        isActive
          ? 'bg-primary-50 dark:bg-primary-900/30'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(comparison.id)}
        className="min-w-0 flex-1 px-3 py-2.5 text-left text-sm"
      >
        <p
          className={`truncate font-medium ${
            isActive
              ? 'text-primary-700 dark:text-primary-300'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {comparison.prompt.length > 60
            ? comparison.prompt.slice(0, 60) + '…'
            : comparison.prompt}
        </p>
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          {new Date(comparison.createdAt).toLocaleDateString()}
        </p>
      </button>

      {/* Kebab menu trigger */}
      <div ref={menuRef} className="relative mr-1.5 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          className={`rounded-md p-1 text-gray-400 transition-opacity hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 ${
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          title="More options"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM10 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM11.5 15.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete(comparison.id);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path
                  fillRule="evenodd"
                  d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                  clipRule="evenodd"
                />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
