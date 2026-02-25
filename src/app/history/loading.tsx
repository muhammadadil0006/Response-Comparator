import { Spinner } from '@/components/ui/Spinner';

export default function HistoryLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Loading comparison history...
        </p>
      </div>
    </div>
  );
}
