import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="relative flex min-h-[85vh] items-center justify-center overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-80 w-80 rounded-full bg-primary-500/8 blur-3xl" />
      </div>

      <div className="animate-fade-in-up relative w-full max-w-md px-4">
        {/* Logo mark */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-[#10A37F] text-white font-bold text-lg shadow-glow mb-4">
            AI
          </div>
          <h1 className="text-3xl font-bold text-[#F0F6FC]">
            Welcome Back
          </h1>
          <p className="mt-2 text-sm text-[#8B949E]">Sign in to your account</p>
        </div>

        <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-7 shadow-card">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
