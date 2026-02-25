'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import {
  resetComparison,
  loadFromHistory,
} from '@/store/slices/comparisonSlice';
import {
  useListComparisonsQuery,
  useDeleteComparisonMutation,
} from '@/store/api/comparisonApi';
import { API_BASE_URL, API_ENDPOINTS } from '@/config/api-endpoints';
import type { ModelResponseData, Comparison } from '@/types/comparison';
import type { StoredComparison } from '@/hooks/useStreamingComparison';

const ANON_COMPARISONS_KEY = 'anon_comparisons_v1';
const MAX_ANON_COMPARISONS = 30;

// Sidebar summary shape (works for both auth + anon)
export interface ComparisonSummary {
  id: string;
  prompt: string;
  createdAt: string;
}

export function useComparisonHistory() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const comparisonId = useAppSelector((s) => s.comparison.comparisonId);

  const [localComparisons, setLocalComparisons] = useState<StoredComparison[]>([]);
  const [deleteComparisonMutation] = useDeleteComparisonMutation();
  const { data: authComparisonsData, refetch: refetchComparisons } =
    useListComparisonsQuery(
      { limit: 50, offset: 0 },
      { skip: !isAuthenticated },
    );

  // ─── Load anon comparisons from localStorage ──────────────────────────
  useEffect(() => {
    if (isAuthenticated) return;
    try {
      const raw = localStorage.getItem(ANON_COMPARISONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLocalComparisons(parsed);
      }
    } catch {
      setLocalComparisons([]);
    }
  }, [isAuthenticated]);

  // ─── Sidebar data ───────────────────────────────────────────────────────
  const sidebarComparisons = useMemo((): ComparisonSummary[] => {
    if (isAuthenticated) {
      return (authComparisonsData?.comparisons ?? []).map((c) => ({
        id: c.comparison_id,
        prompt: c.prompt,
        createdAt: c.created_at,
      }));
    }
    return localComparisons.map((c) => ({
      id: c.id,
      prompt: c.prompt,
      createdAt: c.createdAt,
    }));
  }, [isAuthenticated, authComparisonsData, localComparisons]);

  // ─── Persist helper ─────────────────────────────────────────────────────
  const persistLocal = useCallback(
    (items: StoredComparison[]) => {
      if (isAuthenticated) return;
      try {
        localStorage.setItem(ANON_COMPARISONS_KEY, JSON.stringify(items));
      } catch {
        /* ignore */
      }
    },
    [isAuthenticated],
  );

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleNewComparison = useCallback(() => {
    dispatch(resetComparison());
  }, [dispatch]);

  const handleOpenComparison = useCallback(
    async (id: string) => {
      if (isAuthenticated) {
        try {
          const res = await fetch(
            `${API_BASE_URL}${API_ENDPOINTS.COMPARISON_BY_ID(id)}`,
          );
          if (!res.ok) throw new Error('Failed to load comparison');
          const detail: Comparison = await res.json();
          dispatch(
            loadFromHistory({
              comparisonId: detail.comparison_id,
              prompt: detail.prompt,
              responses: detail.responses,
            }),
          );
        } catch (err) {
          console.error('Failed to load comparison:', err);
        }
      } else {
        const local = localComparisons.find((c) => c.id === id);
        if (local) {
          dispatch(
            loadFromHistory({
              comparisonId: local.id,
              prompt: local.prompt,
              responses: local.responses,
            }),
          );
        }
      }
    },
    [dispatch, isAuthenticated, localComparisons],
  );

  const handleDeleteComparison = useCallback(
    async (id: string) => {
      // Remove locally first (optimistic)
      setLocalComparisons((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        persistLocal(updated);
        return updated;
      });
      if (isAuthenticated) {
        try {
          await deleteComparisonMutation(id).unwrap();
        } catch {
          /* ignore */
        }
      }
      // If the deleted one is active, reset
      if (comparisonId === id) {
        dispatch(resetComparison());
      }
    },
    [isAuthenticated, deleteComparisonMutation, comparisonId, dispatch, persistLocal],
  );

  // ─── Callback for streaming hook to persist anon comparisons ──────────
  const persistAnonComparison = useCallback(
    (prompt: string, responses: ModelResponseData[], compId: string) => {
      setLocalComparisons((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === compId);
        if (existingIdx >= 0) {
          // Update existing (retry case)
          const updated = [...prev];
          const existing = updated[existingIdx];
          // Merge responses — replace by model_id
          const mergedResponses = [...existing.responses];
          for (const r of responses) {
            const idx = mergedResponses.findIndex((x) => x.model_id === r.model_id);
            if (idx >= 0) mergedResponses[idx] = r;
            else mergedResponses.push(r);
          }
          updated[existingIdx] = { ...existing, responses: mergedResponses };
          // Move to front
          updated.unshift(updated.splice(existingIdx, 1)[0]);
          persistLocal(updated);
          return updated;
        }

        const newItem: StoredComparison = {
          id: compId,
          prompt,
          responses,
          createdAt: new Date().toISOString(),
        };
        const updated = [newItem, ...prev].slice(0, MAX_ANON_COMPARISONS);
        persistLocal(updated);
        return updated;
      });
    },
    [persistLocal],
  );

  const handleStreamComplete = useCallback(() => {
    if (isAuthenticated) {
      refetchComparisons();
    }
  }, [isAuthenticated, refetchComparisons]);

  return {
    sidebarComparisons,
    comparisonId,
    handleNewComparison,
    handleOpenComparison,
    handleDeleteComparison,
    persistAnonComparison,
    handleStreamComplete,
  };
}
