export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} AI Model Playground. Compare AI models side by side.
          </p>
          <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>GPT-4o</span>
            <span>&middot;</span>
            <span>Claude 3 Sonnet</span>
            <span>&middot;</span>
            <span>Grok 2</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
