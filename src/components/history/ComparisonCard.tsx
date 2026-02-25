'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody } from '@/components/ui/Card';
import { KebabMenu, type KebabMenuItem } from '@/components/ui/KebabMenu';
import { useDeleteComparisonMutation } from '@/store/api/comparisonApi';
import { useAppDispatch } from '@/store/hooks';
import { setComparisonFromHistory } from '@/store/slices/comparisonSlice';
import type { Comparison } from '@/types/comparison';
import {
  MODEL_DISPLAY_NAMES,
  PROVIDER_COLORS,
} from '@/lib/utils/constants';
import { ResponseStatus } from '@/types/enums';

// ── Icons ─────────────────────────────────────────────────────────────────────

function ViewIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
      <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface ComparisonCardProps {
  comparison: Comparison;
}

export function ComparisonCard({ comparison }: ComparisonCardProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [deleteComparison, { isLoading: isDeleting }] =
    useDeleteComparisonMutation();

  // Inline delete confirmation state
  const [showConfirm, setShowConfirm] = useState(false);
  // Transient "Copied!" link feedback
  const [linkCopied, setLinkCopied] = useState(false);

  const handleView = () => {
    dispatch(
      setComparisonFromHistory({
        comparisonId: comparison.comparison_id,
        prompt: comparison.prompt,
        responses: comparison.responses,
      })
    );
    router.push(`/compare/${comparison.comparison_id}`);
  };

  const handleCopyLink = async () => {
    // Anonymous / local-only chats aren’t persisted server-side
    if (comparison.comparison_id.startsWith('anon-')) {
      alert('Sign in to save and share this comparison.');
      return;
    }
    try {
      // /share/<id> is the canonical read-only route.
      // Owners who open it are automatically redirected to /compare/<id>.
      const url = `${window.location.origin}/share/${comparison.comparison_id}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleDelete = async () => {
    try {
      await deleteComparison(comparison.comparison_id).unwrap();
    } catch {
      console.error('Failed to delete comparison');
    }
    setShowConfirm(false);
  };

  const menuItems: KebabMenuItem[] = [
    {
      label: 'View',
      icon: <ViewIcon />,
      onClick: handleView,
    },
    {
      label: linkCopied ? 'Copied!' : 'Copy link',
      icon: <LinkIcon />,
      onClick: handleCopyLink,
    },
    {
      label: 'Delete',
      icon: <TrashIcon />,
      onClick: () => setShowConfirm(true),
      variant: 'danger',
    },
  ];

  const date = new Date(comparison.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          {/* ── Prompt & model chips ──────────────────────── */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {comparison.prompt}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {comparison.responses.map((response) => (
                <span
                  key={response.model_id}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: PROVIDER_COLORS[response.provider] || '#6b7280',
                    }}
                  />
                  {MODEL_DISPLAY_NAMES[response.model_id] || response.model_id}
                  <span
                    className={`ml-1 ${
                      response.status === ResponseStatus.COMPLETED
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {response.status === ResponseStatus.COMPLETED ? '✓' : '✗'}
                  </span>
                </span>
              ))}
              <span className="text-xs text-gray-400">{date}</span>
            </div>
          </div>

          {/* ── Actions ───────────────────────────────────── */}
          <div className="shrink-0">
            {showConfirm ? (
              /* Inline delete confirmation */
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <KebabMenu items={menuItems} align="right" />
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

interface ComparisonCardProps {
  comparison: Comparison;
}

export function ComparisonCard({ comparison }: ComparisonCardProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [deleteComparison, { isLoading: isDeleting }] =
    useDeleteComparisonMutation();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleView = () => {
    dispatch(
      setComparisonFromHistory({
        comparisonId: comparison.comparison_id,
        prompt: comparison.prompt,
        responses: comparison.responses,
      })
    );
    router.push('/compare');
  };

  const handleDelete = async () => {
    try {
      await deleteComparison(comparison.comparison_id).unwrap();
    } catch {
      console.error('Failed to delete comparison');
    }
    setShowConfirm(false);
  };

  const date = new Date(comparison.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:border-[#8B949E]/30">
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#F0F6FC] truncate">
              {comparison.prompt}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {comparison.responses.map((response) => (
                <span
                  key={response.model_id}
                  className="inline-flex items-center gap-1 rounded-full bg-[#1C2128] border border-[#30363D] px-2 py-0.5 text-xs text-[#8B949E]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: PROVIDER_COLORS[response.provider] || '#6b7280',
                    }}
                  />
                  {MODEL_DISPLAY_NAMES[response.model_id] || response.model_id}
                  <span
                    className={`ml-1 ${
                      response.status === ResponseStatus.COMPLETED
                        ? 'text-[#10A37F]'
                        : 'text-[#F85149]'
                    }`}
                  >
                    {response.status === ResponseStatus.COMPLETED ? '✓' : '✗'}
                  </span>
                </span>
              ))}
              <span className="text-xs text-[#8B949E]/60">{date}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleView}>
              View
            </Button>
            {showConfirm ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  isLoading={isDeleting}
                >
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirm(true)}
                className="text-[#F85149]/70 hover:text-[#F85149] hover:bg-[#F85149]/10"
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
