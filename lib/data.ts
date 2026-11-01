import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { db } from './db';
import { STORE_TODAY } from './format';
import type { Order, OrderStatus, Product, Review } from './types';

// node:sqlite returns null-prototype rows; copy them into plain objects.
const plain = <T>(rows: unknown[]) => rows.map((r) => ({ ...(r as object) })) as T[];
const one = <T>(row: unknown) => (row ? ({ ...(row as object) } as T) : null);

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.parse(STORE_TODAY) - n * DAY).toISOString();

// Cache tags: anything derived from orders is tagged "orders" and refreshed by the order editor (updateTag).
export const TAGS = {
  orders: 'orders',
  order: (id: number) => `order:${id}`,
  products: 'products',
  reviews: (productId: number) => `reviews:${productId}`,
};

export type Kpis = {
  revenueCents: number;
  revenuePrevCents: number;
  orders: number;
  ordersPrev: number;
  aovCents: number;
  refundRate: number;
};

export async function getKpis(): Promise<Kpis> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.orders);
  const q = db().prepare(`
    SELECT COUNT(*) AS orders,
           COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN total_cents END), 0) AS revenue,
           SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refunded
    FROM orders WHERE created_at >= ? AND created_at < ?`);
  const cur = q.get(daysAgo(30), STORE_TODAY) as { orders: number; revenue: number; refunded: number };
  const prev = q.get(daysAgo(60), daysAgo(30)) as { orders: number; revenue: number; refunded: number };
  return {
    revenueCents: cur.revenue,
    revenuePrevCents: prev.revenue,
    orders: cur.orders,
    ordersPrev: prev.orders,
    aovCents: cur.orders ? Math.round(cur.revenue / cur.orders) : 0,
    refundRate: cur.orders ? cur.refunded / cur.orders : 0,
  };
}

export type ChartAggregates = {
  revenueByDay: { day: string; revenueCents: number }[];
  itemsByStatus: { status: string; items: number }[];
  revenueByChannel: { channel: string; revenueCents: number }[];
};

/** Everything the dashboard charts need, aggregated in SQL (a few dozen numbers instead of thousands of rows). */
export async function getChartAggregates(days: number): Promise<ChartAggregates> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.orders);
  const since = daysAgo(days);
  return {
    revenueByDay: plain(db().prepare(`SELECT substr(created_at, 1, 10) AS day, SUM(total_cents) AS revenueCents FROM orders WHERE created_at >= ? AND status NOT IN ('cancelled','refunded') GROUP BY day ORDER BY day`).all(since)),
    itemsByStatus: plain(db().prepare('SELECT status, SUM(json_array_length(items)) AS items FROM orders WHERE created_at >= ? GROUP BY status ORDER BY status').all(since)),
    revenueByChannel: plain(db().prepare(`SELECT channel, SUM(total_cents) AS revenueCents FROM orders WHERE created_at >= ? AND status NOT IN ('cancelled','refunded') GROUP BY channel ORDER BY revenueCents DESC`).all(since)),
  };
}

export async function getRecentOrders(limit: number): Promise<Order[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.orders);
  return plain<Order>(db().prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ?').all(limit));
}

export async function getProduct(id: number): Promise<Product | null> {
  'use cache';
  cacheLife('days');
  cacheTag(TAGS.products);
  return one<Product>(db().prepare('SELECT * FROM products WHERE id = ?').get(id));
}

export async function getProductsByIds(ids: number[]): Promise<Product[]> {
  'use cache';
  cacheLife('days');
  cacheTag(TAGS.products);
  if (!ids.length) return [];
  const rows = plain<Product>(db().prepare(`SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids));
  return ids.map((id) => rows.find((r) => r.id === id)).filter((p): p is Product => Boolean(p));
}

export async function getReviews(productId: number, limit = 1000): Promise<Review[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.reviews(productId));
  return plain<Review>(db().prepare('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT ?').all(productId, limit));
}

export async function getRatingHistogram(productId: number) {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.reviews(productId));
  const rows = plain<{ rating: number; n: number }>(db().prepare('SELECT rating, COUNT(*) AS n FROM reviews WHERE product_id = ? GROUP BY rating').all(productId));
  return [5, 4, 3, 2, 1].map((stars) => ({ stars, count: rows.find((r) => r.rating === stars)?.n ?? 0 }));
}

export async function getRelatedProducts(category: string, excludeId: number, limit: number): Promise<Product[]> {
  'use cache';
  cacheLife('days');
  cacheTag(TAGS.products);
  return plain<Product>(db().prepare('SELECT * FROM products WHERE category = ? AND id != ? ORDER BY rating DESC, id LIMIT ?').all(category, excludeId, limit));
}

export type OrderListRow = Order & { customer_orders: number; customer_lifetime_cents: number };

export const ORDERS_PAGE_SIZE = 25;

/** Uncached on purpose: one entry per filter/search/page combination would rarely be reused. Call from a dynamic scope. */
export function listOrders(opts: { status?: OrderStatus; q?: string; page: number }) {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.status) {
    where.push('status = ?');
    args.push(opts.status);
  }
  if (opts.q) {
    where.push('(number LIKE ? OR customer_name LIKE ? OR customer_email LIKE ?)');
    args.push(`%${opts.q}%`, `%${opts.q}%`, `%${opts.q}%`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db().prepare(`SELECT COUNT(*) AS n FROM orders ${clause}`).get(...args) as { n: number }).n;
  const rows = plain<Order>(
    db().prepare(`SELECT * FROM orders ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, ORDERS_PAGE_SIZE, (opts.page - 1) * ORDERS_PAGE_SIZE),
  );
  const customerStats = db().prepare('SELECT COUNT(*) AS n, SUM(total_cents) AS lifetime FROM orders WHERE customer_email = ?');
  const withCustomer: OrderListRow[] = rows.map((o) => {
    const s = customerStats.get(o.customer_email) as { n: number; lifetime: number };
    return { ...o, customer_orders: s.n, customer_lifetime_cents: s.lifetime };
  });
  return { total, pages: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)), rows: withCustomer };
}

/** Uncached: the editor must always show the latest saved values. */
export function getOrder(id: number): Order | null {
  return one<Order>(db().prepare('SELECT * FROM orders WHERE id = ?').get(id));
}

export function saveOrder(id: number, patch: { status: OrderStatus; shipping_address: string; notes: string; items: string; total_cents: number }) {
  db()
    .prepare('UPDATE orders SET status = ?, shipping_address = ?, notes = ?, items = ?, total_cents = ?, updated_at = ? WHERE id = ?')
    .run(patch.status, patch.shipping_address, patch.notes, patch.items, patch.total_cents, new Date().toISOString(), id);
}

export async function getActivity(limit: number) {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.orders);
  return plain<Pick<Order, 'id' | 'number' | 'customer_name' | 'status' | 'total_cents' | 'channel' | 'created_at'>>(
    db().prepare('SELECT id, number, customer_name, status, total_cents, channel, created_at FROM orders ORDER BY created_at DESC LIMIT ?').all(limit),
  );
}
