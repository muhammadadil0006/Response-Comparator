import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <div className="relative w-full max-w-5xl px-4 pt-16 pb-12 text-center">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-hidden">
          <div className="h-64 w-96 rounded-full bg-primary-500/10 blur-3xl" />
        </div>

        {/* Badge */}
        <div className="animate-fade-in inline-flex items-center gap-2 rounded-full border border-[#30363D] bg-[#161B22] px-3 py-1 mb-6">
          <span className="h-2 w-2 rounded-full bg-[#10A37F] animate-pulse" />
          <span className="text-xs font-medium text-[#8B949E]">GPT-4o · Claude 3 Opus · Grok — Live</span>
        </div>

        <h1 className="animate-fade-in-up text-4xl font-bold tracking-tight text-[#F0F6FC] sm:text-5xl lg:text-6xl">
          AI Model{' '}
          <span className="bg-gradient-to-r from-primary-400 via-[#10A37F] to-[#D97757] bg-clip-text text-transparent">
            Playground
          </span>
        </h1>
        <p className="animate-fade-in-up delay-100 mt-5 text-base text-[#8B949E] max-w-xl mx-auto leading-relaxed">
          Compare GPT-4o, Claude 3, and Grok side-by-side. Evaluate response quality,
          speed, token usage, and cost — all in real-time.
        </p>
        <div className="animate-fade-in-up delay-200 mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/compare">
            <Button size="lg" className="shadow-glow hover:shadow-glow animate-glow-pulse">
              Start Comparing
            </Button>
          </Link>
          <Link href="/register">
            <Button variant="secondary" size="lg">
              Create Account
            </Button>
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="w-full max-w-5xl px-4 mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { icon: '⚡', title: 'Parallel Comparison', description: 'Send your prompt to three AI models simultaneously and see their responses stream in real-time.', delay: 'delay-100' },
          { icon: '📊', title: 'Performance Metrics', description: 'Compare response time, token usage, and estimated costs across models at a glance.', delay: 'delay-200' },
          { icon: '💾', title: 'Save & Review', description: 'Save interesting comparisons to your history and revisit them anytime.', delay: 'delay-300' },
        ].map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>

      {/* Model Cards */}
      <div className="w-full max-w-5xl px-4 mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ModelCard
          name="GPT-4o"
          provider="OpenAI"
          color="#10A37F"
          accentClass="from-[#10A37F]/20 to-transparent border-[#10A37F]/30"
          glowClass="hover:shadow-glow-openai"
          description="Latest multimodal model with strong reasoning and coding capabilities."
        />
        <ModelCard
          name="Claude 3 Opus"
          provider="Anthropic"
          color="#D97757"
          accentClass="from-[#D97757]/20 to-transparent border-[#D97757]/30"
          glowClass="hover:shadow-glow-anthropic"
          description="Balanced model excelling at analysis, writing, and following instructions."
        />
        <ModelCard
          name="Grok"
          provider="xAI"
          color="#E5E7EB"
          accentClass="from-white/10 to-transparent border-white/20"
          glowClass="hover:shadow-[0_0_20px_rgba(229,231,235,0.15)]"
          description="Advanced model with real-time knowledge and creative capabilities."
        />
      </div>

      {/* CTA Strip */}
      <div className="w-full max-w-5xl px-4 mt-12 mb-8">
        <div className="glow-border relative rounded-2xl bg-[#161B22] p-8 text-center overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-500/5 to-[#10A37F]/5" />
          <h2 className="text-2xl font-bold text-[#F0F6FC]">Ready to compare?</h2>
          <p className="mt-2 text-sm text-[#8B949E]">No credit card required for basic usage. Start in seconds.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/compare">
              <Button size="lg">Launch Playground</Button>
            </Link>
            <Link href="/history">
              <Button variant="secondary" size="lg">View History</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: string;
  title: string;
  description: string;
  delay: string;
}) {
  return (
    <div className={`animate-fade-in-up ${delay} group rounded-xl border border-[#30363D] bg-[#161B22] p-6 text-center transition-all duration-300 hover:border-[#8B949E]/50 hover:bg-[#1C2128]`}>
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-base font-semibold text-[#F0F6FC]">{title}</h3>
      <p className="mt-2 text-sm text-[#8B949E] leading-relaxed">{description}</p>
    </div>
  );
}

function ModelCard({
  name,
  provider,
  color,
  accentClass,
  glowClass,
  description,
}: {
  name: string;
  provider: string;
  color: string;
  accentClass: string;
  glowClass: string;
  description: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-gradient-to-b ${accentClass} bg-[#161B22] p-5 transition-all duration-300 ${glowClass} hover:-translate-y-0.5`}
      style={{ borderTopWidth: '3px', borderTopColor: color }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        <div>
          <p className="font-semibold text-[#F0F6FC] text-sm">{name}</p>
          <p className="text-[10px] text-[#8B949E]">{provider}</p>
        </div>
      </div>
      <p className="text-xs text-[#8B949E] leading-relaxed">{description}</p>
    </div>
  );
}
