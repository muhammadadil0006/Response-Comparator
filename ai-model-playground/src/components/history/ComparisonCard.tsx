'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useDeleteComparisonMutation } from '@/store/api/comparisonApi';
import { useAppDispatch } from '@/store/hooks';
import { loadFromHistory } from '@/store/slices/comparisonSlice';
import type { Comparison } from '@/types/comparison';
import {
  MODEL_DISPLAY_NAMES,
  PROVIDER_COLORS,
} from '@/lib/utils/constants';
import { ResponseStatus } from '@/types/enums';

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
      loadFromHistory({
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
    <Card className="transition-shadow hover:shadow-md">
      <CardBody>
        <div className="flex items-start justify-between gap-4">
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
