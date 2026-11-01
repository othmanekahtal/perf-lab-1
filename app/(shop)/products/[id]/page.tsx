import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Icon } from '@/components/icon';
import { ProductGallery } from '@/components/products/product-gallery';
import { PricingSkeleton, ProductPricing, ProductReviews, RelatedProducts, SectionSkeleton } from '@/components/products/product-sections';
import { getProduct } from '@/lib/data';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = getProduct(Number((await params).id));
  return { title: product?.name ?? 'Product' };
}

export default async function ProductPage({ params }: Props) {
  const product = getProduct(Number((await params).id));
  if (!product) notFound();
  const specs = Object.entries(JSON.parse(product.specs) as Record<string, string>);

  return (
    <div className="space-y-8" data-testid="product-detail">
      <nav className="muted text-sm">
        <Link href="/products" className="hover:underline">Products</Link> / {product.category}
      </nav>
      <div className="grid gap-6 lg:grid-cols-2">
        <ProductGallery images={JSON.parse(product.images) as number[]} name={product.name} />
        <div className="space-y-4">
          <div>
            <div className="muted text-sm">{product.brand} · {product.sku}</div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="product-title">{product.name}</h1>
            <div className="mt-1 text-sm text-amber-600"><Icon name="star" /> {product.rating.toFixed(2)} · {product.review_count} reviews</div>
          </div>
          <Suspense fallback={<PricingSkeleton />}>
            <ProductPricing product={product} />
          </Suspense>
          <p className="text-sm leading-relaxed">{product.description}</p>
          <table className="w-full text-sm">
            <tbody>
              {specs.map(([k, v]) => (
                <tr key={k} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="muted py-1 pe-4 capitalize">{k.replace(/_\d+$/, '')}</td>
                  <td className="py-1">{v}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-100 dark:border-slate-800"><td className="muted py-1">Weight</td><td>{product.weight_g} g</td></tr>
              <tr className="border-t border-slate-100 dark:border-slate-800"><td className="muted py-1">Dimensions</td><td>{product.dimensions}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <Suspense fallback={<SectionSkeleton height={400} />}>
        <ProductReviews product={product} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height={320} />}>
        <RelatedProducts product={product} />
      </Suspense>
    </div>
  );
}
