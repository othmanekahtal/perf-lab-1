import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import Script from 'next/script';
import { ChatLauncher } from '@/components/chat-launcher';
import './globals.css';

const VENDOR_ORIGIN = process.env.NEXT_PUBLIC_VENDOR_ORIGIN ?? 'http://localhost:4002';

export const metadata: Metadata = {
  title: { default: 'Shoply Admin', template: '%s · Shoply Admin' },
  description: 'Back office for the Shoply store',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6d28d9',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // PERF-BUG #1: reading cookies()/headers() in the ROOT layout opts every route into dynamic rendering (no static shell, high TTFB everywhere). Affects S1, S2, S10.
  const theme = (await cookies()).get('theme')?.value === 'dark' ? 'dark' : 'light';
  const lang = ((await headers()).get('accept-language') ?? 'en').split(',')[0].split('-')[0] || 'en';
  return (
    <html lang={lang} data-theme={theme}>
      <head>
        <link rel="preconnect" href={VENDOR_ORIGIN} />
      </head>
      <body>
        {children}
        {/* HelloDesk renders its launcher here (fixed position, so it never shifts the page). */}
        <div id="hellodesk-launcher" className="fixed inset-x-3 bottom-3 z-50 overflow-hidden rounded-xl shadow-lg empty:hidden sm:left-auto sm:w-96" />
        <Script src={`${VENDOR_ORIGIN}/analytics.js`} strategy="lazyOnload" />
        <ChatLauncher />
      </body>
    </html>
  );
}
