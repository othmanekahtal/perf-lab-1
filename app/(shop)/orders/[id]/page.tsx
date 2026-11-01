import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { OrderEditor } from '@/components/orders/order-editor';
import { getOrder, getProductsByIds } from '@/lib/data';
import type { OrderItem } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: 'Edit order' };

export default function OrderPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="panel h-96 animate-pulse" />}>
      <EditOrder params={params} />
    </Suspense>
  );
}

async function EditOrder({ params }: Props) {
  const order = getOrder(Number((await params).id));
  if (!order) notFound();
  const items = JSON.parse(order.items) as OrderItem[];
  const products = (await getProductsByIds(items.map((i) => i.productId))).map((p) => ({ id: p.id, name: p.name, sku: p.sku }));
  return (
    <div className="space-y-4">
      <nav className="muted text-sm"><Link href="/orders" className="hover:underline">Orders</Link> / {order.number}</nav>
      <OrderEditor order={order} items={items} products={products} />
    </div>
  );
}
