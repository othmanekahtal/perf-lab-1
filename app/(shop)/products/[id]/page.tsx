import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductView } from '@/components/products/product-view';
import { getProduct, getRelatedProducts, getReviews } from '@/lib/data';
import { getInventory, getPricing, getPricingBatch } from '@/lib/upstream';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = getProduct(Number((await params).id));
  return { title: product?.name ?? 'Product' };
}

export default async function ProductPage({ params }: Props) {
  const id = Number((await params).id);
  const product = getProduct(id);
  if (!product) notFound();

  const relatedProducts = getRelatedProducts(product, 8);
  const [pricing, inventory, relatedPricing] = await Promise.all([
    getPricing(product.id),
    getInventory(product.id),
    getPricingBatch(relatedProducts.map((p) => p.id)),
  ]);
  const reviews = getReviews(product.id);
  const related = relatedProducts.map((p) => ({ ...p, pricing: relatedPricing.find((x) => x.productId === p.id)! }));

  // PERF-BUG #5: the whole page is a client component receiving every review (full rows); only the gallery needs to be interactive. Affects S8, S12.
  return <ProductView product={product} pricing={pricing} inventory={inventory} reviews={reviews} related={related} />;
}
