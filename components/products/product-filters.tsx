'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Icon } from '@/components/icon';
import type { SortKey } from '@/lib/search';

const CATEGORIES = ['Audio', 'Cameras', 'Computers', 'Gaming', 'Home', 'Kitchen', 'Outdoor', 'Phones', 'Smart Home', 'Sports', 'Wearables', 'Office'];
const SORTS: SortKey[] = ['relevance', 'name', 'price-asc', 'price-desc', 'rating', 'newest'];

/** Filter bar: updates the URL inside a transition, so input stays responsive while the server filters. */
export function ProductFilters({ brands }: { brands: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const categories = params.get('cat')?.split(',').filter(Boolean) ?? [];
  const sort = (params.get('sort') as SortKey | null) ?? 'relevance';

  const apply = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page');
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  // Debounce typing: one request per pause, not per keystroke.
  useEffect(() => {
    if (query === (params.get('q') ?? '')) return;
    const t = setTimeout(() => apply({ q: query.trim() || null }), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="panel space-y-3 p-4" data-pending={pending || undefined}>
      <div className="relative">
        <Icon name="magnify" className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input className="input ps-9" placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="product-search" aria-label="Search products" />
      </div>
      <div className="flex flex-wrap gap-2" data-testid="category-filters">
        {CATEGORIES.map((c) => {
          const on = categories.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => apply({ cat: (on ? categories.filter((x) => x !== c) : [...categories, c]).join(',') || null })}
              className={`chip ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'}`}
              data-testid="category-chip"
            >
              {c}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select className="input w-auto" value={params.get('brand') ?? ''} onChange={(e) => apply({ brand: e.target.value || null })} aria-label="Brand" data-testid="brand-filter">
          <option value="">All brands</option>
          {brands.map((b) => <option key={b}>{b}</option>)}
        </select>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={params.get('stock') === '1'} onChange={(e) => apply({ stock: e.target.checked ? '1' : null })} data-testid="instock-filter" /> In stock only
        </label>
        <div className="ms-auto flex flex-wrap items-center gap-1" role="group" aria-label="Sort" data-testid="sort-buttons">
          {SORTS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sort === s}
              onClick={() => apply({ sort: s === 'relevance' ? null : s })}
              className={`rounded-md px-2 py-1 text-xs font-medium ${sort === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              data-testid={`sort-${s}`}
            >
              {s.replace('-asc', ' ↑').replace('-desc', ' ↓')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductFiltersSkeleton() {
  return <div className="panel h-[236px] p-4 sm:h-[180px]" />;
}
