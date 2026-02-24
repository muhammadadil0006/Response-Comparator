import { HistoryContainer } from '@/components/history/HistoryContainer';

export default function HistoryPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Comparison History
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          View and manage your saved AI model comparisons
        </p>
      </div>
      <HistoryContainer />
    </div>
  );
}
