import 'server-only';
import { getActivity, getKpis, getOrdersSince, getProductsByIds, getRecentOrders } from './data';
import { getCampaigns, getForecast, getInventoryBatch, getPricingBatch, getRecommendations } from './upstream';

export async function getChartsData() {
  const [forecast, campaigns] = await Promise.all([getForecast(30), getCampaigns()]);
  // PERF-BUG #5: ~8,400 full order rows (every column) are sent to a client component that only needs a few aggregates. Affects S12, S13, S3.
  return { forecast, campaigns, orders: getOrdersSince(30) };
}

export async function getRecentOrdersWithStock(limit: number) {
  const orders = getRecentOrders(limit);
  const inventory = await getInventoryBatch([...new Set(orders.map((o) => o.product_id))]);
  return orders.map((o) => ({ ...o, inventory: inventory.find((i) => i.productId === o.product_id)! }));
}

export async function getRecommendedProducts(username: string) {
  const recs = await getRecommendations(username);
  const products = getProductsByIds(recs.items.map((i) => i.productId));
  const pricing = await getPricingBatch(products.map((p) => p.id));
  return products.map((p) => ({ ...p, pricing: pricing.find((x) => x.productId === p.id)! }));
}

export { getActivity, getKpis };
