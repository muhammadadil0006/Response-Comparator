import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ModelResponseData, ModelMetrics } from '@/types/comparison';
import { extractErrorMessage } from '@/lib/utils/errors';
import { ModelStatus, ResponseStatus } from '@/types/enums';

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

interface ComparisonState {
  currentPrompt: string;
  isLoading: boolean;
  comparisonId: string | null;
  models: Record<string, ModelStreamState>;
  syncScroll: boolean;
}

const initialState: ComparisonState = {
  currentPrompt: '',
  isLoading: false,
  comparisonId: null,
  models: {},
  syncScroll: true,
};

export const comparisonSlice = createSlice({
  name: 'comparison',
  initialState,
  reducers: {
    setPrompt: (state, action: PayloadAction<string>) => {
      state.currentPrompt = action.payload;
    },
    startComparison: (state, action: PayloadAction<{ comparisonId: string; models: string[]; prompt?: string }>) => {
      state.isLoading = true;
      state.comparisonId = action.payload.comparisonId;
      if (action.payload.prompt) {
        state.currentPrompt = action.payload.prompt;
      }
      // Preserve existing model entries that aren't in the new list
      // to prevent panels from disappearing during concurrent operations.
      const freshModels: Record<string, ModelStreamState> = {};
      action.payload.models.forEach((modelId) => {
        freshModels[modelId] = {
          modelId,
          provider: state.models[modelId]?.provider || '',
          status: ModelStatus.IDLE,
          responseText: '',
          metrics: null,
        };
      });
      // Keep any models that already exist but aren't in the new payload
      // (e.g. other panels during a single-model regenerate race)
      Object.keys(state.models).forEach((existingId) => {
        if (!freshModels[existingId]) {
          freshModels[existingId] = state.models[existingId];
        }
      });
      state.models = freshModels;
    },
    /**
     * Lightweight update — sets comparisonId (and optionally prompt)
     * WITHOUT touching the models record. Used when the backend resolves
     * a real ID for an in-flight comparison.
     */
    updateComparisonId: (
      state,
      action: PayloadAction<{ comparisonId: string; prompt?: string }>
    ) => {
      state.comparisonId = action.payload.comparisonId;
      if (action.payload.prompt) {
        state.currentPrompt = action.payload.prompt;
      }
    },
    modelStarted: (
      state,
      action: PayloadAction<{ modelId: string; provider: string }>
    ) => {
      const { modelId, provider } = action.payload;
      if (!state.models[modelId]) {
        // Defensive: create the entry if it doesn't exist yet
        state.models[modelId] = {
          modelId,
          provider,
          status: ModelStatus.STREAMING,
          responseText: '',
          metrics: null,
        };
      } else {
        state.models[modelId].status = ModelStatus.STREAMING;
        state.models[modelId].provider = provider;
      }
    },
    appendChunk: (
      state,
      action: PayloadAction<{ modelId: string; chunk: string }>
    ) => {
      const { modelId, chunk } = action.payload;
      if (!state.models[modelId]) {
        state.models[modelId] = {
          modelId,
          provider: '',
          status: ModelStatus.STREAMING,
          responseText: chunk,
          metrics: null,
        };
      } else {
        state.models[modelId].responseText += chunk;
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
          provider: '',
          status: ModelStatus.COMPLETED,
          responseText: '',
          metrics: metrics,
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
          provider: '',
          status: ModelStatus.ERROR,
          responseText: '',
          errorMessage: error,
          errorCategory: (category as ModelStreamState['errorCategory']) || 'unknown',
          metrics: null,
        };
      } else {
        state.models[modelId].status = ModelStatus.ERROR;
        state.models[modelId].errorMessage = error;
        state.models[modelId].errorCategory = (category as ModelStreamState['errorCategory']) || 'unknown';
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
          provider: '',
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
    resetModelForRetry: (
      state,
      action: PayloadAction<{ modelId: string }>
    ) => {
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
    comparisonCompleted: (state) => {
      state.isLoading = false;
    },
    setComparisonFromHistory: (
      state,
      action: PayloadAction<{
        comparisonId: string;
        prompt: string;
        responses: ModelResponseData[];
      }>
    ) => {
      state.comparisonId = action.payload.comparisonId;
      state.currentPrompt = action.payload.prompt;
      state.isLoading = false;
      state.models = {};
      action.payload.responses.forEach((responseData) => {
        state.models[responseData.model_id] = {
          modelId: responseData.model_id,
          provider: responseData.provider,
          status: responseData.status === ResponseStatus.ERROR
            ? ModelStatus.ERROR
            : ModelStatus.COMPLETED,
          responseText: responseData.response_text,
          errorMessage: extractErrorMessage(responseData.error_message, ''),
          metrics: responseData.metrics,
        };
      });
    },
    resetComparison: () => initialState,
    toggleSyncScroll: (state) => {
      state.syncScroll = !state.syncScroll;
    },
  },
});

export const {
  setPrompt,
  startComparison,
  updateComparisonId,
  modelStarted,
  appendChunk,
  modelCompleted,
  modelError,
  addToolCall,
  resetModelForRetry,
  comparisonCompleted,
  setComparisonFromHistory,
  resetComparison,
  toggleSyncScroll,
} = comparisonSlice.actions;

export default comparisonSlice.reducer;
