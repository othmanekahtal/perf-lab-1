import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { PAGE_SIZE, searchCatalog, type CatalogQuery } from '@/lib/catalog';
import { money, productImage } from '@/lib/format';

export function ProductResults({ query, href }: { query: CatalogQuery; href: (page: number) => string }) {
  const { total, page, pages, items } = searchCatalog(query);
  return (
    <>
      <p className="muted text-sm" data-testid="result-count">{total.toLocaleString('en-IE')} results</p>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" data-testid="product-grid">
        {items.map((p, i) => (
          <li key={p.id} className="panel overflow-hidden" data-testid="product-card" data-product-id={p.id}>
            <Link href={`/products/${p.id}`} className="block">
              <Image
                src={productImage(p.image)} alt={p.name} width={1600} height={1600} quality={60}
                sizes="(min-width: 1280px) 300px, (min-width: 768px) 32vw, 48vw"
                loading={i < 2 ? 'eager' : 'lazy'} fetchPriority={i < 2 ? 'high' : undefined}
                className="aspect-square w-full object-cover"
              />
              <div className="space-y-1 p-3">
                <div className="muted text-xs">{p.brand} · {p.category}</div>
                <div className="line-clamp-2 text-sm font-medium" data-testid="product-name">{p.name}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold tabular-nums" data-testid="product-price">{money(p.shelfCents)}</span>
                  <span className="text-xs text-amber-600"><Icon name="star" /> {p.rating.toFixed(1)}</span>
                </div>
                {p.stock === 0 ? (
                  <span className="chip border-transparent bg-red-600 text-white">Out of stock</span>
                ) : (
                  <span className="chip border-transparent bg-emerald-600 text-white">{p.stock} in stock</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <nav className="flex items-center justify-center gap-2" aria-label="Pagination" data-testid="pagination">
        {page > 1 ? (
          <Link className="btn-ghost" href={href(page - 1)} scroll={false} data-testid="page-prev"><Icon name="chevron-left" /> Prev</Link>
        ) : (
          <span className="btn-ghost opacity-50" aria-disabled data-testid="page-prev"><Icon name="chevron-left" /> Prev</span>
        )}
        <span className="text-sm tabular-nums" data-testid="page-indicator">Page {page} of {pages}</span>
        {page < pages ? (
          <Link className="btn-ghost" href={href(page + 1)} scroll={false} data-testid="page-next">Next <Icon name="chevron-right" /></Link>
        ) : (
          <span className="btn-ghost opacity-50" aria-disabled data-testid="page-next">Next <Icon name="chevron-right" /></span>
        )}
      </nav>
    </>
  );
}

export function ProductResultsSkeleton() {
  return (
    <>
      <div className="h-5 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: Math.min(8, PAGE_SIZE) }, (_, i) => <li key={i} className="panel aspect-[3/4] animate-pulse" />)}
      </ul>
    </>
  );
}
