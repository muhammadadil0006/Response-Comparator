import { Spinner } from '@/components/ui/Spinner';

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-[#8B949E] animate-pulse">Loading…</p>
      </div>
    </div>
  );
}
