import 'server-only';
import { db } from './db';
import { buildIndex, relevance, sortIndexed, tokens, type Indexed, type SortKey } from './search';
import type { Product } from './types';

export const PAGE_SIZE = 24;
export const SORTS: SortKey[] = ['relevance', 'name', 'price-asc', 'price-desc', 'rating', 'newest'];

/** What a product card needs, and nothing else. */
export type CatalogCard = Pick<Product, 'id' | 'name' | 'brand' | 'category' | 'rating' | 'stock' | 'image'> & { shelfCents: number };

export type CatalogQuery = { q: string; categories: string[]; brand: string; inStock: boolean; sort: SortKey; page: number };

// The catalogue changes only on deploy, so the search index is built once per server process.
let index: Indexed[] | null = null;
function catalogIndex() {
  index ??= buildIndex(db().prepare('SELECT id, name, brand, category, description, tags, specs, price_cents, rating, stock, image, created_at FROM products').all().map((r) => ({ ...(r as object) }) as Product));
  return index;
}

export function catalogBrands() {
  return [...new Set(catalogIndex().map((i) => i.product.brand))].sort();
}

export function searchCatalog(query: CatalogQuery) {
  const terms = tokens(query.q);
  const scored: (Indexed & { score: number })[] = [];
  for (const item of catalogIndex()) {
    const p = item.product;
    if (query.categories.length && !query.categories.includes(p.category)) continue;
    if (query.brand && p.brand !== query.brand) continue;
    if (query.inStock && p.stock === 0) continue;
    const score = relevance(item, terms);
    if (terms.length && score < 0.55) continue;
    scored.push({ ...item, score });
  }
  const sorted = sortIndexed(scored, query.sort);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pages);
  const items: CatalogCard[] = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(({ product: p, price }) => ({
    id: p.id, name: p.name, brand: p.brand, category: p.category, rating: p.rating, stock: p.stock, image: p.image, shelfCents: price,
  }));
  return { total: sorted.length, page, pages, items };
}

export function parseCatalogQuery(sp: Record<string, string | string[] | undefined>): CatalogQuery {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? '';
  const sort = one('sort') as SortKey;
  return {
    q: one('q').slice(0, 80),
    categories: one('cat').split(',').filter(Boolean),
    brand: one('brand'),
    inStock: one('stock') === '1',
    sort: SORTS.includes(sort) ? sort : 'relevance',
    page: Number(one('page')) || 1,
  };
}
