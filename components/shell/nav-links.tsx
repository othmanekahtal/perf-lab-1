'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Dashboard', icon: 'mdi-view-dashboard-outline', testid: 'nav-dashboard' },
  { href: '/products', label: 'Products', icon: 'mdi-package-variant-closed', testid: 'nav-products' },
  { href: '/orders', label: 'Orders', icon: 'mdi-receipt-text-outline', testid: 'nav-orders' },
  { href: '/settings', label: 'Settings', icon: 'mdi-cog-outline', testid: 'nav-settings' },
];

export function NavLinks({ lowStock }: { lowStock: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3">
      {LINKS.map((l) => {
        const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            data-testid={l.testid}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              active ? 'bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <i className={`mdi ${l.icon} text-lg leading-none`} />
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
