import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ModelResponseData, ModelMetrics } from '@/types/comparison';
import { extractErrorMessage } from '@/lib/utils/errors';
import { ModelStatus, ResponseStatus } from '@/types/enums';

// ─── Public types ──────────────────────────────────────────────────────────────

export interface ModelStreamState {
  modelId: string;
  provider: string;
  status: ModelStatus;
  responseText: string;
  errorMessage?: string;
  errorCategory?: 'rate-limit' | 'capability' | 'auth' | 'not-found' | 'timeout' | 'content-filter' | 'server' | 'unknown';
  finishReason?: string;
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  metrics: ModelMetrics | null;
}

// ─── State shape (single comparison — not multi-turn) ──────────────────────────

interface ComparisonState {
  /** Real comparison ID (UUID) once confirmed by backend */
  comparisonId: string | null;
  /** Temporary optimistic ID before backend confirms */
  pendingId: string | null;
  /** The user's prompt */
  prompt: string;
  /** Per-model streaming state */
  models: Record<string, ModelStreamState>;
  /** True once all models are COMPLETED or ERROR */
  isComplete: boolean;
  isLoading: boolean;
  syncScroll: boolean;
}

const initialState: ComparisonState = {
  comparisonId: null,
  pendingId: null,
  prompt: '',
  models: {},
  isComplete: false,
  isLoading: false,
  syncScroll: true,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Are ALL models in a terminal state (COMPLETED or ERROR)? */
export function allModelsDone(models: Record<string, ModelStreamState>): boolean {
  const entries = Object.values(models);
  if (entries.length === 0) return false;
  return entries.every(
    (m) => m.status === ModelStatus.COMPLETED || m.status === ModelStatus.ERROR
  );
}

// ─── Slice ─────────────────────────────────────────────────────────────────────

export const comparisonSlice = createSlice({
  name: 'comparison',
  initialState,
  reducers: {
    /** Start a new comparison — resets everything */
    startComparison: (
      state,
      action: PayloadAction<{ pendingId: string; prompt: string; models: string[] }>
    ) => {
      // Completely reset to initial + new comparison
      state.comparisonId = null;
      state.pendingId = action.payload.pendingId;
      state.prompt = action.payload.prompt;
      state.isLoading = true;
      state.isComplete = false;
      state.models = {};
      action.payload.models.forEach((modelId) => {
        state.models[modelId] = {
          modelId,
          provider: modelId.split('/')[0] || 'unknown',
          status: ModelStatus.IDLE,
          responseText: '',
          metrics: null,
        };
      });
    },

    /** Backend confirmed real comparison ID */
    confirmComparison: (
      state,
      action: PayloadAction<{
        comparisonId: string;
        models?: string[];
      }>
    ) => {
      state.comparisonId = action.payload.comparisonId;
      state.pendingId = null;
      if (action.payload.models) {
        const resolvedModels: Record<string, ModelStreamState> = {};
        action.payload.models.forEach((mid) => {
          resolvedModels[mid] = state.models[mid] || {
            modelId: mid,
            provider: mid.split('/')[0] || 'unknown',
            status: ModelStatus.IDLE,
            responseText: '',
            metrics: null,
          };
        });
        // Keep any extras that were already tracked
        Object.keys(state.models).forEach((id) => {
          if (!resolvedModels[id]) resolvedModels[id] = state.models[id];
        });
        state.models = resolvedModels;
      }
    },

    modelStarted: (
      state,
      action: PayloadAction<{ modelId: string; provider: string }>
    ) => {
      const { modelId, provider } = action.payload;
      if (!state.models[modelId]) {
        state.models[modelId] = {
          modelId,
          provider: provider || modelId.split('/')[0] || 'unknown',
          status: ModelStatus.STREAMING,
          responseText: '',
          metrics: null,
        };
      } else {
        state.models[modelId].status = ModelStatus.STREAMING;
        state.models[modelId].provider = provider || state.models[modelId].provider;
      }
    },

    /** Batch-append chunks (rAF batching — one dispatch per frame) */
    appendChunks: (
      state,
      action: PayloadAction<{ chunks: Array<{ modelId: string; chunk: string }> }>
    ) => {
      for (const { modelId, chunk } of action.payload.chunks) {
        if (!state.models[modelId]) {
          state.models[modelId] = {
            modelId,
            provider: modelId.split('/')[0] || 'unknown',
            status: ModelStatus.STREAMING,
            responseText: chunk,
            metrics: null,
          };
        } else {
          state.models[modelId].responseText += chunk;
        }
      }
    },

    modelCompleted: (
      state,
      action: PayloadAction<{
        modelId: string;
        metrics: ModelStreamState['metrics'];
        finishReason?: string;
      }>
    ) => {
      const { modelId, metrics, finishReason } = action.payload;
      if (!state.models[modelId]) {
        state.models[modelId] = {
          modelId,
          provider: modelId.split('/')[0] || 'unknown',
          status: ModelStatus.COMPLETED,
          responseText: '',
          metrics,
        };
      } else {
        state.models[modelId].status = ModelStatus.COMPLETED;
        state.models[modelId].metrics = metrics;
      }
      if (finishReason) {
        state.models[modelId].finishReason = finishReason;
      }
    },

    modelError: (
      state,
      action: PayloadAction<{ modelId: string; error: string; category?: string }>
    ) => {
      const { modelId, error, category } = action.payload;
      if (!state.models[modelId]) {
        state.models[modelId] = {
          modelId,
          provider: modelId.split('/')[0] || 'unknown',
          status: ModelStatus.ERROR,
          responseText: '',
          errorMessage: error,
          errorCategory: (category as ModelStreamState['errorCategory']) || 'unknown',
          metrics: null,
        };
      } else {
        state.models[modelId].status = ModelStatus.ERROR;
        state.models[modelId].errorMessage = error;
        state.models[modelId].errorCategory =
          (category as ModelStreamState['errorCategory']) || 'unknown';
      }
    },

    addToolCall: (
      state,
      action: PayloadAction<{
        modelId: string;
        toolCall: { id: string; name: string; args: Record<string, unknown> };
      }>
    ) => {
      const { modelId, toolCall } = action.payload;
      if (!state.models[modelId]) {
        state.models[modelId] = {
          modelId,
          provider: modelId.split('/')[0] || 'unknown',
          status: ModelStatus.STREAMING,
          responseText: '',
          toolCalls: [toolCall],
          metrics: null,
        };
      } else {
        if (!state.models[modelId].toolCalls) {
          state.models[modelId].toolCalls = [];
        }
        state.models[modelId].toolCalls!.push(toolCall);
      }
    },

    /** Reset a single model for retry */
    resetModelForRetry: (
      state,
      action: PayloadAction<{ modelId: string }>
    ) => {
      state.isLoading = true;
      state.isComplete = false;
      const model = state.models[action.payload.modelId];
      if (model) {
        model.status = ModelStatus.PENDING;
        model.responseText = '';
        model.errorMessage = undefined;
        model.finishReason = undefined;
        model.toolCalls = undefined;
        model.metrics = null;
      }
    },

    /** Mark comparison as complete */
    comparisonCompleted: (state) => {
      state.isComplete = true;
      state.isLoading = false;
    },

    /** Load a completed comparison from history */
    loadFromHistory: (
      state,
      action: PayloadAction<{
        comparisonId: string;
        prompt: string;
        responses: ModelResponseData[];
      }>
    ) => {
      state.comparisonId = action.payload.comparisonId;
      state.pendingId = null;
      state.prompt = action.payload.prompt;
      state.isLoading = false;
      state.isComplete = true;
      state.models = action.payload.responses.reduce<Record<string, ModelStreamState>>(
        (acc, r) => {
          acc[r.model_id] = {
            modelId: r.model_id,
            provider: r.provider,
            status:
              r.status === ResponseStatus.ERROR
                ? ModelStatus.ERROR
                : ModelStatus.COMPLETED,
            responseText: r.response_text,
            errorMessage: extractErrorMessage(r.error_message, ''),
            metrics: r.metrics,
          };
          return acc;
        },
        {}
      );
    },

    resetComparison: () => initialState,

    toggleSyncScroll: (state) => {
      state.syncScroll = !state.syncScroll;
    },
  },
});

export const {
  startComparison,
  confirmComparison,
  modelStarted,
  appendChunks,
  modelCompleted,
  modelError,
  addToolCall,
  resetModelForRetry,
  comparisonCompleted,
  loadFromHistory,
  resetComparison,
  toggleSyncScroll,
} = comparisonSlice.actions;

export default comparisonSlice.reducer;
