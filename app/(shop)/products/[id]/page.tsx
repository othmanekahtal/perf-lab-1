import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductView } from '@/components/products/product-view';
import { getProduct, getRelatedProducts, getReviews } from '@/lib/data';
import { getInventory, getPricing } from '@/lib/upstream';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = getProduct(Number((await params).id));
  return { title: product?.name ?? 'Product' };
}

export default async function ProductPage({ params }: Props) {
  const id = Number((await params).id);
  const product = getProduct(id);
  if (!product) notFound();

  const pricing = await getPricing(product.id);
  const inventory = await getInventory(product.id);
  const reviews = getReviews(product.id);
  const related = [];
  for (const p of getRelatedProducts(product, 8)) {
    related.push({ ...p, pricing: await getPricing(p.id) });
  }

  return <ProductView product={product} pricing={pricing} inventory={inventory} reviews={reviews} related={related} />;
}
