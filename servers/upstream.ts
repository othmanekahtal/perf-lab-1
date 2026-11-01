// "Upstream" commerce platform API used by Shoply Admin (pricing, inventory, recommendations…).
// Latency is deterministic per endpoint + key. GET /__stats exposes a request counter, POST /__reset clears it.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { hash, mulberry32 } from '../scripts/rng.ts';

const PORT = Number(process.env.UPSTREAM_PORT ?? 4001);
const N_PRODUCTS = 5_000;

type Handler = (url: URL) => { latency: number; body: unknown };

const stats = { total: 0, byEndpoint: {} as Record<string, number>, since: new Date().toISOString() };

/** Deterministic latency in [base, base + jitter) derived from the key. */
function latency(base: number, jitter: number, key: string) {
  return base + (hash(key) % jitter);
}

function pricing(id: number) {
  const h = hash(`price:${id}`);
  return {
    productId: id,
    discountPct: [0, 0, 0, 5, 10, 15, 20, 25][h % 8],
    competitorDeltaPct: ((h >>> 3) % 21) - 10,
    currency: 'EUR',
    validUntil: '2026-11-30T00:00:00.000Z',
  };
}

function inventory(id: number) {
  const h = hash(`inv:${id}`);
  const available = h % 9 === 0 ? 0 : (h >>> 4) % 420;
  return {
    productId: id,
    available,
    reserved: (h >>> 9) % 25,
    warehouse: ['LIS-1', 'BER-2', 'MAD-1', 'OSL-1'][(h >>> 2) % 4],
    restockEta: available === 0 ? `2026-11-${String(3 + ((h >>> 5) % 20)).padStart(2, '0')}` : null,
  };
}

function ids(url: URL) {
  return (url.searchParams.get('ids') ?? '').split(',').map(Number).filter((n) => n > 0 && n <= N_PRODUCTS).slice(0, 100);
}

const routes: Record<string, Handler> = {
  '/v1/fx': () => ({
    latency: 150,
    body: { base: 'EUR', rates: { USD: 1.0832, GBP: 0.8417, CHF: 0.9461, MAD: 10.79, SEK: 11.42 }, asOf: '2026-10-31' },
  }),
  '/v1/forecast': (url) => {
    const days = Math.min(Number(url.searchParams.get('days') ?? 30), 90);
    const r = mulberry32(days);
    const points = Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      revenueCents: Math.round((4_200_000 + i * 21_000) * (0.9 + r() * 0.2)),
      low: 0, high: 0,
    })).map((p) => ({ ...p, low: Math.round(p.revenueCents * 0.88), high: Math.round(p.revenueCents * 1.12) }));
    return { latency: 600, body: { model: 'prophet-v4', horizonDays: days, points } };
  },
  '/v1/campaigns': () => ({
    latency: 250,
    body: {
      campaigns: [
        { id: 'c-autumn', name: 'Autumn Sale', start: '2026-09-22', end: '2026-10-05' },
        { id: 'c-bts', name: 'Back to School', start: '2026-08-25', end: '2026-09-08' },
        { id: 'c-bf', name: 'Black Friday warm-up', start: '2026-10-20', end: '2026-10-31' },
      ],
    },
  }),
  '/v1/inventory/low-stock': () => {
    const items = [];
    for (let id = 1; id <= N_PRODUCTS && items.length < 12; id += 37) if (inventory(id).available < 15) items.push(inventory(id));
    return { latency: 200, body: { count: items.length, items } };
  },
  '/v1/inventory': (url) => ({ latency: latency(280, 60, `invb:${url.search}`), body: { items: ids(url).map(inventory) } }),
  '/v1/pricing': (url) => ({ latency: latency(260, 60, `prb:${url.search}`), body: { items: ids(url).map(pricing) } }),
  '/v1/recommendations': (url) => {
    const user = url.searchParams.get('user') ?? 'anonymous';
    const r = mulberry32(hash(`recs:${user}`));
    const items = Array.from({ length: 6 }, () => ({ productId: 1 + Math.floor(r() * N_PRODUCTS), score: Math.round(r() * 1000) / 1000 }));
    return { latency: 2500, body: { user, model: 'two-tower-2026.10', items } };
  },
};

// Per-item endpoints: /v1/pricing/:id and /v1/inventory/:id
const itemRoutes: { prefix: string; base: number; jitter: number; fn: (id: number) => unknown }[] = [
  { prefix: '/v1/pricing/', base: 100, jitter: 60, fn: pricing },
  { prefix: '/v1/inventory/', base: 120, jitter: 60, fn: inventory },
];

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function count(endpoint: string) {
  stats.total++;
  stats.byEndpoint[endpoint] = (stats.byEndpoint[endpoint] ?? 0) + 1;
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (url.pathname === '/__stats') return send(res, 200, stats);
  if (url.pathname === '/__reset' && req.method === 'POST') {
    stats.total = 0;
    stats.byEndpoint = {};
    stats.since = new Date().toISOString();
    return send(res, 200, stats);
  }
  if (url.pathname === '/health') return send(res, 200, { ok: true });

  const route = routes[url.pathname];
  if (route) {
    count(url.pathname);
    const { latency: ms, body } = route(url);
    setTimeout(() => send(res, 200, body), ms);
    return;
  }
  for (const r of itemRoutes) {
    if (url.pathname.startsWith(r.prefix)) {
      const id = Number(url.pathname.slice(r.prefix.length));
      if (!(id > 0 && id <= N_PRODUCTS)) return send(res, 404, { error: 'not found' });
      count(`${r.prefix}:id`);
      setTimeout(() => send(res, 200, r.fn(id)), latency(r.base, r.jitter, `${r.prefix}${id}`));
      return;
    }
  }
  send(res, 404, { error: 'not found' });
});

server.keepAliveTimeout = 120_000;
server.listen(PORT, () => console.log(`upstream API listening on http://localhost:${PORT}`));
