import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
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
        {/* PERF-BUG #10: third-party scripts load synchronously in <head> from another origin, with no preconnect; they block parsing/rendering and run heavy work at start-up. Affects S3, S4, S13. */}
        <script src={`${VENDOR_ORIGIN}/analytics.js`} />
        <script src={`${VENDOR_ORIGIN}/chat-widget.js`} />
      </head>
      <body>{children}</body>
    </html>
  );
}
