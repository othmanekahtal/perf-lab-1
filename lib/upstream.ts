import 'server-only';
import http from 'node:http';
import { cacheLife, cacheTag } from 'next/cache';
import type { Campaign, Forecast, FxRates, Inventory, Pricing, Recommendations } from './types';

const BASE = process.env.UPSTREAM_URL ?? 'http://localhost:4001';
const agent = new http.Agent({ keepAlive: true, maxSockets: 64 });

/** Small JSON client for the commerce platform API (keep-alive agent, 10s timeout, one retry on a reset connection). */
export async function upstream<T>(path: string): Promise<T> {
  try {
    return await request<T>(path);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ECONNRESET' || code === 'EPIPE') return request<T>(path);
    throw e;
  }
}

function request<T>(path: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${path}`, { agent, timeout: 10_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        if ((res.statusCode ?? 500) >= 400) return reject(new Error(`upstream ${path} → ${res.statusCode}`));
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`upstream ${path} timed out`)));
    req.on('error', reject);
  });
}

// Each call is cached by its arguments ("use cache" also dedupes concurrent calls within a request).
// Profiles: reference data (FX, forecast, campaigns) for hours; stock and prices for hours with tags so they can be refreshed on demand.

export async function getFxRates() {
  'use cache';
  cacheLife('hours');
  cacheTag('fx');
  return upstream<FxRates>('/v1/fx');
}

export async function getForecast(days: number) {
  'use cache';
  cacheLife('hours');
  cacheTag('forecast');
  return upstream<Forecast>(`/v1/forecast?days=${days}`);
}

export async function getCampaigns() {
  'use cache';
  cacheLife('hours');
  cacheTag('campaigns');
  return (await upstream<{ campaigns: Campaign[] }>('/v1/campaigns')).campaigns;
}

export async function getPricing(productId: number) {
  'use cache';
  cacheLife('hours');
  cacheTag('pricing');
  return upstream<Pricing>(`/v1/pricing/${productId}`);
}

export async function getInventory(productId: number) {
  'use cache';
  cacheLife('hours');
  cacheTag('inventory');
  return upstream<Inventory>(`/v1/inventory/${productId}`);
}

export async function getPricingBatch(ids: number[]) {
  'use cache';
  cacheLife('hours');
  cacheTag('pricing');
  if (!ids.length) return [];
  return (await upstream<{ items: Pricing[] }>(`/v1/pricing?ids=${ids.join(',')}`)).items;
}

export async function getInventoryBatch(ids: number[]) {
  'use cache';
  cacheLife('hours');
  cacheTag('inventory');
  if (!ids.length) return [];
  return (await upstream<{ items: Inventory[] }>(`/v1/inventory?ids=${ids.join(',')}`)).items;
}

export async function getLowStock() {
  'use cache';
  cacheLife('hours');
  cacheTag('inventory');
  return upstream<{ count: number; items: Inventory[] }>('/v1/inventory/low-stock');
}

/** Personal: the username is an argument, so it is part of the cache key and users never share an entry. */
export async function getRecommendations(username: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(`recs:${username}`);
  return upstream<Recommendations>(`/v1/recommendations?user=${encodeURIComponent(username)}`);
}
