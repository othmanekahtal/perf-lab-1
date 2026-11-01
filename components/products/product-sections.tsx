import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { getRatingHistogram, getRelatedProducts, getReviews } from '@/lib/data';
import { dateTime, money, productImage } from '@/lib/format';
import type { Product, Review } from '@/lib/types';
import { getInventory, getPricing, getPricingBatch } from '@/lib/upstream';

export async function ProductPricing({ product }: { product: Product }) {
  const [pricing, inventory] = await Promise.all([getPricing(product.id), getInventory(product.id)]);
  const price = product.price_cents * (1 - pricing.discountPct / 100);
  return (
    <div className="panel p-4" data-testid="product-pricing">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold tabular-nums" data-testid="product-live-price">{money(price)}</span>
        {pricing.discountPct > 0 && <span className="text-sm text-slate-400 line-through">{money(product.price_cents)}</span>}
        {pricing.discountPct > 0 && <span className="chip border-transparent bg-emerald-600 text-white">-{pricing.discountPct}%</span>}
      </div>
      <div className="muted mt-1 text-xs">Competitors: {pricing.competitorDeltaPct > 0 ? '+' : ''}{pricing.competitorDeltaPct}% · price valid until {pricing.validUntil.slice(0, 10)}</div>
      <div className="mt-3 text-sm" data-testid="product-stock">
        {inventory.available > 0 ? (
          <span className="text-emerald-700"><Icon name="check-circle" /> {inventory.available} available in {inventory.warehouse} ({inventory.reserved} reserved)</span>
        ) : (
          <span className="text-red-600"><Icon name="alert-circle" /> Out of stock · restock {inventory.restockEta}</span>
        )}
      </div>
    </div>
  );
}

export function PricingSkeleton() {
  return <div className="panel h-[124px] animate-pulse p-4" />;
}

function ReviewCard({ r }: { r: Review }) {
  return (
    <article className="panel p-4" data-testid="review">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{r.title}</span>
        <span className="text-amber-600">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
      </div>
      <p className="mt-1 text-sm">{r.body}</p>
      <div className="muted mt-2 text-xs">{r.author} · {dateTime(r.created_at)} {r.verified ? '· Verified purchase' : ''} · {r.helpful} found helpful</div>
    </article>
  );
}

export async function ProductReviews({ product }: { product: Product }) {
  const histogram = getRatingHistogram(product.id);
  const total = histogram.reduce((s, h) => s + h.count, 0);
  const reviews = getReviews(product.id);
  return (
    <section className="grid gap-6 lg:grid-cols-3" data-testid="reviews">
      <div className="panel p-4">
        <h2 className="panel-title mb-3">Ratings</h2>
        {histogram.map((h) => (
          <div key={h.stars} className="mb-1 flex items-center gap-2 text-xs">
            <span className="w-6">{h.stars}★</span>
            <div className="h-2 flex-1 rounded bg-slate-100 dark:bg-slate-800">
              <div className="h-2 rounded bg-amber-400" style={{ width: `${total ? (h.count / total) * 100 : 0}%` }} />
            </div>
            <span className="w-6 text-right tabular-nums">{h.count}</span>
          </div>
        ))}
      </div>
      <div className="space-y-3 lg:col-span-2">
        {reviews.slice(0, 5).map((r) => <ReviewCard key={r.id} r={r} />)}
        {reviews.length > 5 && (
          <details className="group space-y-3">
            <summary className="btn-ghost cursor-pointer list-none group-open:hidden" data-testid="show-all-reviews">Show all {reviews.length} reviews</summary>
            {reviews.slice(5).map((r) => <ReviewCard key={r.id} r={r} />)}
          </details>
        )}
      </div>
    </section>
  );
}

export async function RelatedProducts({ product }: { product: Product }) {
  const related = getRelatedProducts(product, 8);
  const pricing = await getPricingBatch(related.map((p) => p.id));
  return (
    <section data-testid="related">
      <h2 className="panel-title mb-3">Related products</h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {related.map((p) => {
          const discount = pricing.find((x) => x.productId === p.id)?.discountPct ?? 0;
          return (
            <li key={p.id} className="panel overflow-hidden" data-testid="related-item">
              <Link href={`/products/${p.id}`}>
                <Image src={productImage(p.image)} alt={p.name} width={1600} height={1600} sizes="(min-width: 768px) 25vw, 48vw" quality={60} className="aspect-square w-full object-cover" />
                <div className="p-2 text-xs">
                  <div className="line-clamp-1 font-medium">{p.name}</div>
                  <div className="font-semibold">{money(p.price_cents * (1 - discount / 100))}</div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SectionSkeleton({ height }: { height: number }) {
  return <div className="panel animate-pulse" style={{ height }} />;
}
