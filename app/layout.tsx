import type { Metadata, Viewport } from 'next';
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

// Applies the saved theme before first paint, without making the layout depend on the request.
const THEME_SCRIPT = `document.documentElement.dataset.theme=(document.cookie.match(/(?:^|; )theme=(dark|light)/)||[])[1]||'light'`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
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
