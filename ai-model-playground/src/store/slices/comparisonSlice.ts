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
  syncScroll: false,
};

export const comparisonSlice = createSlice({
  name: 'comparison',
  initialState,
  reducers: {
    setPrompt: (state, action: PayloadAction<string>) => {
      state.currentPrompt = action.payload;
    },
    startComparison: (state, action: PayloadAction<{ comparisonId: string; models: string[] }>) => {
      state.isLoading = true;
      state.comparisonId = action.payload.comparisonId;
      state.models = {};
      action.payload.models.forEach((modelId) => {
        state.models[modelId] = {
          modelId,
          provider: '',
          status: ModelStatus.IDLE,
          responseText: '',
          metrics: null,
        };
      });
    },
    modelStarted: (
      state,
      action: PayloadAction<{ modelId: string; provider: string }>
    ) => {
      const model = state.models[action.payload.modelId];
      if (model) {
        model.status = ModelStatus.STREAMING;
        model.provider = action.payload.provider;
      }
    },
    appendChunk: (
      state,
      action: PayloadAction<{ modelId: string; chunk: string }>
    ) => {
      const model = state.models[action.payload.modelId];
      if (model) {
        model.responseText += action.payload.chunk;
      }
    },
    modelCompleted: (
      state,
      action: PayloadAction<{
        modelId: string;
        metrics: ModelStreamState['metrics'];
      }>
    ) => {
      const model = state.models[action.payload.modelId];
      if (model) {
        model.status = ModelStatus.COMPLETED;
        model.metrics = action.payload.metrics;
      }
    },
    modelError: (
      state,
      action: PayloadAction<{ modelId: string; error: string }>
    ) => {
      const model = state.models[action.payload.modelId];
      if (model) {
        model.status = ModelStatus.ERROR;
        model.errorMessage = action.payload.error;
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
    toggleSyncScroll: (state) => {
      state.syncScroll = !state.syncScroll;
    },
    resetComparison: () => initialState,
  },
});

export const {
  setPrompt,
  startComparison,
  modelStarted,
  appendChunk,
  modelCompleted,
  modelError,
  resetModelForRetry,
  comparisonCompleted,
  setComparisonFromHistory,
  toggleSyncScroll,
  resetComparison,
} = comparisonSlice.actions;

export default comparisonSlice.reducer;
