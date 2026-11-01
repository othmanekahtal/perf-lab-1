import type { Metadata } from 'next';
import { ProductsExplorer } from '@/components/products/products-explorer';
import { getAllProducts } from '@/lib/data';

export const metadata: Metadata = { title: 'Products' };

export default async function ProductsPage() {
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
