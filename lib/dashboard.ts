import 'server-only';
import { getActivity, getKpis, getOrdersSince, getProductsByIds, getRecentOrders } from './data';
import { requireUser } from './session';
import { getCampaigns, getForecast, getFxRates, getInventory, getPricing, getRecommendations } from './upstream';

export async function getDashboardData() {
  // PERF-BUG #7: the user's identity is read deep inside the data loader that also loads shared data, so the shared part can't be cached. Affects S1, S2 (and isolation if cached naively).
  const user = await requireUser();
  // PERF-BUG #3: independent awaits run one after another (fx → forecast → campaigns → … → recommendations). Affects S1, S2, S10.
  const fx = await getFxRates();
  const kpis = getKpis();
  const forecast = await getForecast(30);
  const campaigns = await getCampaigns();
  // PERF-BUG #5: ~8,400 full order rows (every column) are sent to a client component that only needs a few aggregates. Affects S12, S13, S3.
  const orders = getOrdersSince(30);

  const recent = [];
  // PERF-BUG #3: N+1, one upstream inventory call per row, sequential (a batch endpoint exists: /v1/inventory?ids=). Affects S1, S11.
  for (const order of getRecentOrders(8)) {
    const inventory = await getInventory(order.product_id);
    recent.push({ ...order, inventory });
  }

  // PERF-BUG #4: the slowest widget (~2.5 s) blocks the whole page; nothing streams. Affects S2, S3.
  const recs = await getRecommendations(user.username);
  const recProducts = getProductsByIds(recs.items.map((i) => i.productId));
  const recommended = [];
  // PERF-BUG #3: N+1 pricing calls, sequential (batch endpoint: /v1/pricing?ids=). Affects S1, S11.
  for (const product of recProducts) {
    const pricing = await getPricing(product.id);
    recommended.push({ ...product, pricing });
  }

  return { user, fx, kpis, forecast, campaigns, orders, recent, recommended, activity: getActivity(1500) };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
