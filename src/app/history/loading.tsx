import { Spinner } from '@/components/ui/Spinner';

export default function HistoryLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-[#8B949E] animate-pulse">
          Loading comparison history…
        </p>
      </div>
    </div>
  );
}
