import { ModelPanel } from '@/components/comparison/ModelPanel';
import type { ModelStreamState } from '@/store/slices/comparisonSlice';
import { DEFAULT_MODELS } from '@/types/models';
import { ModelStatus, MODEL_ID_TO_PROVIDER, ModelId } from '@/types/enums';

interface ComparisonViewProps {
  models: Record<string, ModelStreamState>;
  currentPrompt?: string;
  onRetry?: (modelId: string) => void;
  onEditResponse?: (text: string) => void;
}

/** Dumb/presentational component — receives model data via props */
export function ComparisonView({ models, currentPrompt, onRetry, onEditResponse }: ComparisonViewProps) {
  const modelEntries = Object.values(models);

  if (modelEntries.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {DEFAULT_MODELS.map((modelId) => (
          <ModelPanel
            key={modelId}
            modelId={modelId}
            provider={MODEL_ID_TO_PROVIDER[modelId] || modelId.split('/')[0] || 'unknown'}
            status={ModelStatus.IDLE}
            responseText=""
            metrics={null}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {currentPrompt && (
        <div className="rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Prompt</p>
          <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{currentPrompt}</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {modelEntries.map((model) => (
          <ModelPanel
            key={model.modelId}
            modelId={model.modelId}
            provider={model.provider}
            status={model.status}
            responseText={model.responseText}
            errorMessage={model.errorMessage}
            metrics={model.metrics}
            onRetry={model.status === ModelStatus.ERROR ? onRetry : undefined}
            onEditResponse={onEditResponse}
          />
        ))}
      </div>
    </div>
  );
}
