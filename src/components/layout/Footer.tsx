export function Footer() {
  return (
    <footer className="border-t border-[#30363D] bg-[#0B0F17]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-[#8B949E]">
            &copy; {new Date().getFullYear()} AI Model Playground
          </p>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#10A37F]" />GPT-4o</span>
            <span className="text-[#30363D]">·</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#D97757]" />Claude 3</span>
            <span className="text-[#30363D]">·</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#E5E7EB]" />Grok</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
