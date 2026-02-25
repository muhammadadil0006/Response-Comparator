import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Model Playground',
  description: 'Compare AI models side by side — GPT-4o, Claude 3 Sonnet, and Grok 2',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
        <Providers>
          <Header />
          <main className="flex-1 w-full min-h-0">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
