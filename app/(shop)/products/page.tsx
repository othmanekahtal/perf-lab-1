import type { Metadata } from 'next';
import { ProductsExplorer } from '@/components/products/products-explorer';
import { getAllProducts } from '@/lib/data';

export const metadata: Metadata = { title: 'Products' };

export default async function ProductsPage() {
  // PERF-BUG #5: all 5,000 products with every column (descriptions, specs, SEO…) are serialised into the RSC payload for a page that shows 24. Affects S12, S8, S3, S13.
  const products = getAllProducts();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <p className="muted text-sm">{products.length.toLocaleString('en-IE')} products in the catalogue</p>
      </div>
      <ProductsExplorer products={products} />
    </div>
  );
}
