export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-6xl">
        {/* Skeleton 3-panel grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-[#30363D] bg-[#161B22] overflow-hidden"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {/* Fake top border */}
              <div
                className="h-0.5 skeleton"
              />
              {/* Header skeleton */}
              <div className="border-b border-[#30363D] p-4 flex items-center gap-2">
                <div className="skeleton h-3 w-3 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <div className="skeleton h-2.5 w-24 rounded-full" />
                  <div className="skeleton h-2 w-16 rounded-full" />
                </div>
              </div>
              {/* Body skeleton */}
              <div className="p-4 space-y-3">
                {[75, 90, 60, 80, 50].map((w, j) => (
                  <div
                    key={j}
                    className="skeleton h-2.5 rounded-full"
                    style={{ width: `${w}%`, animationDelay: `${(i * 100) + (j * 80)}ms` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-[#8B949E] animate-pulse">
          Preparing comparison…
        </p>
      </div>
    </div>
  );
}
