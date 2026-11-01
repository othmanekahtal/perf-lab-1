import 'server-only';
import { getActivity, getChartAggregates, getKpis, getProductsByIds, getRecentOrders } from './data';
import { getCampaigns, getForecast, getInventoryBatch, getPricingBatch, getRecommendations } from './upstream';

export async function getChartsData() {
  const [forecast, campaigns] = await Promise.all([getForecast(30), getCampaigns()]);
  const agg = await getChartAggregates(30);
  const revenue = [
    ...agg.revenueByDay.map((d) => ({ day: d.day.slice(5), revenue: d.revenueCents, forecast: null as number | null })),
    ...forecast.points.map((p) => ({ day: new Date(Date.UTC(2026, 10, p.day)).toISOString().slice(5, 10), revenue: null as number | null, forecast: p.revenueCents })),
  ];
  return { revenue, itemsByStatus: agg.itemsByStatus, revenueByChannel: agg.revenueByChannel, campaigns };
}

export async function getRecentOrdersWithStock(limit: number) {
  const orders = await getRecentOrders(limit);
  const inventory = await getInventoryBatch([...new Set(orders.map((o) => o.product_id))]);
  return orders.map((o) => ({ ...o, inventory: inventory.find((i) => i.productId === o.product_id)! }));
}

export async function getRecommendedProducts(username: string) {
  const recs = await getRecommendations(username);
  const products = await getProductsByIds(recs.items.map((i) => i.productId));
  const pricing = await getPricingBatch(products.map((p) => p.id));
  return products.map((p) => ({ ...p, pricing: pricing.find((x) => x.productId === p.id)! }));
}

export { getActivity, getKpis };
