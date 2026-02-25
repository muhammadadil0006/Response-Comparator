'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useDeleteComparisonMutation } from '@/store/api/comparisonApi';
import { useAppDispatch } from '@/store/hooks';
import { setComparisonFromHistory } from '@/store/slices/comparisonSlice';
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
