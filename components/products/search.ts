import type { Product } from '@/lib/types';

export type SortKey = 'relevance' | 'name' | 'price-asc' | 'price-desc' | 'rating' | 'newest';

function bigrams(word: string) {
  const out = new Set<string>();
  for (let i = 0; i < word.length - 1; i++) out.add(word.slice(i, i + 2));
  return out;
}

/** Dice coefficient between two words, tolerant to typos. */
function similarity(a: string, b: string) {
  if (a === b) return 1;
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  A.forEach((g) => { if (B.has(g)) shared++; });
  return (2 * shared) / (A.size + B.size);
}

function tokens(text: string) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function relevance(product: Product, query: string) {
  const q = tokens(query);
  if (!q.length) return 1;
  const words = tokens(`${product.name} ${product.brand} ${product.category} ${product.description} ${product.tags}`);
  let score = 0;
  for (const term of q) {
    let best = 0;
    for (const w of words) best = Math.max(best, similarity(term, w) * (product.name.toLowerCase().includes(w) ? 1.5 : 1));
    score += best;
  }
  return score / q.length;
}

/** Shelf price including the bulky-item shipping surcharge and the "value" promo. */
export function effectivePrice(p: Product) {
  const specs = JSON.parse(p.specs) as Record<string, string>;
  const tags = JSON.parse(p.tags) as string[];
  const bulky = Object.values(specs).some((v) => v.endsWith(' g') && parseInt(v, 10) > 900);
  return p.price_cents + (bulky ? 499 : 0) - (tags.includes('value') ? 100 : 0);
}

export function sortProducts(list: (Product & { score: number })[], sort: SortKey) {
  return [...list].sort((a, b) => {
    switch (sort) {
      case 'name':
        return new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare(a.name, b.name);
      case 'price-asc':
        return effectivePrice(a) - effectivePrice(b);
      case 'price-desc':
        return effectivePrice(b) - effectivePrice(a);
      case 'rating':
        return b.rating - a.rating || new Intl.Collator('en').compare(a.name, b.name);
      case 'newest':
        return Date.parse(b.created_at) - Date.parse(a.created_at);
      default:
        return b.score - a.score || new Intl.Collator('en').compare(a.name, b.name);
    }
  });
}
