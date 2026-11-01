'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { money, productImage } from '@/lib/format';
import type { Product } from '@/lib/types';
import { effectivePrice, relevance, sortProducts, type SortKey } from './search';
import { Icon } from '@/components/icon';

const PAGE_SIZE = 24;
const CATEGORIES = ['Audio', 'Cameras', 'Computers', 'Gaming', 'Home', 'Kitchen', 'Outdoor', 'Phones', 'Smart Home', 'Sports', 'Wearables', 'Office'];

// Remembers previous result sets so going back to the list is instant.
// PERF-BUG #13: module-level array that is never trimmed and retains every products array ever received. Affects S9.
const visited: { at: number; products: Product[]; results: Product[] }[] = [];

type Filters = { query: string; categories: string[]; brand: string; inStock: boolean; sort: SortKey };

function compute(products: Product[], f: Filters) {
  const scored = [];
  for (const p of products) {
    if (f.categories.length && !f.categories.includes(p.category)) continue;
    if (f.brand && p.brand !== f.brand) continue;
    if (f.inStock && p.stock === 0) continue;
    const score = relevance(p, f.query);
    if (f.query && score < 0.55) continue;
    scored.push({ ...p, score });
  }
  return sortProducts(scored, f.sort);
}

export function ProductsExplorer({ products }: { products: Product[] }) {
  const [filters, setFilters] = useState<Filters>({ query: '', categories: [], brand: '', inStock: false, sort: 'relevance' });
  const [results, setResults] = useState<Product[]>(() => compute(products, filters));
  const [page, setPage] = useState(1);
  const brands = [...new Set(products.map((p) => p.brand))].sort();

  useEffect(() => {
    visited.push({ at: Date.now(), products, results });
  }, [products, results]);

  // PERF-BUG #11: the handler recomputes fuzzy relevance for 5,000 products and re-sorts synchronously; one keystroke = one long task. Fix family: yield to the main thread (scheduler.yield/chunking/transitions). Affects S5.
  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setResults(compute(products, next));
    setPage(1);
  };

  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4" data-testid="products-explorer">
      <div className="panel space-y-3 p-4">
        <div className="relative">
          <Icon name="magnify" className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input
            className="input ps-9"
            placeholder="Search products…"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
            data-testid="product-search"
            aria-label="Search products"
          />
        </div>
        <div className="flex flex-wrap gap-2" data-testid="category-filters">
          {CATEGORIES.map((c) => {
            const on = filters.categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => update({ categories: on ? filters.categories.filter((x) => x !== c) : [...filters.categories, c] })}
                className={`chip ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'}`}
                data-testid="category-chip"
              >
                {c}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select className="input w-auto" value={filters.brand} onChange={(e) => update({ brand: e.target.value })} aria-label="Brand" data-testid="brand-filter">
            <option value="">All brands</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={filters.inStock} onChange={(e) => update({ inStock: e.target.checked })} data-testid="instock-filter" /> In stock only
          </label>
          <div className="ms-auto flex flex-wrap items-center gap-1" role="group" aria-label="Sort" data-testid="sort-buttons">
            {(['relevance', 'name', 'price-asc', 'price-desc', 'rating', 'newest'] as SortKey[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={filters.sort === s}
                onClick={() => update({ sort: s })}
                className={`rounded-md px-2 py-1 text-xs font-medium ${filters.sort === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                data-testid={`sort-${s}`}
              >
                {s.replace('-asc', ' ↑').replace('-desc', ' ↓')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="muted text-sm" data-testid="result-count">{results.length.toLocaleString('en-IE')} results</p>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" data-testid="product-grid">
        {visible.map((p) => (
          <li key={p.id} className="panel overflow-hidden" data-testid="product-card" data-product-id={p.id}>
            <Link href={`/products/${p.id}`} className="block">
              <Image src={productImage(p.image)} alt={p.name} width={1600} height={1600} sizes="(min-width: 1280px) 300px, (min-width: 768px) 32vw, 48vw" quality={60} className="aspect-square w-full object-cover" />
              <div className="space-y-1 p-3">
                <div className="muted text-xs">{p.brand} · {p.category}</div>
                <div className="line-clamp-2 text-sm font-medium" data-testid="product-name">{p.name}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold tabular-nums" data-testid="product-price">{money(effectivePrice(p))}</span>
                  <span className="text-xs text-amber-600"><Icon name="star" /> {p.rating.toFixed(1)}</span>
                </div>
                {p.stock === 0 ? <span className="chip border-transparent bg-red-600 text-white">Out of stock</span> : <span className="chip border-transparent bg-emerald-600 text-white">{p.stock} in stock</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <nav className="flex items-center justify-center gap-2" aria-label="Pagination" data-testid="pagination">
        <button className="btn-ghost" disabled={page === 1} onClick={() => setPage(page - 1)} data-testid="page-prev">
          <Icon name="chevron-left" /> Prev
        </button>
        <span className="text-sm tabular-nums" data-testid="page-indicator">Page {page} of {pages}</span>
        <button className="btn-ghost" disabled={page === pages} onClick={() => setPage(page + 1)} data-testid="page-next">
          Next <Icon name="chevron-right" />
        </button>
      </nav>
    </div>
  );
}
