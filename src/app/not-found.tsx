import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center animate-fade-in-up">
        <h1 className="text-8xl font-bold bg-gradient-to-b from-[#30363D] to-[#161B22] bg-clip-text text-transparent select-none">
          404
        </h1>
        <h2 className="mt-4 text-2xl font-semibold text-[#F0F6FC]">
          Page Not Found
        </h2>
        <p className="mt-2 text-[#8B949E]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-primary-500 px-6 py-2 text-sm font-medium text-white hover:bg-primary-600 transition-colors shadow-glow-sm"
          >
            Go Home
          </Link>
          <Link
            href="/compare"
            className="rounded-lg border border-[#30363D] bg-[#161B22] px-6 py-2 text-sm font-medium text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#8B949E]/50 transition-colors"
          >
            Compare Models
          </Link>
        </div>
      </div>
    </div>
  );
}
