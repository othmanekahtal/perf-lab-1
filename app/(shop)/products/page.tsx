import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductFilters, ProductFiltersSkeleton } from '@/components/products/product-filters';
import { ProductResults, ProductResultsSkeleton } from '@/components/products/product-results';
import { catalogBrands, parseCatalogQuery } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Products' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ProductsPage({ searchParams }: Props) {
  return (
    <div className="space-y-4" data-testid="products-explorer">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <p className="muted text-sm">5,000 products in the catalogue</p>
      </div>
      <Suspense fallback={<ProductFiltersSkeleton />}>
        <Filters />
      </Suspense>
      <Suspense fallback={<ProductResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Filters() {
  return <ProductFilters brands={await catalogBrands()} />;
}

async function Results({ searchParams }: Props) {
  const sp = await searchParams;
  const query = parseCatalogQuery(sp);
  const href = (page: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === 'string' && k !== 'page') next.set(k, v);
    if (page > 1) next.set('page', String(page));
    const qs = next.toString();
    return qs ? `/products?${qs}` : '/products';
  };
  return <ProductResults query={query} href={href} />;
}
