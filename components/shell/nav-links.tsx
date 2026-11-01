'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/icon';

const LINKS: { href: string; label: string; icon: IconName; testid: string }[] = [
  { href: '/', label: 'Dashboard', icon: 'view-dashboard-outline', testid: 'nav-dashboard' },
  { href: '/products', label: 'Products', icon: 'package-variant-closed', testid: 'nav-products' },
  { href: '/orders', label: 'Orders', icon: 'receipt-text-outline', testid: 'nav-orders' },
  { href: '/settings', label: 'Settings', icon: 'cog-outline', testid: 'nav-settings' },
];

/** Highlights the current section; the pathname is request data, so this streams in. */
export function NavLinks({ lowStock }: { lowStock: number }) {
  return <NavList lowStock={lowStock} pathname={usePathname()} />;
}

/** The same links without an active state, used as the prerendered fallback. */
export function NavList({ lowStock, pathname }: { lowStock: number; pathname: string | null }) {
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3">
      {LINKS.map((l) => {
        const active = pathname !== null && (l.href === '/' ? pathname === '/' : pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            data-testid={l.testid}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              active ? 'bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Icon name={l.icon} className="text-lg" />
            {l.label}
            {l.href === '/products' && lowStock > 0 && (
              <span className="ms-auto rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-800" title="Low stock">{lowStock}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
