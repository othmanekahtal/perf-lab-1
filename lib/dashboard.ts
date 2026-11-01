import 'server-only';
import { getActivity, getKpis, getOrdersSince, getProductsByIds, getRecentOrders } from './data';
import { requireUser } from './session';
import { getCampaigns, getForecast, getFxRates, getInventoryBatch, getPricingBatch, getRecommendations } from './upstream';

export async function getDashboardData() {
  // PERF-BUG #7: the user's identity is read deep inside the data loader that also loads shared data, so the shared part can't be cached. Affects S1, S2 (and isolation if cached naively).
  const user = await requireUser();
  const recentOrders = getRecentOrders(8);

  // Independent requests start together; per-row lookups use the batch endpoints.
  const [fx, forecast, campaigns, inventory, recs] = await Promise.all([
    getFxRates(),
    getForecast(30),
    getCampaigns(),
    getInventoryBatch([...new Set(recentOrders.map((o) => o.product_id))]),
    // PERF-BUG #4: the slowest widget (~2.5 s) blocks the whole page; nothing streams. Affects S2, S3.
    getRecommendations(user.username).then(async (r) => {
      const products = getProductsByIds(r.items.map((i) => i.productId));
      const pricing = await getPricingBatch(products.map((p) => p.id));
      return products.map((p) => ({ ...p, pricing: pricing.find((x) => x.productId === p.id)! }));
    }),
  ]);

  const recent = recentOrders.map((o) => ({ ...o, inventory: inventory.find((i) => i.productId === o.product_id)! }));
  // PERF-BUG #5: ~8,400 full order rows (every column) are sent to a client component that only needs a few aggregates. Affects S12, S13, S3.
  const orders = getOrdersSince(30);
  return { user, fx, kpis: getKpis(), forecast, campaigns, orders, recent, recommended: recs, activity: getActivity(1500) };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
