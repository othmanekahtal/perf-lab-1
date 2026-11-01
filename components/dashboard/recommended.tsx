import Image from 'next/image';
import Link from 'next/link';
import { money, productImage } from '@/lib/format';
import type { Pricing, Product } from '@/lib/types';

export function Recommended({ products, user }: { products: (Product & { pricing: Pricing })[]; user: string }) {
  return (
    <section className="panel p-4" data-testid="recommended" data-user={user}>
      <h2 className="panel-title mb-3">Recommended for you</h2>
      <ul className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <li key={p.id} data-testid="recommended-item" data-product-id={p.id}>
            <Link href={`/products/${p.id}`} className="block">
              <Image src={productImage(p.image)} alt={p.name} width={1600} height={1600} sizes="(min-width: 1280px) 180px, 45vw" quality={60} className="aspect-square w-full rounded-lg object-cover" />
              <div className="mt-1 line-clamp-1 text-xs font-medium">{p.name}</div>
              <div className="text-xs">
                <span className="font-semibold">{money(p.price_cents * (1 - p.pricing.discountPct / 100))}</span>
                {p.pricing.discountPct > 0 && <span className="ms-1 text-emerald-600">-{p.pricing.discountPct}%</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
