import type { Product } from '@/lib/types';

export type SortKey = 'relevance' | 'name' | 'price-asc' | 'price-desc' | 'rating' | 'newest';

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function bigrams(word: string) {
  const out = new Set<string>();
  for (let i = 0; i < word.length - 1; i++) out.add(word.slice(i, i + 2));
  return out;
}

/** Dice coefficient between two bigram sets, tolerant to typos. */
function similarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  a.forEach((g) => { if (b.has(g)) shared++; });
  return (2 * shared) / (a.size + b.size);
}

export function tokens(text: string) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Shelf price including the bulky-item shipping surcharge and the "value" promo. */
export function effectivePrice(p: Product) {
  const specs = JSON.parse(p.specs) as Record<string, string>;
  const tags = JSON.parse(p.tags) as string[];
  const bulky = Object.values(specs).some((v) => v.endsWith(' g') && parseInt(v, 10) > 900);
  return p.price_cents + (bulky ? 499 : 0) - (tags.includes('value') ? 100 : 0);
}

export type Indexed = { product: Product; price: number; created: number; words: { word: string; grams: Set<string>; inName: boolean }[] };

/** Everything the search and the sorts need, computed once per product list. */
export function buildIndex(products: Product[]): Indexed[] {
  return products.map((p) => {
    const name = p.name.toLowerCase();
    const unique = [...new Set(tokens(`${p.name} ${p.brand} ${p.category} ${p.description} ${p.tags}`))];
    return {
      product: p,
      price: effectivePrice(p),
      created: Date.parse(p.created_at),
      words: unique.map((word) => ({ word, grams: bigrams(word), inName: name.includes(word) })),
    };
  });
}

export function relevance(item: Indexed, query: string[]) {
  if (!query.length) return 1;
  let score = 0;
  for (const term of query) {
    const grams = bigrams(term);
    let best = 0;
    for (const w of item.words) best = Math.max(best, (w.word === term ? 1 : similarity(grams, w.grams)) * (w.inName ? 1.5 : 1));
    score += best;
  }
  return score / query.length;
}

export function sortIndexed(list: (Indexed & { score: number })[], sort: SortKey) {
  return [...list].sort((a, b) => {
    switch (sort) {
      case 'name': return collator.compare(a.product.name, b.product.name);
      case 'price-asc': return a.price - b.price;
      case 'price-desc': return b.price - a.price;
      case 'rating': return b.product.rating - a.product.rating || collator.compare(a.product.name, b.product.name);
      case 'newest': return b.created - a.created;
      default: return b.score - a.score || collator.compare(a.product.name, b.product.name);
    }
  });
}
