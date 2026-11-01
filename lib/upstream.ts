import 'server-only';
import http from 'node:http';
import type { Campaign, Forecast, FxRates, Inventory, Pricing, Recommendations } from './types';

const BASE = process.env.UPSTREAM_URL ?? 'http://localhost:4001';
const agent = new http.Agent({ keepAlive: true, maxSockets: 64 });

/** Small JSON client for the commerce platform API (keep-alive agent, 10s timeout). */
export function upstream<T>(path: string): Promise<T> {
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

export const getFxRates = () => upstream<FxRates>('/v1/fx');
export const getForecast = (days: number) => upstream<Forecast>(`/v1/forecast?days=${days}`);
export const getCampaigns = () => upstream<{ campaigns: Campaign[] }>('/v1/campaigns').then((r) => r.campaigns);
export const getPricing = (productId: number) => upstream<Pricing>(`/v1/pricing/${productId}`);
export const getInventory = (productId: number) => upstream<Inventory>(`/v1/inventory/${productId}`);
export const getPricingBatch = (ids: number[]) => upstream<{ items: Pricing[] }>(`/v1/pricing?ids=${ids.join(',')}`).then((r) => r.items);
export const getInventoryBatch = (ids: number[]) => upstream<{ items: Inventory[] }>(`/v1/inventory?ids=${ids.join(',')}`).then((r) => r.items);
export const getLowStock = () => upstream<{ count: number; items: Inventory[] }>('/v1/inventory/low-stock');
export const getRecommendations = (username: string) => upstream<Recommendations>(`/v1/recommendations?user=${encodeURIComponent(username)}`);
