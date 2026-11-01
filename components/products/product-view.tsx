'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { dateTime, money, productImage } from '@/lib/format';
import type { Inventory, Pricing, Product, Review } from '@/lib/types';

type Props = {
  product: Product;
  pricing: Pricing;
  inventory: Inventory;
  reviews: Review[];
  related: (Product & { pricing: Pricing })[];
};

export function ProductView({ product, pricing, inventory, reviews, related }: Props) {
  const images = JSON.parse(product.images) as number[];
  const specs = Object.entries(JSON.parse(product.specs) as Record<string, string>);
  const [active, setActive] = useState(images[0]);
  const [showAll, setShowAll] = useState(false);
  const price = product.price_cents * (1 - pricing.discountPct / 100);
  const histogram = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((r) => r.rating === stars).length }));

  return (
    <div className="space-y-8" data-testid="product-detail">
      <nav className="muted text-sm">
        <Link href="/products" className="hover:underline">Products</Link> / {product.category}
      </nav>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3" data-testid="product-gallery">
          <Image src={productImage(active)} alt={product.name} width={1600} height={1600} unoptimized className="aspect-square w-full rounded-xl object-cover" data-testid="product-hero" />
          <div className="grid grid-cols-4 gap-2">
            {images.map((img) => (
              <button key={img} onClick={() => setActive(img)} className={`overflow-hidden rounded-lg border-2 ${img === active ? 'border-brand-500' : 'border-transparent'}`} aria-label="Show image">
                <Image src={productImage(img)} alt="" width={1600} height={1600} unoptimized className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <div className="muted text-sm">{product.brand} · {product.sku}</div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="product-title">{product.name}</h1>
            <div className="mt-1 text-sm text-amber-600"><i className="mdi mdi-star" /> {product.rating.toFixed(2)} · {product.review_count} reviews</div>
          </div>
          <div className="card p-4" data-testid="product-pricing">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold tabular-nums" data-testid="product-live-price">{money(price)}</span>
              {pricing.discountPct > 0 && <span className="text-sm text-slate-400 line-through">{money(product.price_cents)}</span>}
              {pricing.discountPct > 0 && <span className="badge text-bg-success">-{pricing.discountPct}%</span>}
            </div>
            <div className="muted mt-1 text-xs">Competitors: {pricing.competitorDeltaPct > 0 ? '+' : ''}{pricing.competitorDeltaPct}% · price valid until {pricing.validUntil.slice(0, 10)}</div>
            <div className="mt-3 text-sm" data-testid="product-stock">
              {inventory.available > 0 ? (
                <span className="text-emerald-700"><i className="mdi mdi-check-circle" /> {inventory.available} available in {inventory.warehouse} ({inventory.reserved} reserved)</span>
              ) : (
                <span className="text-red-600"><i className="mdi mdi-alert-circle" /> Out of stock · restock {inventory.restockEta}</span>
              )}
            </div>
          </div>
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

      <section className="grid gap-6 lg:grid-cols-3" data-testid="reviews">
        <div className="card p-4">
          <h2 className="card-title mb-3">Ratings</h2>
          {histogram.map((h) => (
            <div key={h.stars} className="mb-1 flex items-center gap-2 text-xs">
              <span className="w-6">{h.stars}★</span>
              <div className="h-2 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                <div className="h-2 rounded bg-amber-400" style={{ width: `${reviews.length ? (h.count / reviews.length) * 100 : 0}%` }} />
              </div>
              <span className="w-6 text-right tabular-nums">{h.count}</span>
            </div>
          ))}
        </div>
        <div className="space-y-3 lg:col-span-2">
          {(showAll ? reviews : reviews.slice(0, 5)).map((r) => (
            <article key={r.id} className="card p-4" data-testid="review">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{r.title}</span>
                <span className="text-amber-600">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
              </div>
              <p className="mt-1 text-sm">{r.body}</p>
              <div className="muted mt-2 text-xs">{r.author} · {dateTime(r.created_at)} {r.verified ? '· Verified purchase' : ''} · {r.helpful} found helpful</div>
            </article>
          ))}
          {reviews.length > 5 && !showAll && (
            <button className="btn-ghost" onClick={() => setShowAll(true)} data-testid="show-all-reviews">Show all {reviews.length} reviews</button>
          )}
        </div>
      </section>

      <section data-testid="related">
        <h2 className="card-title mb-3">Related products</h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {related.map((p) => (
            <li key={p.id} className="card overflow-hidden" data-testid="related-item">
              <Link href={`/products/${p.id}`}>
                <Image src={productImage(p.image)} alt={p.name} width={1600} height={1600} unoptimized className="aspect-square w-full object-cover" />
                <div className="p-2 text-xs">
                  <div className="line-clamp-1 font-medium">{p.name}</div>
                  <div className="font-semibold">{money(p.price_cents * (1 - p.pricing.discountPct / 100))}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
