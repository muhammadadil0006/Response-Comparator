import type { Metadata } from 'next';
import Script from 'next/script';
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
      <body className="min-h-screen flex flex-col" style={{ background: '#0B0F17', color: '#F0F6FC' }}>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-VSPJLWJCWV"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-VSPJLWJCWV');
          `}
        </Script>
        <Providers>
          <Header />
          <main className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
