import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="max-w-3xl space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white">
          AI Model{' '}
          <span className="text-primary-600">Playground</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Compare responses from GPT-4o, Claude 3 Sonnet, and Grok 2
          side-by-side. Evaluate response quality, speed, token usage,
          and cost — all in one place.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/compare">
            <Button size="lg">Start Comparing</Button>
          </Link>
          <Link href="/register">
            <Button variant="secondary" size="lg">
              Create Account
            </Button>
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="mt-20 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3">
        <FeatureCard
          icon="⚡"
          title="Parallel Comparison"
          description="Send your prompt to three AI models simultaneously and see their responses stream in real-time."
        />
        <FeatureCard
          icon="📊"
          title="Performance Metrics"
          description="Compare response time, token usage, and estimated costs across models at a glance."
        />
        <FeatureCard
          icon="💾"
          title="Save & Review"
          description="Save interesting comparisons to your history and revisit them anytime."
        />
      </div>

      {/* Model Cards */}
      <div className="mt-16 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
        <ModelCard
          name="GPT-4o"
          provider="OpenAI"
          color="#10a37f"
          description="Latest multimodal model with strong reasoning and coding capabilities."
        />
        <ModelCard
          name="Claude 3 Sonnet"
          provider="Anthropic"
          color="#d4a574"
          description="Balanced model excelling at analysis, writing, and following instructions."
        />
        <ModelCard
          name="Grok 2"
          provider="xAI"
          color="#1da1f2"
          description="Advanced model with real-time knowledge and creative capabilities."
        />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="text-3xl">{icon}</div>
      <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}

function ModelCard({
  name,
  provider,
  color,
  description,
}: {
  name: string;
  provider: string;
  color: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <h3 className="font-semibold text-gray-900 dark:text-white">{name}</h3>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {provider}
      </p>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}
