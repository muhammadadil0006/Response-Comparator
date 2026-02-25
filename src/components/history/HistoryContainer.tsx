'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { HistoryList } from '@/components/history/HistoryList';

export function HistoryContainer() {
  return (
    <ProtectedRoute>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F6FC]">
            Comparison History
          </h1>
          <p className="mt-1 text-sm text-[#8B949E]">
            Your saved AI model comparisons
          </p>
        </div>
        <HistoryList />
      </div>
    </ProtectedRoute>
  );
}
